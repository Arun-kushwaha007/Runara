use crate::models::environment::Environment;
use crate::models::profile::ServerProfile;
use crate::models::project::Project;
use chrono::Utc;
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

/// Trait defining persistent storage operations for Projects and Project-Profile relationships.
pub trait ProjectRepository: Send + Sync {
    /// Inserts a new Project record into storage.
    fn create_project(&self, project: &Project) -> Result<Project, String>;

    /// Retrieves an individual Project by its unique UUID string.
    fn get_project_by_id(&self, id: &str) -> Result<Option<Project>, String>;

    /// Lists all saved Project records ordered by name.
    fn list_projects(&self) -> Result<Vec<Project>, String>;

    /// Updates an existing Project record. Returns error if not found.
    fn update_project(&self, project: &Project) -> Result<Project, String>;

    /// Deletes a Project by ID. Cascade deletes relationship rows. Returns true if removed, false if not found.
    fn delete_project(&self, id: &str) -> Result<bool, String>;

    /// Adds a profile to a project with an optional explicit order_index.
    /// Reindexes profiles to keep ordering 0-based and gapless.
    fn add_profile_to_project(
        &self,
        project_id: &str,
        profile_id: &str,
        order_index: Option<i32>,
    ) -> Result<(), String>;

    /// Removes a profile from a project without deleting the profile itself.
    /// Reindexes remaining profiles to keep ordering 0-based and gapless.
    fn remove_profile_from_project(&self, project_id: &str, profile_id: &str) -> Result<bool, String>;

    /// Retrieves all profiles assigned to a project ordered by `order_index` ASC.
    fn get_project_profiles(&self, project_id: &str) -> Result<Vec<(ServerProfile, i32)>, String>;

    /// Reorders profiles in a project according to the supplied slice of profile IDs.
    fn reorder_project_profiles(&self, project_id: &str, profile_ids: &[String]) -> Result<(), String>;

    /// Finds the Project that a specific ServerProfile currently belongs to (if any).
    fn get_project_for_profile(&self, profile_id: &str) -> Result<Option<Project>, String>;

    /// Returns the total count of saved projects.
    fn count_projects(&self) -> Result<usize, String>;
}

