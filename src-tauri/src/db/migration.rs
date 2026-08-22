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

        // Verify table exists by checking columns
        let table_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='server_profiles'",
                [],
                |r| r.get::<_, i64>(0),
            )
            .map(|c| c > 0)
            .expect("Should query table existence");
        assert!(table_exists);

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM server_profiles", [], |r| r.get(0))
            .expect("Should query server_profiles count");
        assert_eq!(count, 0);

        // Verify migration tracking
        let applied: Vec<i64> = conn
            .prepare("SELECT version FROM schema_migrations ORDER BY version ASC")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        assert_eq!(applied, vec![1]);
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
        assert_eq!(count, 1);
    }
}

