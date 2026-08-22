use crate::models::environment::Environment;
use crate::models::profile::ServerProfile;
use rusqlite::{params, Connection, OptionalExtension, Row};
use std::sync::{Arc, Mutex};

/// Trait defining persistent storage operations for Server Profiles.
/// Decouples business logic and services from direct SQLite / SQL dependencies.
pub trait ServerProfileRepository: Send + Sync {
    /// Inserts a new ServerProfile record into storage.
    fn create(&self, profile: &ServerProfile) -> Result<ServerProfile, String>;

    /// Retrieves an individual ServerProfile by its unique UUID string.
    fn get_by_id(&self, id: &str) -> Result<Option<ServerProfile>, String>;

    /// Lists all saved ServerProfile records ordered by name.
    fn list_all(&self) -> Result<Vec<ServerProfile>, String>;

    /// Updates an existing ServerProfile record. Returns error if not found.
    fn update(&self, profile: &ServerProfile) -> Result<ServerProfile, String>;

    /// Deletes a ServerProfile by ID. Returns true if removed, false if not found.
    fn delete(&self, id: &str) -> Result<bool, String>;

    /// Returns the total count of saved server profiles.
    fn count(&self) -> Result<usize, String>;
}

/// Thread-safe SQLite implementation of `ServerProfileRepository`.
#[derive(Clone)]
pub struct SqliteServerProfileRepository {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteServerProfileRepository {
    /// Creates a repository wrapping an active SQLite connection.
    pub fn new(conn: Arc<Mutex<Connection>>) -> Self {
        Self { conn }
    }

    /// Helper to convert a database row into a `ServerProfile` domain struct.
    fn row_to_profile(row: &Row) -> rusqlite::Result<ServerProfile> {
        let id: String = row.get("id")?;
        let name: String = row.get("name")?;
        let description: Option<String> = row.get("description")?;
        let env_type: String = row.get("environment_type")?;
        let distro: Option<String> = row.get("distribution")?;
        let working_directory: String = row.get("working_directory")?;
        let command: String = row.get("command")?;
        let expected_port_raw: Option<i64> = row.get("expected_port")?;
        let expected_port: Option<u16> = expected_port_raw.map(|p| p as u16);
        let expected_host: Option<String> = row.get("expected_host")?;
        let enabled_int: i64 = row.get("enabled")?;
        let created_at: String = row.get("created_at")?;
        let updated_at: String = row.get("updated_at")?;

        let environment = match env_type.as_str() {
            "wsl" => Environment::wsl(distro.unwrap_or_default()),
            _ => Environment::windows(),
        };

        Ok(ServerProfile {
            id,
            name,
            description,
            environment,
            working_directory,
            command,
            expected_port,
            expected_host,
            enabled: enabled_int != 0,
            created_at,
            updated_at,
        })
    }
}

impl ServerProfileRepository for SqliteServerProfileRepository {
    fn create(&self, profile: &ServerProfile) -> Result<ServerProfile, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        let (env_type, distro) = match &profile.environment {
            Environment::Windows => ("windows", None),
            Environment::Wsl { distro } => ("wsl", Some(distro.as_str())),
        };

        let port_i64 = profile.expected_port.map(|p| p as i64);
        let enabled_i64 = if profile.enabled { 1i64 } else { 0i64 };

        conn.execute(
            r#"
            INSERT INTO server_profiles (
                id, name, description, environment_type, distribution,
                working_directory, command, expected_port, expected_host,
                enabled, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
            "#,
            params![
                profile.id,
                profile.name,
                profile.description,
                env_type,
                distro,
                profile.working_directory,
                profile.command,
                port_i64,
                profile.expected_host,
                enabled_i64,
                profile.created_at,
                profile.updated_at,
            ],
        )
        .map_err(|e| format!("Failed to insert server profile: {}", e))?;

        Ok(profile.clone())
    }

    fn get_by_id(&self, id: &str) -> Result<Option<ServerProfile>, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        let mut stmt = conn
            .prepare(
                r#"
                SELECT id, name, description, environment_type, distribution,
                       working_directory, command, expected_port, expected_host,
                       enabled, created_at, updated_at
                FROM server_profiles
                WHERE id = ?1
                "#,
            )
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let profile = stmt
            .query_row(params![id], Self::row_to_profile)
            .optional()
            .map_err(|e| format!("Failed to query profile {}: {}", id, e))?;

        Ok(profile)
    }

    fn list_all(&self) -> Result<Vec<ServerProfile>, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        let mut stmt = conn
            .prepare(
                r#"
                SELECT id, name, description, environment_type, distribution,
                       working_directory, command, expected_port, expected_host,
                       enabled, created_at, updated_at
                FROM server_profiles
                ORDER BY name COLLATE NOCASE ASC
                "#,
            )
            .map_err(|e| format!("Failed to prepare list query: {}", e))?;

        let rows = stmt
            .query_map([], Self::row_to_profile)
            .map_err(|e| format!("Failed to execute list query: {}", e))?;

        let mut profiles = Vec::new();
        for r in rows {
            let p = r.map_err(|e| format!("Failed to parse profile row: {}", e))?;
            profiles.push(p);
        }