/// Thread-safe SQLite implementation of `ServerProfileRepository` and `ProjectRepository`.
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

    /// Helper to convert a database row into a `Project` domain struct.
    fn row_to_project(row: &Row) -> rusqlite::Result<Project> {
        let id: String = row.get("id")?;
        let name: String = row.get("name")?;
        let description: Option<String> = row.get("description")?;
        let created_at: String = row.get("created_at")?;
        let updated_at: String = row.get("updated_at")?;

        Ok(Project {
            id,
            name,
            description,
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

impl ProjectRepository for SqliteServerProfileRepository {
    fn create_project(&self, project: &Project) -> Result<Project, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        conn.execute(
            r#"
            INSERT INTO projects (id, name, description, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5)
            "#,
            params![
                project.id,
                project.name,
                project.description,
                project.created_at,
                project.updated_at,
            ],
        )
        .map_err(|e| format!("Failed to insert project: {}", e))?;

        Ok(project.clone())
    }

    fn get_project_by_id(&self, id: &str) -> Result<Option<Project>, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        let mut stmt = conn
            .prepare("SELECT id, name, description, created_at, updated_at FROM projects WHERE id = ?1")
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let project = stmt
            .query_row(params![id], Self::row_to_project)
            .optional()
            .map_err(|e| format!("Failed to query project {}: {}", id, e))?;

        Ok(project)
    }

    fn list_projects(&self) -> Result<Vec<Project>, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        let mut stmt = conn
            .prepare("SELECT id, name, description, created_at, updated_at FROM projects ORDER BY name COLLATE NOCASE ASC")
            .map_err(|e| format!("Failed to prepare list projects query: {}", e))?;

        let rows = stmt
            .query_map([], Self::row_to_project)
            .map_err(|e| format!("Failed to execute list projects query: {}", e))?;

        let mut projects = Vec::new();
        for r in rows {
            let p = r.map_err(|e| format!("Failed to parse project row: {}", e))?;
            projects.push(p);
        }

        Ok(projects)
    }

    fn update_project(&self, project: &Project) -> Result<Project, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        let affected = conn
            .execute(
                r#"
                UPDATE projects
                SET name = ?2, description = ?3, updated_at = ?4
                WHERE id = ?1
                "#,
                params![
                    project.id,
                    project.name,
                    project.description,
                    project.updated_at,
                ],
            )
            .map_err(|e| format!("Failed to update project: {}", e))?;

        if affected == 0 {
            return Err(format!("Project with ID '{}' does not exist.", project.id));
        }

        Ok(project.clone())
    }

    fn delete_project(&self, id: &str) -> Result<bool, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        let affected = conn
            .execute("DELETE FROM projects WHERE id = ?1", params![id])
            .map_err(|e| format!("Failed to delete project {}: {}", id, e))?;

        Ok(affected > 0)
    }

    fn add_profile_to_project(
        &self,
        project_id: &str,
        profile_id: &str,
        order_index: Option<i32>,
    ) -> Result<(), String> {
        let mut conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        let tx = conn
            .transaction()
            .map_err(|e| format!("Failed to start transaction: {}", e))?;

        // 1. Remove profile from any project it currently belongs to (atomic move / upsert)
        tx.execute(
            "DELETE FROM project_profiles WHERE profile_id = ?1",
            params![profile_id],
        )
        .map_err(|e| format!("Failed to clear existing profile membership: {}", e))?;

        // 2. Fetch existing profile IDs in current project ordered by order_index ASC
        let mut existing_profile_ids: Vec<String> = {
            let mut stmt = tx
                .prepare("SELECT profile_id FROM project_profiles WHERE project_id = ?1 ORDER BY order_index ASC")
                .map_err(|e| format!("Failed to query project profiles: {}", e))?;
            let rows = stmt
                .query_map(params![project_id], |r| r.get::<_, String>(0))
                .map_err(|e| format!("Failed to read project profiles: {}", e))?;
            let mut ids = Vec::new();
            for r in rows {
                ids.push(r.map_err(|e| format!("Error reading profile_id: {}", e))?);
            }
            ids
        };

        // 3. Insert the new profile ID at the desired index (or append at the end)
        let insert_idx = match order_index {
            Some(idx) if idx >= 0 => (idx as usize).min(existing_profile_ids.len()),
            _ => existing_profile_ids.len(),
        };
        existing_profile_ids.insert(insert_idx, profile_id.to_string());

        // 4. Clean existing rows for project and re-insert in exact 0-based gapless order
        tx.execute(
            "DELETE FROM project_profiles WHERE project_id = ?1",
            params![project_id],
        )
        .map_err(|e| format!("Failed to clear project rows for re-indexing: {}", e))?;

        let now = Utc::now().to_rfc3339();
        for (idx, pid) in existing_profile_ids.iter().enumerate() {
            tx.execute(
                r#"
                INSERT INTO project_profiles (project_id, profile_id, order_index, created_at)
                VALUES (?1, ?2, ?3, ?4)
                "#,
                params![project_id, pid, idx as i32, now],
            )
            .map_err(|e| format!("Failed to insert project profile at index {}: {}", idx, e))?;
        }

        tx.commit()
            .map_err(|e| format!("Failed to commit add_profile_to_project: {}", e))?;

        Ok(())
    }

    fn remove_profile_from_project(&self, project_id: &str, profile_id: &str) -> Result<bool, String> {
        let mut conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        let tx = conn
            .transaction()
            .map_err(|e| format!("Failed to start transaction: {}", e))?;

        let affected = tx
            .execute(
                "DELETE FROM project_profiles WHERE project_id = ?1 AND profile_id = ?2",
                params![project_id, profile_id],
            )
            .map_err(|e| format!("Failed to remove profile from project: {}", e))?;

        if affected > 0 {
            // Re-index remaining profiles gaplessly
            let remaining_ids: Vec<String> = {
                let mut stmt = tx
                    .prepare("SELECT profile_id FROM project_profiles WHERE project_id = ?1 ORDER BY order_index ASC")
                    .map_err(|e| format!("Failed to prepare query: {}", e))?;
                let rows = stmt
                    .query_map(params![project_id], |r| r.get::<_, String>(0))
                    .map_err(|e| format!("Failed to read profiles: {}", e))?;
                let mut ids = Vec::new();
                for r in rows {
                    ids.push(r.map_err(|e| format!("Error reading profile_id: {}", e))?);
                }
                ids
            };

            for (idx, pid) in remaining_ids.iter().enumerate() {
                tx.execute(
                    "UPDATE project_profiles SET order_index = ?1 WHERE project_id = ?2 AND profile_id = ?3",
                    params![idx as i32, project_id, pid],
                )
                .map_err(|e| format!("Failed to update order_index: {}", e))?;
            }
        }

        tx.commit()
            .map_err(|e| format!("Failed to commit remove_profile_from_project: {}", e))?;

        Ok(affected > 0)
    }

    fn get_project_profiles(&self, project_id: &str) -> Result<Vec<(ServerProfile, i32)>, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        let mut stmt = conn
            .prepare(
                r#"
                SELECT sp.id, sp.name, sp.description, sp.environment_type, sp.distribution,
                       sp.working_directory, sp.command, sp.expected_port, sp.expected_host,
                       sp.enabled, sp.created_at, sp.updated_at, pp.order_index
                FROM project_profiles pp
                INNER JOIN server_profiles sp ON pp.profile_id = sp.id
                WHERE pp.project_id = ?1
                ORDER BY pp.order_index ASC
                "#,
            )
            .map_err(|e| format!("Failed to prepare get_project_profiles query: {}", e))?;

        let rows = stmt
            .query_map(params![project_id], |row| {
                let profile = Self::row_to_profile(row)?;
                let order_index: i32 = row.get("order_index")?;
                Ok((profile, order_index))
            })
            .map_err(|e| format!("Failed to query project profiles: {}", e))?;

        let mut result = Vec::new();
        for r in rows {
            result.push(r.map_err(|e| format!("Failed to read project profile: {}", e))?);
        }

        Ok(result)
    }

    fn reorder_project_profiles(&self, project_id: &str, profile_ids: &[String]) -> Result<(), String> {
        let mut conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        let tx = conn
            .transaction()
            .map_err(|e| format!("Failed to start transaction: {}", e))?;

        for (idx, pid) in profile_ids.iter().enumerate() {
            let affected = tx
                .execute(
                    "UPDATE project_profiles SET order_index = ?1 WHERE project_id = ?2 AND profile_id = ?3",
                    params![idx as i32, project_id, pid],
                )
                .map_err(|e| format!("Failed to reorder profile {}: {}", pid, e))?;

            if affected == 0 {
                return Err(format!(
                    "Profile with ID '{}' does not belong to project '{}'.",
                    pid, project_id
                ));
            }
        }

        tx.commit()
            .map_err(|e| format!("Failed to commit reorder_project_profiles: {}", e))?;

        Ok(())
    }

    fn get_project_for_profile(&self, profile_id: &str) -> Result<Option<Project>, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        let mut stmt = conn
            .prepare(
                r#"
                SELECT p.id, p.name, p.description, p.created_at, p.updated_at
                FROM projects p
                INNER JOIN project_profiles pp ON p.id = pp.project_id
                WHERE pp.profile_id = ?1
                "#,
            )
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let project = stmt
            .query_row(params![profile_id], Self::row_to_project)
            .optional()
            .map_err(|e| format!("Failed to query project for profile {}: {}", profile_id, e))?;

        Ok(project)
    }

    fn count_projects(&self) -> Result<usize, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM projects", [], |r| r.get(0))
            .map_err(|e| format!("Failed to count projects: {}", e))?;

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

    #[test]
    fn test_project_crud() {
        let repo = setup_test_repo();

        assert_eq!(repo.count_projects().unwrap(), 0);

        let project = Project {
            id: "proj-1".to_string(),
            name: "Company Platform".to_string(),
            description: Some("Core developer platform".to_string()),
            created_at: "2026-08-22T20:00:00Z".to_string(),
            updated_at: "2026-08-22T20:00:00Z".to_string(),
        };

        let created = repo.create_project(&project).expect("Create project failed");
        assert_eq!(created.name, "Company Platform");
        assert_eq!(repo.count_projects().unwrap(), 1);

        let fetched = repo.get_project_by_id("proj-1").unwrap();
        assert!(fetched.is_some());
        let fetched = fetched.unwrap();
        assert_eq!(fetched.name, "Company Platform");
        assert_eq!(fetched.description, Some("Core developer platform".to_string()));

        // Update
        let mut updated = fetched.clone();
        updated.name = "Company Platform v2".to_string();
        updated.updated_at = "2026-08-22T21:00:00Z".to_string();
        repo.update_project(&updated).unwrap();

        let refetched = repo.get_project_by_id("proj-1").unwrap().unwrap();
        assert_eq!(refetched.name, "Company Platform v2");

        // Delete
        let deleted = repo.delete_project("proj-1").unwrap();
        assert!(deleted);
        assert_eq!(repo.count_projects().unwrap(), 0);
    }

    #[test]
    fn test_project_profile_membership_and_ordering() {
        let repo = setup_test_repo();

        let proj = Project {
            id: "proj-order".to_string(),
            name: "Ordering Project".to_string(),
            description: None,
            created_at: "2026-08-22T20:00:00Z".to_string(),
            updated_at: "2026-08-22T20:00:00Z".to_string(),
        };
        repo.create_project(&proj).unwrap();

        // Create 3 server profiles
        for i in 1..=3 {
            let p = ServerProfile {
                id: format!("prof-{}", i),
                name: format!("Service {}", i),
                description: None,
                environment: Environment::windows(),
                working_directory: format!("C:\\app{}", i),
                command: "npm start".to_string(),
                expected_port: Some(3000 + i as u16),
                expected_host: None,
                enabled: true,
                created_at: "2026-08-22T20:00:00Z".to_string(),
                updated_at: "2026-08-22T20:00:00Z".to_string(),
            };
            repo.create(&p).unwrap();
        }

        // Add profiles in order: prof-1 (order 0), prof-2 (order 1), prof-3 (order 2)
        repo.add_profile_to_project("proj-order", "prof-1", None).unwrap();
        repo.add_profile_to_project("proj-order", "prof-2", None).unwrap();
        repo.add_profile_to_project("proj-order", "prof-3", None).unwrap();

        let member_profiles = repo.get_project_profiles("proj-order").unwrap();
        assert_eq!(member_profiles.len(), 3);
        assert_eq!(member_profiles[0].0.id, "prof-1");
        assert_eq!(member_profiles[0].1, 0);
        assert_eq!(member_profiles[1].0.id, "prof-2");
        assert_eq!(member_profiles[1].1, 1);
        assert_eq!(member_profiles[2].0.id, "prof-3");
        assert_eq!(member_profiles[2].1, 2);

        // Reorder profiles: [prof-3, prof-1, prof-2]
        repo.reorder_project_profiles(
            "proj-order",
            &["prof-3".to_string(), "prof-1".to_string(), "prof-2".to_string()],
        ).unwrap();

        let reordered = repo.get_project_profiles("proj-order").unwrap();
        assert_eq!(reordered[0].0.id, "prof-3");
        assert_eq!(reordered[0].1, 0);
        assert_eq!(reordered[1].0.id, "prof-1");
        assert_eq!(reordered[1].1, 1);
        assert_eq!(reordered[2].0.id, "prof-2");
        assert_eq!(reordered[2].1, 2);

        // Remove prof-1 (middle element) -> remaining [prof-3, prof-2] must reindex to 0, 1
        repo.remove_profile_from_project("proj-order", "prof-1").unwrap();
        let remaining = repo.get_project_profiles("proj-order").unwrap();
        assert_eq!(remaining.len(), 2);
        assert_eq!(remaining[0].0.id, "prof-3");
        assert_eq!(remaining[0].1, 0);
        assert_eq!(remaining[1].0.id, "prof-2");
        assert_eq!(remaining[1].1, 1);

        // Verify prof-1 was NOT deleted from server_profiles
        let prof1_still_exists = repo.get_by_id("prof-1").unwrap();
        assert!(prof1_still_exists.is_some());
    }

    #[test]
    fn test_move_profile_between_projects_and_delete_project_safety() {
        let repo = setup_test_repo();

        let p1 = Project {
            id: "proj-a".to_string(),
            name: "Project A".to_string(),
            description: None,
            created_at: "2026-08-22T20:00:00Z".to_string(),
            updated_at: "2026-08-22T20:00:00Z".to_string(),
        };
        let p2 = Project {
            id: "proj-b".to_string(),
            name: "Project B".to_string(),
            description: None,
            created_at: "2026-08-22T20:00:00Z".to_string(),
            updated_at: "2026-08-22T20:00:00Z".to_string(),
        };
        repo.create_project(&p1).unwrap();
        repo.create_project(&p2).unwrap();

        let profile = ServerProfile {
            id: "prof-shared".to_string(),
            name: "Backend Service".to_string(),
            description: None,
            environment: Environment::windows(),
            working_directory: "C:\\backend".to_string(),
            command: "npm start".to_string(),
            expected_port: Some(5000),
            expected_host: None,
            enabled: true,
            created_at: "2026-08-22T20:00:00Z".to_string(),
            updated_at: "2026-08-22T20:00:00Z".to_string(),
        };
        repo.create(&profile).unwrap();

        // Add to Project A
        repo.add_profile_to_project("proj-a", "prof-shared", None).unwrap();
        assert_eq!(repo.get_project_for_profile("prof-shared").unwrap().unwrap().id, "proj-a");
        assert_eq!(repo.get_project_profiles("proj-a").unwrap().len(), 1);

        // Move to Project B (by adding to Project B)
        repo.add_profile_to_project("proj-b", "prof-shared", None).unwrap();
        assert_eq!(repo.get_project_for_profile("prof-shared").unwrap().unwrap().id, "proj-b");
        assert_eq!(repo.get_project_profiles("proj-a").unwrap().len(), 0);
        assert_eq!(repo.get_project_profiles("proj-b").unwrap().len(), 1);

        // Delete Project B -> profile must remain intact in server_profiles table
        repo.delete_project("proj-b").unwrap();
        assert!(repo.get_by_id("prof-shared").unwrap().is_some());
        assert!(repo.get_project_for_profile("prof-shared").unwrap().is_none());
    }
}

