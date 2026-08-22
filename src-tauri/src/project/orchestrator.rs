use crate::db::{ProjectRepository, ServerProfileRepository};
use crate::discovery::{UnifiedDiscovery, UnifiedDiscoveryService};
use crate::models::control::ProcessTarget;
use crate::models::environment::Environment;
use crate::models::project::{
    ProjectError, ProjectErrorCode, ProjectOperationResult, ProjectRuntimeStatus,
};
use crate::process::ProcessControlService;
use crate::profile::service::ServerProfileService;
use crate::profile::ServerStartService;
use crate::project::service::ProjectOperation;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::thread::sleep;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// Project-level workflow coordinator orchestrating sequential startup, safe Windows stop,
/// WSL boundary reporting, and Windows-only restart sequencing.
pub struct ProjectOrchestrator {
    project_repository: Arc<dyn ProjectRepository>,
    #[allow(dead_code)]
    profile_repository: Arc<dyn ServerProfileRepository>,
    start_service: Arc<ServerStartService>,
    process_control: Arc<ProcessControlService>,
    discovery: Arc<UnifiedDiscoveryService>,
    active_operations: Arc<Mutex<HashMap<String, ProjectOperation>>>,
}

impl ProjectOrchestrator {
    /// Creates a new `ProjectOrchestrator` with production dependencies.
    pub fn new(
        project_repository: Arc<dyn ProjectRepository>,
        profile_repository: Arc<dyn ServerProfileRepository>,
        start_service: Arc<ServerStartService>,
        process_control: Arc<ProcessControlService>,
        discovery: Arc<UnifiedDiscoveryService>,
    ) -> Self {
        Self {
            project_repository,
            profile_repository,
            start_service,
            process_control,
            discovery,
            active_operations: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Returns a cloned map of all currently in-flight project operations.
    pub fn get_active_operations(&self) -> HashMap<String, ProjectOperation> {
        self.active_operations
            .lock()
            .map(|ops| ops.clone())
            .unwrap_or_default()
    }

    /// Sequentially starts all member profiles in configured order.
    /// Implements fail-fast sequencing without automatic rollback.
    pub fn start_project(&self, project_id: &str) -> Result<ProjectOperationResult, ProjectError> {
        // Step 1: Verify project exists
        let project = self
            .project_repository
            .get_project_by_id(project_id)
            .map_err(|e| ProjectError {
                code: ProjectErrorCode::DatabaseError,
                message: format!("Failed to read project: {}", e),
                project_id: Some(project_id.to_string()),
            })?
            .ok_or_else(|| ProjectError {
                code: ProjectErrorCode::ProjectNotFound,
                message: format!("Project with ID '{}' was not found.", project_id),
                project_id: Some(project_id.to_string()),
            })?;

        // Step 2: Retrieve ordered member profiles
        let member_tuples = self
            .project_repository
            .get_project_profiles(project_id)
            .map_err(|e| ProjectError {
                code: ProjectErrorCode::DatabaseError,
                message: format!("Failed to read project profiles: {}", e),
                project_id: Some(project_id.to_string()),
            })?;

        if member_tuples.is_empty() {
            return Err(ProjectError {
                code: ProjectErrorCode::EmptyProject,
                message: "This project has no server profiles. Add a server profile before starting the project.".to_string(),
                project_id: Some(project_id.to_string()),
            });
        }

        // Step 3: Concurrency Guard — prevent duplicate project operation
        {
            let mut ops = self.active_operations.lock().map_err(|e| ProjectError {
                code: ProjectErrorCode::DatabaseError,
                message: format!("Failed to acquire operations lock: {}", e),
                project_id: Some(project_id.to_string()),
            })?;

            if ops.contains_key(project_id) {
                return Err(ProjectError {
                    code: ProjectErrorCode::ProjectOperationInProgress,
                    message: format!("An operation is already in progress for project '{}'.", project.name),
                    project_id: Some(project_id.to_string()),
                });
            }

            let initial_pending: Vec<String> = member_tuples
                .iter()
                .map(|(p, _)| p.name.clone())
                .collect();

            let op = ProjectOperation {
                operation_id: uuid::Uuid::new_v4().to_string(),
                project_id: project_id.to_string(),
                operation_type: "start".to_string(),
                current_profile_id: None,
                started_profiles: Vec::new(),
                stopped_profiles: Vec::new(),
                failed_profile: None,
                pending_profiles: initial_pending,
                started_at_ms: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64,
            };

            ops.insert(project_id.to_string(), op);
        }

        // Step 4: Execute sequential startup
        let mut started = Vec::new();
        let mut failed_name = None;
        let mut failed_err_msg = String::new();
        let mut pending = Vec::new();

        for (i, (profile, _)) in member_tuples.iter().enumerate() {
            // Update operation tracking
            if let Ok(mut ops) = self.active_operations.lock() {
                if let Some(op) = ops.get_mut(project_id) {
                    op.current_profile_id = Some(profile.id.clone());
                    op.pending_profiles = member_tuples[i..]
                        .iter()
                        .map(|(p, _)| p.name.clone())
                        .collect();
                }
            }

            // Start individual profile via ServerStartService
            match self.start_service.start_profile(&profile.id) {
                Ok(_result) => {
                    started.push(profile.name.clone());
                    if let Ok(mut ops) = self.active_operations.lock() {
                        if let Some(op) = ops.get_mut(project_id) {
                            op.started_profiles.push(profile.name.clone());
                        }
                    }
                }
                Err(err) => {
                    // Fail-fast policy: Terminate remaining startup sequence
                    failed_name = Some(profile.name.clone());
                    failed_err_msg = err.message.clone();

                    // Remaining profiles are marked pending/not started
                    for (remaining_profile, _) in &member_tuples[i + 1..] {
                        pending.push(remaining_profile.name.clone());
                    }
                    break;
                }
            }
        }

        // Step 5: Clean up active operation lock
        if let Ok(mut ops) = self.active_operations.lock() {
            ops.remove(project_id);
        }

        // Step 6: Construct structured result
        if let Some(failed_prof) = failed_name {
            Ok(ProjectOperationResult {
                project_id: project_id.to_string(),
                operation_type: "start".to_string(),
                status: ProjectRuntimeStatus::Error,
                started_profiles: started,
                stopped_profiles: vec![],
                failed_profile: Some(failed_prof.clone()),
                pending_profiles: pending,
                unsupported_profiles: vec![],
                message: format!(
                    "Project start halted because '{}' failed: {}",
                    failed_prof, failed_err_msg
                ),
            })
        } else {
            Ok(ProjectOperationResult {
                project_id: project_id.to_string(),
                operation_type: "start".to_string(),
                status: ProjectRuntimeStatus::Running,
                started_profiles: started,
                stopped_profiles: vec![],
                failed_profile: None,
                pending_profiles: vec![],
                unsupported_profiles: vec![],
                message: format!("All {} services in '{}' started successfully.", member_tuples.len(), project.name),
            })
        }
    }

    /// Stops all running member services.
    /// Windows services are stopped safely using `ProcessControlService`.
    /// WSL services report unsupported status accurately, setting project status to Partial.
    pub fn stop_project(&self, project_id: &str) -> Result<ProjectOperationResult, ProjectError> {
        let project = self
            .project_repository
            .get_project_by_id(project_id)
            .map_err(|e| ProjectError {
                code: ProjectErrorCode::DatabaseError,
                message: format!("Failed to read project: {}", e),
                project_id: Some(project_id.to_string()),
            })?
            .ok_or_else(|| ProjectError {
                code: ProjectErrorCode::ProjectNotFound,
                message: format!("Project with ID '{}' was not found.", project_id),
                project_id: Some(project_id.to_string()),
            })?;

        let member_tuples = self
            .project_repository
            .get_project_profiles(project_id)
            .map_err(|e| ProjectError {
                code: ProjectErrorCode::DatabaseError,
                message: format!("Failed to read project profiles: {}", e),
                project_id: Some(project_id.to_string()),
            })?;

        if member_tuples.is_empty() {
            return Err(ProjectError {
                code: ProjectErrorCode::EmptyProject,
                message: "This project has no server profiles.".to_string(),
                project_id: Some(project_id.to_string()),
            });
        }

        // Concurrency Guard
        {
            let mut ops = self.active_operations.lock().map_err(|e| ProjectError {
                code: ProjectErrorCode::DatabaseError,
                message: format!("Failed to acquire operations lock: {}", e),
                project_id: Some(project_id.to_string()),
            })?;

            if ops.contains_key(project_id) {
                return Err(ProjectError {
                    code: ProjectErrorCode::ProjectOperationInProgress,
                    message: format!("An operation is already in progress for project '{}'.", project.name),
                    project_id: Some(project_id.to_string()),
                });
            }

            let op = ProjectOperation {
                operation_id: uuid::Uuid::new_v4().to_string(),
                project_id: project_id.to_string(),
                operation_type: "stop".to_string(),
                current_profile_id: None,
                started_profiles: Vec::new(),
                stopped_profiles: Vec::new(),
                failed_profile: None,
                pending_profiles: Vec::new(),
                started_at_ms: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64,
            };

            ops.insert(project_id.to_string(), op);
        }

        let snapshot = self.discovery.discover_all().unwrap_or_default();
        let mut stopped = Vec::new();
        let mut unsupported = Vec::new();
        let mut failed_name = None;
        let mut failed_msg = String::new();

        // Process in reverse start order for clean teardown
        for (profile, _) in member_tuples.iter().rev() {
            if let Some((proc, _port)) = ServerProfileService::find_matching_process(
                profile,
                &snapshot.processes,
                &snapshot.ports,
            ) {
                match &profile.environment {
                    Environment::Windows => {
                        let target = ProcessTarget {
                            pid: proc.pid,
                            process_name: proc.name.clone(),
                            executable_path: proc.executable_path.clone(),
                            working_directory: proc.working_directory.clone(),
                            expected_ports: profile.expected_port.into_iter().collect(),
                            force: false,
                            environment: Some(profile.environment.clone()),
                        };

                        match self.process_control.stop_server(&target) {
                            Ok(_) => {
                                stopped.push(profile.name.clone());
                            }
                            Err(e) => {
                                failed_name = Some(profile.name.clone());
                                failed_msg = e.message;
                            }
                        }
                    }
                    Environment::Wsl { distro } => {
                        // WSL stop is unsupported in Milestone 6/7/8/9
                        unsupported.push(format!("{} (WSL / {})", profile.name, distro));
                    }
                }
            } else {
                // Profile is already stopped
                stopped.push(profile.name.clone());
            }
        }

        // Cleanup lock
        if let Ok(mut ops) = self.active_operations.lock() {
            ops.remove(project_id);
        }

        if let Some(failed_prof) = failed_name {
            Ok(ProjectOperationResult {
                project_id: project_id.to_string(),
                operation_type: "stop".to_string(),
                status: ProjectRuntimeStatus::Error,
                started_profiles: vec![],
                stopped_profiles: stopped,
                failed_profile: Some(failed_prof.clone()),
                pending_profiles: vec![],
                unsupported_profiles: unsupported,
                message: format!("Failed to stop '{}': {}", failed_prof, failed_msg),
            })
        } else if !unsupported.is_empty() {
            Ok(ProjectOperationResult {
                project_id: project_id.to_string(),
                operation_type: "stop".to_string(),
                status: ProjectRuntimeStatus::Partial,
                started_profiles: vec![],
                stopped_profiles: stopped,
                failed_profile: None,
                pending_profiles: vec![],
                unsupported_profiles: unsupported.clone(),
                message: format!(
                    "Windows services stopped. The following WSL services remain active because WSL process control is not available yet: {}.",
                    unsupported.join(", ")
                ),
            })
        } else {
            Ok(ProjectOperationResult {
                project_id: project_id.to_string(),
                operation_type: "stop".to_string(),
                status: ProjectRuntimeStatus::Stopped,
                started_profiles: vec![],
                stopped_profiles: stopped,
                failed_profile: None,
                pending_profiles: vec![],
                unsupported_profiles: vec![],
                message: format!("All services in '{}' have been stopped.", project.name),
            })
        }
    }

    /// Restarts a project by stopping running services, waiting for port release,
    /// and starting services again in order.
    /// Strictly rejects projects containing WSL services with a clear error.
    pub fn restart_project(&self, project_id: &str) -> Result<ProjectOperationResult, ProjectError> {
        let member_tuples = self
            .project_repository
            .get_project_profiles(project_id)
            .map_err(|e| ProjectError {
                code: ProjectErrorCode::DatabaseError,
                message: format!("Failed to read project profiles: {}", e),
                project_id: Some(project_id.to_string()),
            })?;

        if member_tuples.is_empty() {
            return Err(ProjectError {
                code: ProjectErrorCode::EmptyProject,
                message: "This project has no server profiles.".to_string(),
                project_id: Some(project_id.to_string()),
            });
        }

        // Guard: Check for WSL services
        let has_wsl = member_tuples.iter().any(|(p, _)| p.environment.is_wsl());
        if has_wsl {
            return Err(ProjectError {
                code: ProjectErrorCode::UnsupportedOperation,
                message: "Restart is unavailable for this project because one or more services run in WSL where process termination is restricted.".to_string(),
                project_id: Some(project_id.to_string()),
            });
        }

        // Step 1: Stop running services
        let stop_result = self.stop_project(project_id)?;
        if stop_result.status == ProjectRuntimeStatus::Error {
            return Ok(stop_result);
        }

        // Settle delay for OS socket release
        sleep(Duration::from_millis(500));

        // Step 2: Start services in configured order
        self.start_project(project_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::repository::SqliteServerProfileRepository;
    use crate::db::MigrationRunner;
    use crate::discovery::{PortDiscovery, ProcessDiscovery};
    use crate::models::{PortInfo, ProcessInfo, ServerProfile};
    use crate::windows::{ProcessController, ProcessHandle};
    use rusqlite::Connection;
    use std::sync::Mutex;

    struct MockProcDiscovery {
        procs: Mutex<Vec<ProcessInfo>>,
    }
    impl ProcessDiscovery for MockProcDiscovery {
        fn enumerate(&self) -> Result<Vec<ProcessInfo>, String> {
            Ok(self.procs.lock().unwrap().clone())
        }
    }

    struct MockPortDiscovery {
        ports: Mutex<Vec<PortInfo>>,
    }
    impl PortDiscovery for MockPortDiscovery {
        fn enumerate(&self) -> Result<Vec<PortInfo>, String> {
            Ok(self.ports.lock().unwrap().clone())
        }
    }

    struct MockProcCtrl {
        alive: Mutex<bool>,
    }
    impl ProcessController for MockProcCtrl {
        fn open_process(&self, pid: u32, _desired_access: u32) -> Result<ProcessHandle, u32> {
            Ok(ProcessHandle::new(0x1111 as *mut std::ffi::c_void, pid))
        }
        fn terminate_process(&self, _handle: &ProcessHandle, _exit_code: u32) -> Result<(), u32> {
            *self.alive.lock().unwrap() = false;
            Ok(())
        }
        fn wait_for_exit(&self, _handle: &ProcessHandle, _timeout_ms: u32) -> Result<bool, u32> {
            Ok(!*self.alive.lock().unwrap())
        }
        fn is_process_alive(&self, pid: u32) -> bool {
            if pid == 0 || pid == 4 {
                true
            } else {
                *self.alive.lock().unwrap()
            }
        }
    }

    fn setup_test_orchestrator() -> (ProjectOrchestrator, Arc<SqliteServerProfileRepository>) {
        let mut conn = Connection::open_in_memory().unwrap();
        MigrationRunner::run_migrations(&mut conn).unwrap();
        let repo = Arc::new(SqliteServerProfileRepository::new(Arc::new(Mutex::new(conn))));

        let proc_disc = Arc::new(MockProcDiscovery { procs: Mutex::new(vec![]) });
        let port_disc = Arc::new(MockPortDiscovery { ports: Mutex::new(vec![]) });
        let proc_ctrl = Arc::new(MockProcCtrl { alive: Mutex::new(true) });

        let control_svc = Arc::new(ProcessControlService::with_dependencies(
            proc_disc.clone(),
            port_disc.clone(),
            proc_ctrl,
        ));

        let unified_discovery = Arc::new(UnifiedDiscoveryService::with_adapters(
            proc_disc,
            port_disc,
            Arc::new(crate::wsl::distro::DefaultWslDistroDiscovery::new()),
            Arc::new(crate::wsl::process::DefaultWslProcessDiscovery::new()),
            Arc::new(crate::wsl::port::DefaultWslPortDiscovery::new()),
            Arc::new(crate::identity::ProcessIdentityService::new()),
        ));

        let start_svc = Arc::new(ServerStartService::with_custom_timeouts(
            repo.clone(),
            unified_discovery.clone(),
            control_svc.clone(),
            1000,
            100,
        ));

        let orchestrator = ProjectOrchestrator::new(
            repo.clone(),
            repo.clone(),
            start_svc,
            control_svc,
            unified_discovery,
        );

        (orchestrator, repo)
    }

    #[test]
    fn test_empty_project_start_rejected() {
        let (orch, repo) = setup_test_orchestrator();

        let proj = crate::models::project::Project {
            id: "empty-proj".to_string(),
            name: "Empty Project".to_string(),
            description: None,
            created_at: "2026-08-22T20:00:00Z".to_string(),
            updated_at: "2026-08-22T20:00:00Z".to_string(),
        };
        repo.create_project(&proj).unwrap();

        let err = orch.start_project("empty-proj").unwrap_err();
        assert_eq!(err.code, ProjectErrorCode::EmptyProject);
    }

    #[test]
    fn test_restart_with_wsl_is_rejected() {
        let (orch, repo) = setup_test_orchestrator();

        let proj = crate::models::project::Project {
            id: "mixed-proj".to_string(),
            name: "Mixed Project".to_string(),
            description: None,
            created_at: "2026-08-22T20:00:00Z".to_string(),
            updated_at: "2026-08-22T20:00:00Z".to_string(),
        };
        repo.create_project(&proj).unwrap();

        let wsl_profile = ServerProfile {
            id: "wsl-worker".to_string(),
            name: "WSL Worker".to_string(),
            description: None,
            environment: Environment::wsl("Fedora"),
            working_directory: "/home/dev/worker".to_string(),
            command: "npm start".to_string(),
            expected_port: None,
            expected_host: None,
            enabled: true,
            created_at: "2026-08-22T20:00:00Z".to_string(),
            updated_at: "2026-08-22T20:00:00Z".to_string(),
        };
        repo.create(&wsl_profile).unwrap();
        repo.add_profile_to_project("mixed-proj", "wsl-worker", None).unwrap();

        let err = orch.restart_project("mixed-proj").unwrap_err();
        assert_eq!(err.code, ProjectErrorCode::UnsupportedOperation);
        assert!(err.message.contains("WSL where process termination is restricted"));
    }
}
