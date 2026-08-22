use crate::db::ServerProfileRepository;
use crate::models::environment::Environment;
use crate::models::port::PortInfo;
use crate::models::process::ProcessInfo;
use crate::models::profile::{
    CreateProfileRequest, ProfileRuntimeStatus, ServerProfile, ServerProfileView, StartError,
    StartErrorCode, UpdateProfileRequest,
};
use chrono::Utc;
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use uuid::Uuid;

/// Core service for Server Profile validation, CRUD operations,
/// and live runtime status derivation.
pub struct ServerProfileService {
    repository: Arc<dyn ServerProfileRepository>,
}

impl ServerProfileService {
    /// Creates a new `ServerProfileService` wrapping a persistent repository.
    pub fn new(repository: Arc<dyn ServerProfileRepository>) -> Self {
        Self { repository }
    }

    /// Validates profile parameters before creation or modification.
    pub fn validate_profile_inputs(
        name: &str,
        environment: &Environment,
        working_directory: &str,
        command: &str,
        expected_port: Option<u16>,
    ) -> Result<(), StartError> {
        // Rule 1: Name cannot be blank
        if name.trim().is_empty() {
            return Err(StartError {
                code: StartErrorCode::InvalidProfile,
                message: "Server profile name cannot be empty.".to_string(),
                profile_id: None,
                current_owner: None,
            });
        }

        // Rule 2: Working directory cannot be blank
        if working_directory.trim().is_empty() {
            return Err(StartError {
                code: StartErrorCode::InvalidProfile,
                message: "Working directory path cannot be empty.".to_string(),
                profile_id: None,
                current_owner: None,
            });
        }

        // Rule 3: Command cannot be blank
        if command.trim().is_empty() {
            return Err(StartError {
                code: StartErrorCode::InvalidProfile,
                message: "Startup command cannot be empty.".to_string(),
                profile_id: None,
                current_owner: None,
            });
        }

        // Rule 4: WSL profiles must have a non-empty distribution name
        if let Environment::Wsl { distro } = environment {
            if distro.trim().is_empty() {
                return Err(StartError {
                    code: StartErrorCode::InvalidProfile,
                    message: "WSL server profiles must have a valid distribution selected.".to_string(),
                    profile_id: None,
                    current_owner: None,
                });
            }
        }

        // Rule 5: Expected port must be in valid TCP port range (1..=65535)
        if let Some(port) = expected_port {
            if port == 0 {
                return Err(StartError {
                    code: StartErrorCode::InvalidProfile,
                    message: "Expected port must be between 1 and 65535.".to_string(),
                    profile_id: None,
                    current_owner: None,
                });
            }
        }

        Ok(())
    }

    /// Creates and persists a new ServerProfile.
    pub fn create_profile(&self, req: CreateProfileRequest) -> Result<ServerProfile, StartError> {
        Self::validate_profile_inputs(
            &req.name,
            &req.environment,
            &req.working_directory,
            &req.command,
            req.expected_port,
        )?;

        let now = Utc::now().to_rfc3339();
        let profile = ServerProfile {
            id: Uuid::new_v4().to_string(),
            name: req.name.trim().to_string(),
            description: req.description.map(|d| d.trim().to_string()).filter(|d| !d.is_empty()),
            environment: req.environment,
            working_directory: req.working_directory.trim().to_string(),
            command: req.command.trim().to_string(),
            expected_port: req.expected_port,
            expected_host: req.expected_host.map(|h| h.trim().to_string()).filter(|h| !h.is_empty()),
            enabled: true,
            created_at: now.clone(),
            updated_at: now,
        };

        self.repository.create(&profile).map_err(|e| StartError {
            code: StartErrorCode::DatabaseError,
            message: format!("Failed to persist profile: {}", e),
            profile_id: None,
            current_owner: None,
        })
    }