        Ok(profiles)
    }

    fn update(&self, profile: &ServerProfile) -> Result<ServerProfile, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        let (env_type, distro) = match &profile.environment {
            Environment::Windows => ("windows", None),
            Environment::Wsl { distro } => ("wsl", Some(distro.as_str())),
        };

        let port_i64 = profile.expected_port.map(|p| p as i64);
        let enabled_i64 = if profile.enabled { 1i64 } else { 0i64 };

        let affected = conn
            .execute(
                r#"
                UPDATE server_profiles
                SET name = ?2,
                    description = ?3,
                    environment_type = ?4,
                    distribution = ?5,
                    working_directory = ?6,
                    command = ?7,
                    expected_port = ?8,
                    expected_host = ?9,
                    enabled = ?10,
                    updated_at = ?11
                WHERE id = ?1
                "#,
                params![
                    profile.id,
                    profile.name,
                    profile.description,
                    env_type,
                    distro,
                    profile.working_directory,
                    profile.command,
                    port_i64,
                    profile.expected_host,
                    enabled_i64,
                    profile.updated_at,
                ],
            )
            .map_err(|e| format!("Failed to update profile: {}", e))?;

        if affected == 0 {
            return Err(format!("Profile with ID '{}' does not exist.", profile.id));
        }

        Ok(profile.clone())
    }

    fn delete(&self, id: &str) -> Result<bool, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        let affected = conn
            .execute("DELETE FROM server_profiles WHERE id = ?1", params![id])
            .map_err(|e| format!("Failed to delete profile {}: {}", id, e))?;

        Ok(affected > 0)
    }

    fn count(&self) -> Result<usize, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM server_profiles", [], |r| r.get(0))
            .map_err(|e| format!("Failed to count server profiles: {}", e))?;

        Ok(count as usize)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migration::MigrationRunner;

    fn setup_test_repo() -> SqliteServerProfileRepository {
        let mut conn = Connection::open_in_memory().expect("Failed to create in-memory db");
        MigrationRunner::run_migrations(&mut conn).expect("Migrations failed");
        SqliteServerProfileRepository::new(Arc::new(Mutex::new(conn)))
    }

    #[test]
    fn test_create_and_get_profile() {
        let repo = setup_test_repo();

        let profile = ServerProfile {
            id: "test-uuid-1".to_string(),
            name: "Company Frontend".to_string(),
            description: Some("Frontend dashboard".to_string()),
            environment: Environment::windows(),
            working_directory: "C:\\Projects\\frontend".to_string(),
            command: "npm run dev".to_string(),
            expected_port: Some(3000),
            expected_host: Some("127.0.0.1".to_string()),
            enabled: true,
            created_at: "2026-08-22T20:00:00Z".to_string(),
            updated_at: "2026-08-22T20:00:00Z".to_string(),
        };

        let created = repo.create(&profile).expect("Failed to create profile");
        assert_eq!(created.id, "test-uuid-1");

        let fetched = repo.get_by_id("test-uuid-1").expect("Query failed");
        assert!(fetched.is_some());
        let fetched = fetched.unwrap();
        assert_eq!(fetched.name, "Company Frontend");
        assert_eq!(fetched.environment, Environment::Windows);
        assert_eq!(fetched.expected_port, Some(3000));
        assert!(fetched.enabled);
    }

    #[test]
    fn test_wsl_profile_crud() {
        let repo = setup_test_repo();

        let profile = ServerProfile {
            id: "wsl-uuid-2".to_string(),
            name: "Company API".to_string(),
            description: None,
            environment: Environment::wsl("Fedora"),
            working_directory: "/home/dev/api".to_string(),
            command: "npm run dev".to_string(),
            expected_port: Some(5000),
            expected_host: None,
            enabled: true,
            created_at: "2026-08-22T20:00:00Z".to_string(),
            updated_at: "2026-08-22T20:00:00Z".to_string(),
        };

        repo.create(&profile).expect("Failed to create WSL profile");

        let fetched = repo.get_by_id("wsl-uuid-2").expect("Query failed").unwrap();
        assert_eq!(fetched.environment, Environment::Wsl { distro: "Fedora".to_string() });
        assert_eq!(fetched.expected_port, Some(5000));

        // Update profile
        let mut updated = fetched.clone();
        updated.command = "npm run start:dev".to_string();
        updated.expected_port = Some(5001);
        repo.update(&updated).expect("Update failed");

        let refetched = repo.get_by_id("wsl-uuid-2").expect("Query failed").unwrap();
        assert_eq!(refetched.command, "npm run start:dev");
        assert_eq!(refetched.expected_port, Some(5001));

        // Delete profile
        let deleted = repo.delete("wsl-uuid-2").expect("Delete failed");
        assert!(deleted);

        let after_delete = repo.get_by_id("wsl-uuid-2").expect("Query failed");
        assert!(after_delete.is_none());
    }

    #[test]
    fn test_list_all_and_count() {
        let repo = setup_test_repo();

        assert_eq!(repo.count().unwrap(), 0);

        let p1 = ServerProfile {
            id: "p1".to_string(),
            name: "B Service".to_string(),
            description: None,
            environment: Environment::windows(),
            working_directory: "C:\\b".to_string(),
            command: "cargo run".to_string(),
            expected_port: Some(8080),
            expected_host: None,
            enabled: true,
            created_at: "2026-08-22T20:00:00Z".to_string(),
            updated_at: "2026-08-22T20:00:00Z".to_string(),
        };

        let p2 = ServerProfile {
            id: "p2".to_string(),
            name: "A Service".to_string(),
            description: None,
            environment: Environment::windows(),
            working_directory: "C:\\a".to_string(),
            command: "cargo run".to_string(),
            expected_port: Some(8081),
            expected_host: None,
            enabled: true,
            created_at: "2026-08-22T20:00:00Z".to_string(),
            updated_at: "2026-08-22T20:00:00Z".to_string(),
        };

        repo.create(&p1).unwrap();
        repo.create(&p2).unwrap();

        assert_eq!(repo.count().unwrap(), 2);

        let list = repo.list_all().unwrap();
        assert_eq!(list.len(), 2);
        // Ordered by name ASC (A Service, then B Service)
        assert_eq!(list[0].name, "A Service");
        assert_eq!(list[1].name, "B Service");
    }
}
