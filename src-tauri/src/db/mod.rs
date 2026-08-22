pub mod migration;
pub mod repository;

pub use migration::MigrationRunner;
pub use repository::{ProjectRepository, ServerProfileRepository, SqliteServerProfileRepository};

use rusqlite::Connection;
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex};

/// Initializes the SQLite database file, creates parent directories if needed,
/// configures connection pragmas (WAL mode, foreign keys, busy timeout), runs
/// schema migrations, and returns the thread-safe `SqliteServerProfileRepository`.
pub fn initialize_database(db_path: &Path) -> Result<SqliteServerProfileRepository, String> {
    // Ensure parent directory exists
    if let Some(parent) = db_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| {
                format!(
                    "Failed to create database directory '{}': {}",
                    parent.display(),
                    e
                )
            })?;
        }
    }

    // Open SQLite connection
    let mut conn = Connection::open(db_path)
        .map_err(|e| format!("Failed to open SQLite database at '{}': {}", db_path.display(), e))?;

    // Configure performance and safety pragmas
    conn.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;
        PRAGMA busy_timeout = 5000;
        "#,
    )
    .map_err(|e| format!("Failed to configure SQLite pragmas: {}", e))?;

    // Run schema migrations
    MigrationRunner::run_migrations(&mut conn)?;

    let shared_conn = Arc::new(Mutex::new(conn));
    Ok(SqliteServerProfileRepository::new(shared_conn))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initialize_database_file() {
        let temp_dir = std::env::temp_dir().join(format!("devhub_test_{}", uuid::Uuid::new_v4()));
        let db_file = temp_dir.join("test_devhub.db");

        let repo = initialize_database(&db_file).expect("Database initialization failed");
        assert_eq!(repo.count().unwrap(), 0);

        // Cleanup
        let _ = fs::remove_dir_all(temp_dir);
    }
}