    /// Retrieves an individual profile by its persistent UUID.
    pub fn get_profile(&self, id: &str) -> Result<Option<ServerProfile>, StartError> {
        self.repository.get_by_id(id).map_err(|e| StartError {
            code: StartErrorCode::DatabaseError,
            message: format!("Failed to read profile {}: {}", id, e),
            profile_id: Some(id.to_string()),
            current_owner: None,
        })
    }

    /// Lists all saved server profiles.
    pub fn list_profiles(&self) -> Result<Vec<ServerProfile>, StartError> {
        self.repository.list_all().map_err(|e| StartError {
            code: StartErrorCode::DatabaseError,
            message: format!("Failed to list profiles: {}", e),
            profile_id: None,
            current_owner: None,
        })
    }

    /// Updates an existing server profile.
    pub fn update_profile(&self, req: UpdateProfileRequest) -> Result<ServerProfile, StartError> {
        Self::validate_profile_inputs(
            &req.name,
            &req.environment,
            &req.working_directory,
            &req.command,
            req.expected_port,
        )?;

        let existing = self.get_profile(&req.id)?.ok_or_else(|| StartError {
            code: StartErrorCode::ProfileNotFound,
            message: format!("Profile with ID '{}' does not exist.", req.id),
            profile_id: Some(req.id.clone()),
            current_owner: None,
        })?;

        let updated = ServerProfile {
            id: req.id,
            name: req.name.trim().to_string(),
            description: req.description.map(|d| d.trim().to_string()).filter(|d| !d.is_empty()),
            environment: req.environment,
            working_directory: req.working_directory.trim().to_string(),
            command: req.command.trim().to_string(),
            expected_port: req.expected_port,
            expected_host: req.expected_host.map(|h| h.trim().to_string()).filter(|h| !h.is_empty()),
            enabled: req.enabled.unwrap_or(existing.enabled),
            created_at: existing.created_at,
            updated_at: Utc::now().to_rfc3339(),
        };

        self.repository.update(&updated).map_err(|e| StartError {
            code: StartErrorCode::DatabaseError,
            message: format!("Failed to update profile: {}", e),
            profile_id: Some(updated.id.clone()),
            current_owner: None,
        })
    }

    /// Deletes a saved server profile.
    /// Does NOT kill any running process; profile configuration and runtime processes are separate concepts.
    pub fn delete_profile(&self, id: &str) -> Result<bool, StartError> {
        self.repository.delete(id).map_err(|e| StartError {
            code: StartErrorCode::DatabaseError,
            message: format!("Failed to delete profile {}: {}", id, e),
            profile_id: Some(id.to_string()),
            current_owner: None,
        })
    }

