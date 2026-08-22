use chrono::Utc;
use rusqlite::{params, Connection, Result, Transaction};

/// Represents a single versioned database migration.
pub struct Migration {
    pub version: i64,
    pub name: &'static str,
    pub sql: &'static str,
}

/// Ordered list of all database schema migrations.
pub const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        name: "001_create_server_profiles",
        sql: r#"
            CREATE TABLE IF NOT EXISTS server_profiles (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                environment_type TEXT NOT NULL,
                distribution TEXT,
                working_directory TEXT NOT NULL,
                command TEXT NOT NULL,
                expected_port INTEGER,
                expected_host TEXT,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_server_profiles_name 
                ON server_profiles(name);
            CREATE INDEX IF NOT EXISTS idx_server_profiles_env 
                ON server_profiles(environment_type, distribution);
        "#,
    },
    Migration {
        version: 2,
        name: "002_create_projects",
        sql: r#"
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_projects_name 
                ON projects(name COLLATE NOCASE);

            CREATE TABLE IF NOT EXISTS project_profiles (
                project_id TEXT NOT NULL,
                profile_id TEXT NOT NULL UNIQUE,
                order_index INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (project_id, profile_id),
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (profile_id) REFERENCES server_profiles(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_project_profiles_project_order 
                ON project_profiles(project_id, order_index);
        "#,
    },
];

/// Migration engine responsible for creating the migration tracking table
/// and executing pending migrations in strictly sequential transactions.
pub struct MigrationRunner;

impl MigrationRunner {
    /// Applies all unapplied migrations to the database connection.
    pub fn run_migrations(conn: &mut Connection) -> Result<(), String> {
        // Step 1: Ensure tracking table exists
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                applied_at TEXT NOT NULL
            );
            "#,
        )
        .map_err(|e| format!("Failed to create schema_migrations table: {}", e))?;

        // Step 2: Query currently applied versions
        let applied_versions: std::collections::HashSet<i64> = {
            let mut stmt = conn
                .prepare("SELECT version FROM schema_migrations ORDER BY version ASC")
                .map_err(|e| format!("Failed to prepare migrations query: {}", e))?;

            let rows = stmt
                .query_map([], |row| row.get(0))
                .map_err(|e| format!("Failed to read applied migrations: {}", e))?;

            let mut set = std::collections::HashSet::new();
            for r in rows {
                if let Ok(v) = r {
                    set.insert(v);
                }
            }
            set
        };

        // Step 3: Execute pending migrations in sequence
        for migration in MIGRATIONS {

            if !applied_versions.contains(&migration.version) {
                let tx = conn
                    .transaction()
                    .map_err(|e| format!("Failed to start migration transaction {}: {}", migration.version, e))?;

                Self::apply_migration(&tx, migration)?;

                tx.commit()
                    .map_err(|e| format!("Failed to commit migration {}: {}", migration.version, e))?;
            }
        }

        Ok(())
    }

    /// Executes an individual migration within an active database transaction.
    fn apply_migration(tx: &Transaction, migration: &Migration) -> Result<(), String> {
        tx.execute_batch(migration.sql)
            .map_err(|e| format!("Migration {} ('{}') execution failed: {}", migration.version, migration.name, e))?;

        let now = Utc::now().to_rfc3339();
        tx.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, ?3)",
            params![migration.version, migration.name, now],
        )
        .map_err(|e| format!("Failed to record migration version {}: {}", migration.version, e))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_migrations_from_clean_database() {
        let mut conn = Connection::open_in_memory().expect("Failed to open in-memory db");
        let result = MigrationRunner::run_migrations(&mut conn);
        assert!(result.is_ok(), "Migration runner should succeed on fresh db");

        // Verify tables exist by checking columns
        let profiles_table_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='server_profiles'",
                [],
                |r| r.get::<_, i64>(0),
            )
            .map(|c| c > 0)
            .expect("Should query table existence");
        assert!(profiles_table_exists);

        let projects_table_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='projects'",
                [],
                |r| r.get::<_, i64>(0),
            )
            .map(|c| c > 0)
            .expect("Should query projects table existence");
        assert!(projects_table_exists);

        let project_profiles_table_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='project_profiles'",
                [],
                |r| r.get::<_, i64>(0),
            )
            .map(|c| c > 0)
            .expect("Should query project_profiles table existence");
        assert!(project_profiles_table_exists);

        // Verify migration tracking
        let applied: Vec<i64> = conn
            .prepare("SELECT version FROM schema_migrations ORDER BY version ASC")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        assert_eq!(applied, vec![1, 2]);
    }

    #[test]
    fn test_migrations_are_idempotent() {
        let mut conn = Connection::open_in_memory().expect("Failed to open in-memory db");
        MigrationRunner::run_migrations(&mut conn).expect("First run failed");
        let second_run = MigrationRunner::run_migrations(&mut conn);
        assert!(second_run.is_ok(), "Second migration run should succeed without error");

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |r| r.get(0))
            .expect("Should query schema_migrations");
        assert_eq!(count, 2);
    }

    #[test]
    fn test_migration_upgrades_existing_database_with_profiles() {
        let mut conn = Connection::open_in_memory().expect("Failed to open in-memory db");

        // Manually apply migration 1 only
        conn.execute_batch(
            r#"
            CREATE TABLE schema_migrations (
                version INTEGER PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                applied_at TEXT NOT NULL
            );
            "#,
        ).unwrap();
        {
            let tx = conn.transaction().unwrap();
            MigrationRunner::apply_migration(&tx, &MIGRATIONS[0]).unwrap();
            tx.commit().unwrap();
        }

        // Insert a profile in migration 1 schema
        conn.execute(
            r#"
            INSERT INTO server_profiles (
                id, name, description, environment_type, distribution,
                working_directory, command, expected_port, expected_host,
                enabled, created_at, updated_at
            ) VALUES ('prof-1', 'Existing Profile', 'Desc', 'windows', NULL, 'C:\app', 'npm start', 3000, '127.0.0.1', 1, '2026-08-22T00:00:00Z', '2026-08-22T00:00:00Z')
            "#,
            [],
        ).unwrap();

        // Run full migrations (should apply migration 2 without touching existing profile)
        let result = MigrationRunner::run_migrations(&mut conn);
        assert!(result.is_ok());

        let profile_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM server_profiles WHERE id = 'prof-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(profile_count, 1);

        let projects_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM projects", [], |r| r.get(0))
            .unwrap();
        assert_eq!(projects_count, 0);
    }
}