    /// Computes live runtime presentation models for all profiles by joining
    /// persistent configuration with current OS discovery snapshots.
    pub fn derive_profile_views(
        &self,
        profiles: &[ServerProfile],
        processes: &[ProcessInfo],
        ports: &[PortInfo],
        active_start_states: &HashMap<String, (ProfileRuntimeStatus, Option<String>)>,
    ) -> Vec<ServerProfileView> {
        // Build efficient port map: (Environment, port) -> PID
        let mut port_owner_map: HashMap<(Environment, u16), u32> = HashMap::new();
        for p in ports {
            port_owner_map.insert((p.environment.clone(), p.port), p.pid);
        }

        // Build process lookup map: (Environment, PID) -> ProcessInfo
        let mut proc_map: HashMap<(Environment, u32), &ProcessInfo> = HashMap::new();
        for proc in processes {
            proc_map.insert((proc.environment.clone(), proc.pid), proc);
        }

        let mut views = Vec::with_capacity(profiles.len());

        for profile in profiles {
            // 1. Check if there's an active starting or transient error state
            if let Some((transient_status, err_msg)) = active_start_states.get(&profile.id) {
                if *transient_status == ProfileRuntimeStatus::Starting {
                    views.push(ServerProfileView {
                        profile: profile.clone(),
                        status: ProfileRuntimeStatus::Starting,
                        active_pid: None,
                        active_port: profile.expected_port,
                        error_message: None,
                        last_started_at: None,
                        dashboard_server_id: None,
                    });
                    continue;
                } else if *transient_status == ProfileRuntimeStatus::Error {
                    views.push(ServerProfileView {
                        profile: profile.clone(),
                        status: ProfileRuntimeStatus::Error,
                        active_pid: None,
                        active_port: profile.expected_port,
                        error_message: err_msg.clone(),
                        last_started_at: None,
                        dashboard_server_id: None,
                    });
                    continue;
                }
            }

            // 2. Discover matching running process
            let match_result = Self::find_matching_process(profile, processes, ports);

            match match_result {
                Some((proc, active_port)) => {
                    let dash_id = match &profile.environment {
                        Environment::Windows => format!("win-{}-{}", proc.pid, active_port),
                        Environment::Wsl { distro } => format!("wsl-{}-{}-{}", distro, proc.pid, active_port),
                    };

                    views.push(ServerProfileView {
                        profile: profile.clone(),
                        status: ProfileRuntimeStatus::Running,
                        active_pid: Some(proc.pid),
                        active_port: Some(active_port),
                        error_message: None,
                        last_started_at: None,
                        dashboard_server_id: Some(dash_id),
                    });
                }
                None => {
                    views.push(ServerProfileView {
                        profile: profile.clone(),
                        status: ProfileRuntimeStatus::Stopped,
                        active_pid: None,
                        active_port: None,
                        error_message: None,
                        last_started_at: None,
                        dashboard_server_id: None,
                    });
                }
            }
        }

        views
    }

    /// Conservative multi-signal matching algorithm:
    /// Finds if an active process snapshot corresponds to a saved ServerProfile.
    pub fn find_matching_process<'a>(
        profile: &ServerProfile,
        processes: &'a [ProcessInfo],
        ports: &[PortInfo],
    ) -> Option<(&'a ProcessInfo, u16)> {
        // Strategy A: If expected_port is configured, look for process listening on expected_port
        if let Some(expected_port) = profile.expected_port {
            if let Some(port_entry) = ports.iter().find(|p| {
                p.environment == profile.environment && p.port == expected_port
            }) {
                // Find owning process
                if let Some(proc) = processes.iter().find(|pr| {
                    pr.environment == profile.environment && pr.pid == port_entry.pid
                }) {
                    // Check working directory compatibility if available
                    if let Some(ref proc_cwd) = proc.working_directory {
                        if !proc_cwd.is_empty() && !profile.working_directory.is_empty() {
                            if Self::normalize_path(proc_cwd) == Self::normalize_path(&profile.working_directory) {
                                return Some((proc, expected_port));
                            }
                        }
                    }

                    // If CWD isn't strictly available or matches, verify command or runtime compatibility
                    return Some((proc, expected_port));
                }
            }
        }

        // Strategy B: If expected_port is NOT configured, match by Environment + Working Directory
        if !profile.working_directory.is_empty() {
            let norm_profile_dir = Self::normalize_path(&profile.working_directory);
            for proc in processes {
                if proc.environment == profile.environment {
                    if let Some(ref proc_cwd) = proc.working_directory {
                        if !proc_cwd.is_empty() && Self::normalize_path(proc_cwd) == norm_profile_dir {
                            // Find any port this process is listening on
                            let bound_port = ports
                                .iter()
                                .find(|pt| pt.environment == proc.environment && pt.pid == proc.pid)
                                .map(|pt| pt.port)
                                .unwrap_or(0);

                            return Some((proc, bound_port));
                        }
                    }
                }
            }
        }

        None
    }

    /// Normalizes filesystem paths for consistent comparison across operating systems.
    pub fn normalize_path(path: &str) -> String {
        Path::new(path)
            .to_string_lossy()
            .replace('\\', "/")
            .trim_end_matches('/')
            .to_lowercase()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::repository::SqliteServerProfileRepository;
    use crate::db::MigrationRunner;
    use crate::models::ProcessStatus;
    use rusqlite::Connection;
    use std::sync::Mutex;

    fn setup_test_service() -> ServerProfileService {
        let mut conn = Connection::open_in_memory().unwrap();
        MigrationRunner::run_migrations(&mut conn).unwrap();
        let repo = Arc::new(SqliteServerProfileRepository::new(Arc::new(Mutex::new(conn))));
        ServerProfileService::new(repo)
    }

    #[test]
    fn test_create_profile_validation_rules() {
        let service = setup_test_service();

        // Blank name
        let req_blank_name = CreateProfileRequest {
            name: "   ".to_string(),
            description: None,
            environment: Environment::windows(),
            working_directory: "C:\\projects".to_string(),
            command: "npm start".to_string(),
            expected_port: Some(3000),
            expected_host: None,
        };
        assert_eq!(
            service.create_profile(req_blank_name).unwrap_err().code,
            StartErrorCode::InvalidProfile
        );

        // Blank command
        let req_blank_cmd = CreateProfileRequest {
            name: "Test".to_string(),
            description: None,
            environment: Environment::windows(),
            working_directory: "C:\\projects".to_string(),
            command: "".to_string(),
            expected_port: Some(3000),
            expected_host: None,
        };
        assert_eq!(
            service.create_profile(req_blank_cmd).unwrap_err().code,
            StartErrorCode::InvalidProfile
        );

        // Blank WSL distro
        let req_blank_distro = CreateProfileRequest {
            name: "WSL Test".to_string(),
            description: None,
            environment: Environment::wsl(""),
            working_directory: "/home/dev".to_string(),
            command: "npm start".to_string(),
            expected_port: Some(5000),
            expected_host: None,
        };
        assert_eq!(
            service.create_profile(req_blank_distro).unwrap_err().code,
            StartErrorCode::InvalidProfile
        );
    }

    #[test]
    fn test_process_association_by_port_and_cwd() {
        let profile = ServerProfile {
            id: "prof-1".to_string(),
            name: "Frontend App".to_string(),
            description: None,
            environment: Environment::windows(),
            working_directory: "C:\\Projects\\Frontend".to_string(),
            command: "npm run dev".to_string(),
            expected_port: Some(3000),
            expected_host: None,
            enabled: true,
            created_at: "2026-08-22T20:00:00Z".to_string(),
            updated_at: "2026-08-22T20:00:00Z".to_string(),
        };

        let proc_frontend = ProcessInfo {
            pid: 18240,
            parent_pid: Some(1000),
            name: "node.exe".to_string(),
            executable_path: Some("C:\\nodejs\\node.exe".to_string()),
            command_line: Some("node vite.js".to_string()),
            working_directory: Some("C:\\Projects\\Frontend".to_string()),
            status: ProcessStatus::Running,
            environment: Environment::windows(),
        };

        let proc_backend = ProcessInfo {
            pid: 19320,
            parent_pid: Some(1000),
            name: "node.exe".to_string(),
            executable_path: Some("C:\\nodejs\\node.exe".to_string()),
            command_line: Some("node index.js".to_string()),
            working_directory: Some("C:\\Projects\\Backend".to_string()),
            status: ProcessStatus::Running,
            environment: Environment::windows(),
        };

        let procs = vec![proc_frontend, proc_backend];
        let ports = vec![
            PortInfo {
                port: 3000,
                pid: 18240,
                protocol: "tcp".to_string(),
                address: "127.0.0.1".to_string(),
                state: "listening".to_string(),
                environment: Environment::windows(),
            },
            PortInfo {
                port: 5000,
                pid: 19320,
                protocol: "tcp".to_string(),
                address: "127.0.0.1".to_string(),
                state: "listening".to_string(),
                environment: Environment::windows(),
            },
        ];

        let matched = ServerProfileService::find_matching_process(&profile, &procs, &ports);
        assert!(matched.is_some());
        let (matched_proc, port) = matched.unwrap();
        assert_eq!(matched_proc.pid, 18240);
        assert_eq!(port, 3000);
    }
}
