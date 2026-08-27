use crate::db::ServerProfileRepository;
use crate::discovery::{UnifiedDiscovery, UnifiedDiscoveryService};
use crate::launcher::{EnvironmentLauncher, WindowsLauncher, WslLauncher};
use crate::log::LogManager;
use crate::models::control::{ProcessTarget, RemainingOwnerInfo};
use crate::models::environment::Environment;
use crate::models::log::LogSource;
use crate::models::profile::{
    ProfileRuntimeStatus, StartError, StartErrorCode, StartProfileResult,
};

use crate::process::ProcessControlService;
use crate::profile::service::ServerProfileService;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::thread::sleep;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// Ephemeral record representing an active in-flight server start operation.
#[derive(Debug, Clone)]
pub struct StartOperation {
    pub operation_id: String,
    pub profile_id: String,
    pub started_at_ms: u64,
    pub environment: Environment,
    pub expected_port: Option<u16>,
    pub initial_pid: u32,
}

/// Orchestrates pre-start validation, port conflict checks, launcher dispatch,
/// bounded startup monitoring, process/port discovery correlation, and Windows restart sequencing.
pub struct ServerStartService {
    repository: Arc<dyn ServerProfileRepository>,
    discovery: Arc<UnifiedDiscoveryService>,
    process_control: Arc<ProcessControlService>,
    log_manager: Arc<LogManager>,
    active_operations: Arc<Mutex<HashMap<String, StartOperation>>>,
    recent_errors: Arc<Mutex<HashMap<String, (String, u64)>>>,
    /// Bounded timeout for startup polling in milliseconds (default 20,000ms / 20 seconds).
    startup_timeout_ms: u64,
    /// Polling tick interval in milliseconds (default 500ms).
    poll_interval_ms: u64,
}

impl ServerStartService {
    /// Creates a new `ServerStartService` with production dependencies.
    pub fn new(
        repository: Arc<dyn ServerProfileRepository>,
        discovery: Arc<UnifiedDiscoveryService>,
        process_control: Arc<ProcessControlService>,
    ) -> Self {
        Self {
            repository,
            discovery,
            process_control,
            log_manager: Arc::new(LogManager::new()),
            active_operations: Arc::new(Mutex::new(HashMap::new())),
            recent_errors: Arc::new(Mutex::new(HashMap::new())),
            startup_timeout_ms: 20_000,
            poll_interval_ms: 500,
        }
    }

    /// Creates a `ServerStartService` with an explicit LogManager.
    pub fn with_log_manager(
        repository: Arc<dyn ServerProfileRepository>,
        discovery: Arc<UnifiedDiscoveryService>,
        process_control: Arc<ProcessControlService>,
        log_manager: Arc<LogManager>,
    ) -> Self {
        Self {
            repository,
            discovery,
            process_control,
            log_manager,
            active_operations: Arc::new(Mutex::new(HashMap::new())),
            recent_errors: Arc::new(Mutex::new(HashMap::new())),
            startup_timeout_ms: 20_000,
            poll_interval_ms: 500,
        }
    }

    /// Creates a `ServerStartService` with custom timeouts for testing.
    pub fn with_custom_timeouts(
        repository: Arc<dyn ServerProfileRepository>,
        discovery: Arc<UnifiedDiscoveryService>,
        process_control: Arc<ProcessControlService>,
        startup_timeout_ms: u64,
        poll_interval_ms: u64,
    ) -> Self {
        Self {
            repository,
            discovery,
            process_control,
            log_manager: Arc::new(LogManager::new()),
            active_operations: Arc::new(Mutex::new(HashMap::new())),
            recent_errors: Arc::new(Mutex::new(HashMap::new())),
            startup_timeout_ms,
            poll_interval_ms,
        }
    }

    /// Returns the currently active in-flight start operations and recent errors for profile status resolution.
    pub fn get_active_start_states(&self) -> HashMap<String, (ProfileRuntimeStatus, Option<String>)> {
        let mut states = HashMap::new();

        // 1. Active starting operations
        if let Ok(ops) = self.active_operations.lock() {
            for profile_id in ops.keys() {
                states.insert(profile_id.clone(), (ProfileRuntimeStatus::Starting, None));
            }
        }

        // 2. Recent transient errors (valid for 30 seconds unless cleared)
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        if let Ok(mut errs) = self.recent_errors.lock() {
            errs.retain(|_, (_, ts)| now_ms.saturating_sub(*ts) < 30_000);
            for (profile_id, (err_msg, _)) in errs.iter() {
                states.entry(profile_id.clone()).or_insert_with(|| {
                    (ProfileRuntimeStatus::Error, Some(err_msg.clone()))
                });
            }
        }

        states
    }

    /// Starts a development server profile by executing its configured command and verifying startup.
    pub fn start_profile(&self, profile_id: &str) -> Result<StartProfileResult, StartError> {
        // Step 1: Prevent duplicate starts for the same profile
        {
            let mut ops = self.active_operations.lock().map_err(|e| StartError {
                code: StartErrorCode::DatabaseError,
                message: format!("Failed to acquire active operations lock: {}", e),
                profile_id: Some(profile_id.to_string()),
                current_owner: None,
            })?;

            if ops.contains_key(profile_id) {
                return Err(StartError {
                    code: StartErrorCode::AlreadyRunning,
                    message: format!("Startup operation for profile '{}' is already in progress.", profile_id),
                    profile_id: Some(profile_id.to_string()),
                    current_owner: None,
                });
            }

            // Reserve slot
            ops.insert(
                profile_id.to_string(),
                StartOperation {
                    operation_id: uuid::Uuid::new_v4().to_string(),
                    profile_id: profile_id.to_string(),
                    started_at_ms: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64,
                    environment: Environment::windows(),
                    expected_port: None,
                    initial_pid: 0,
                },
            );
        }

        // Clear any previous transient error for this profile
        if let Ok(mut errs) = self.recent_errors.lock() {
            errs.remove(profile_id);
        }

        // Perform actual startup sequence
        let result = self.execute_start_sequence(profile_id);

        // Cleanup operation lock and record errors if any
        if let Ok(mut ops) = self.active_operations.lock() {
            ops.remove(profile_id);
        }

        if let Err(ref err) = result {
            let now_ms = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64;
            if let Ok(mut errs) = self.recent_errors.lock() {
                errs.insert(profile_id.to_string(), (err.message.clone(), now_ms));
            }
        }

        result
    }

    /// Internal execution sequence for server startup.
    fn execute_start_sequence(&self, profile_id: &str) -> Result<StartProfileResult, StartError> {
        // Step 2: Load profile configuration from database
        let profile = self
            .repository
            .get_by_id(profile_id)
            .map_err(|e| StartError {
                code: StartErrorCode::DatabaseError,
                message: format!("Failed to load profile: {}", e),
                profile_id: Some(profile_id.to_string()),
                current_owner: None,
            })?
            .ok_or_else(|| StartError {
                code: StartErrorCode::ProfileNotFound,
                message: format!("Profile with ID '{}' was not found.", profile_id),
                profile_id: Some(profile_id.to_string()),
                current_owner: None,
            })?;

        // Step 3: Check expected port availability (Pre-flight Port Check)
        let initial_snapshot = self.discovery.discover_all().unwrap_or_default();


        if let Some(expected_port) = profile.expected_port {
            if let Some(existing_port) = initial_snapshot
                .ports
                .iter()
                .find(|p| p.environment == profile.environment && p.port == expected_port)
            {
                // Find owner process info
                let owner_proc = initial_snapshot
                    .processes
                    .iter()
                    .find(|pr| pr.environment == profile.environment && pr.pid == existing_port.pid);

                let owner_name = owner_proc
                    .map(|p| p.name.clone())
                    .unwrap_or_else(|| format!("PID {}", existing_port.pid));

                let owner_info = RemainingOwnerInfo {
                    pid: existing_port.pid,
                    process_name: owner_name.clone(),
                    port: expected_port,
                };

                return Err(StartError {
                    code: StartErrorCode::PortAlreadyInUse,
                    message: format!(
                        "Port {} is already in use by {} (PID {}). Stop the existing process before starting this profile.",
                        expected_port, owner_name, existing_port.pid
                    ),
                    profile_id: Some(profile_id.to_string()),
                    current_owner: Some(owner_info),
                });
            }
        }

        // Step 4: Instantiate environment-specific launcher
        let launcher: Box<dyn EnvironmentLauncher> = match &profile.environment {
            Environment::Windows => Box::new(WindowsLauncher::new()),
            Environment::Wsl { distro } => Box::new(WslLauncher::new(distro)),
        };

        // Step 5: Pre-validate environment & working directory
        launcher.validate_environment()?;
        launcher.validate_working_directory(&profile.working_directory)?;

        // Step 6: Create fresh LogSession and launch command with live log capture
        let session_id = self.log_manager.create_session(profile_id, LogSource::Runara);
        let launch_handle = launcher.launch_server_with_logs(
            &profile.working_directory,
            &profile.command,
            Some(profile_id),
            Some(&session_id),
            Some(self.log_manager.clone()),
        )?;

        // Update operation record with initial PID and expected port
        if let Ok(mut ops) = self.active_operations.lock() {
            if let Some(op) = ops.get_mut(profile_id) {
                op.initial_pid = launch_handle.initial_pid;
                op.environment = profile.environment.clone();
                op.expected_port = profile.expected_port;
            }
        }

        // Step 7: Bounded startup monitoring loop
        let start_time = SystemTime::now();
        let timeout_duration = Duration::from_millis(self.startup_timeout_ms);
        let tick_interval = Duration::from_millis(self.poll_interval_ms);

        let mut consecutive_matches = 0usize;

        while start_time.elapsed().unwrap_or_default() < timeout_duration {
            sleep(tick_interval);

            // Fresh OS discovery snapshot
            let fresh_snapshot = self.discovery.discover_all().unwrap_or_default();


            // Scenario A: Profile expects a port
            if let Some(expected_port) = profile.expected_port {
                if let Some(port_entry) = fresh_snapshot
                    .ports
                    .iter()
                    .find(|p| p.environment == profile.environment && p.port == expected_port)
                {
                    // Port is listening! Verify process identity
                    let owner_pid = port_entry.pid;
                    let owner_proc = fresh_snapshot
                        .processes
                        .iter()
                        .find(|p| p.environment == profile.environment && p.pid == owner_pid);

                    if let Some(proc) = owner_proc {
                        // Check if this process belongs to the started profile
                        let cwd_matches = proc.working_directory.as_ref().map_or(true, |cwd| {
                            ServerProfileService::normalize_path(cwd)
                                == ServerProfileService::normalize_path(&profile.working_directory)
                        });

                        if cwd_matches {
                            // Verified success!
                            return Ok(StartProfileResult {
                                profile_id: profile.id.clone(),
                                status: ProfileRuntimeStatus::Running,
                                pid: Some(owner_pid),
                                port: Some(expected_port),
                                message: format!(
                                    "Server '{}' started successfully and is listening on port {}.",
                                    profile.name, expected_port
                                ),
                            });
                        } else {
                            // Port was taken by an unrelated process!
                            return Err(StartError {
                                code: StartErrorCode::PortOwnerChanged,
                                message: format!(
                                    "Port conflict detected: Port {} was bound by an unrelated process '{}' (PID {}).",
                                    expected_port, proc.name, owner_pid
                                ),
                                profile_id: Some(profile.id.clone()),
                                current_owner: Some(RemainingOwnerInfo {
                                    pid: owner_pid,
                                    process_name: proc.name.clone(),
                                    port: expected_port,
                                }),
                            });
                        }
                    }
                }
            } else {
                // Scenario B: Profile does not expect a specific port
                // Match by environment + working directory
                if let Some((matched_proc, bound_port)) = ServerProfileService::find_matching_process(
                    &profile,
                    &fresh_snapshot.processes,
                    &fresh_snapshot.ports,
                ) {
                    consecutive_matches += 1;
                    if consecutive_matches >= 2 {
                        let active_port = if bound_port > 0 { Some(bound_port) } else { None };
                        return Ok(StartProfileResult {
                            profile_id: profile.id.clone(),
                            status: ProfileRuntimeStatus::Running,
                            pid: Some(matched_proc.pid),
                            port: active_port,
                            message: format!("Server '{}' started successfully.", profile.name),
                        });
                    }
                }
            }
        }

        // Startup timed out
        Err(StartError {
            code: StartErrorCode::StartupTimeout,
            message: format!(
                "Server '{}' did not become ready within the expected startup window ({}s).",
                profile.name,
                self.startup_timeout_ms / 1000
            ),
            profile_id: Some(profile.id.clone()),
            current_owner: None,
        })
    }

    /// Restarts a Windows server profile by safely stopping any existing running instance,
    /// verifying port release, and initiating a fresh start sequence.
    pub fn restart_profile(&self, profile_id: &str) -> Result<StartProfileResult, StartError> {
        let profile = self
            .repository
            .get_by_id(profile_id)
            .map_err(|e| StartError {
                code: StartErrorCode::DatabaseError,
                message: format!("Failed to load profile: {}", e),
                profile_id: Some(profile_id.to_string()),
                current_owner: None,
            })?
            .ok_or_else(|| StartError {
                code: StartErrorCode::ProfileNotFound,
                message: format!("Profile with ID '{}' was not found.", profile_id),
                profile_id: Some(profile_id.to_string()),
                current_owner: None,
            })?;

        // Check if profile is currently running
        let snapshot = self.discovery.discover_all().unwrap_or_default();
        if let Some((proc, _port)) = ServerProfileService::find_matching_process(

            &profile,
            &snapshot.processes,
            &snapshot.ports,
        ) {
            let target = ProcessTarget {
                pid: proc.pid,
                process_name: proc.name.clone(),
                executable_path: proc.executable_path.clone(),
                working_directory: proc.working_directory.clone(),
                expected_ports: profile.expected_port.into_iter().collect(),
                force: false,
                environment: Some(profile.environment.clone()),
            };

            // Stop existing process
            self.process_control.stop_server(&target).map_err(|e| StartError {
                code: StartErrorCode::StartFailed,
                message: format!("Failed to stop existing server process prior to restart: {}", e.message),
                profile_id: Some(profile_id.to_string()),
                current_owner: None,
            })?;

            // Settle delay for OS socket stack release
            sleep(Duration::from_millis(300));
        }

        // Start profile
        self.start_profile(profile_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::repository::SqliteServerProfileRepository;
    use crate::db::MigrationRunner;
    use crate::discovery::{PortDiscovery, ProcessDiscovery};
    use crate::models::{PortInfo, ProcessInfo, ProcessStatus, ServerProfile};
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
            if pid == 0 || pid == 4 { true } else { *self.alive.lock().unwrap() }
        }
    }

    #[test]
    fn test_port_conflict_refuses_start_without_killing() {
        let mut conn = Connection::open_in_memory().unwrap();
        MigrationRunner::run_migrations(&mut conn).unwrap();
        let repo = Arc::new(SqliteServerProfileRepository::new(Arc::new(Mutex::new(conn))));

        let profile = ServerProfile {
            id: "prof-conflict".to_string(),
            name: "Conflict Test".to_string(),
            description: None,
            environment: Environment::windows(),
            working_directory: std::env::temp_dir().to_str().unwrap().to_string(),
            command: "echo test".to_string(),
            expected_port: Some(3000),
            expected_host: None,
            enabled: true,
            created_at: "2026-08-22T20:00:00Z".to_string(),
            updated_at: "2026-08-22T20:00:00Z".to_string(),
        };
        repo.create(&profile).unwrap();

        let existing_proc = ProcessInfo {
            pid: 9999,
            parent_pid: None,
            name: "other-node.exe".to_string(),
            executable_path: None,
            command_line: Some("node other.js".to_string()),
            working_directory: Some("C:\\Other".to_string()),
            status: ProcessStatus::Running,
            environment: Environment::windows(),
        };

        let existing_port = PortInfo {
            port: 3000,
            pid: 9999,
            protocol: "tcp".to_string(),
            address: "127.0.0.1".to_string(),
            state: "listening".to_string(),
            environment: Environment::windows(),
        };

        let proc_disc = Arc::new(MockProcDiscovery { procs: Mutex::new(vec![existing_proc]) });
        let port_disc = Arc::new(MockPortDiscovery { ports: Mutex::new(vec![existing_port]) });
        let proc_ctrl = Arc::new(MockProcCtrl { alive: Mutex::new(true) });

        let control_svc = Arc::new(ProcessControlService::with_dependencies(
            proc_disc.clone(),
            port_disc.clone(),
            proc_ctrl.clone(),
        ));

        let unified_discovery = Arc::new(UnifiedDiscoveryService::with_adapters(
            proc_disc,
            port_disc,
            Arc::new(crate::wsl::distro::DefaultWslDistroDiscovery::new()),
            Arc::new(crate::wsl::process::DefaultWslProcessDiscovery::new()),
            Arc::new(crate::wsl::port::DefaultWslPortDiscovery::new()),
            Arc::new(crate::identity::ProcessIdentityService::new()),
        ));


        let start_svc = ServerStartService::with_custom_timeouts(
            repo,
            unified_discovery,
            control_svc,
            1000,
            100,
        );

        let err = start_svc.start_profile("prof-conflict").unwrap_err();
        assert_eq!(err.code, StartErrorCode::PortAlreadyInUse);
        assert!(err.message.contains("Port 3000 is already in use by other-node.exe (PID 9999)"));
        assert!(err.current_owner.is_some());
        let owner = err.current_owner.unwrap();
        assert_eq!(owner.pid, 9999);
        assert_eq!(owner.process_name, "other-node.exe");
        assert_eq!(owner.port, 3000);

        // Verify existing process was NOT killed
        assert!(*proc_ctrl.alive.lock().unwrap());
    }

    #[test]
    fn test_wsl_restart_is_supported() {
        let mut conn = Connection::open_in_memory().unwrap();
        MigrationRunner::run_migrations(&mut conn).unwrap();
        let repo = Arc::new(SqliteServerProfileRepository::new(Arc::new(Mutex::new(conn))));

        let profile = ServerProfile {
            id: "wsl-prof".to_string(),
            name: "WSL Restart Test".to_string(),
            description: None,
            environment: Environment::wsl("Fedora"),
            working_directory: "/home/dev/app".to_string(),
            command: "npm start".to_string(),
            expected_port: Some(5000),
            expected_host: None,
            enabled: true,
            created_at: "2026-08-22T20:00:00Z".to_string(),
            updated_at: "2026-08-22T20:00:00Z".to_string(),
        };
        repo.create(&profile).unwrap();

        let proc_disc = Arc::new(MockProcDiscovery { procs: Mutex::new(vec![]) });
        let port_disc = Arc::new(MockPortDiscovery { ports: Mutex::new(vec![]) });
        let proc_ctrl = Arc::new(MockProcCtrl { alive: Mutex::new(true) });

        let control_svc = Arc::new(ProcessControlService::with_dependencies(
            proc_disc.clone(),
            port_disc.clone(),
            proc_ctrl,
        ));

        let unified_discovery = Arc::new(UnifiedDiscoveryService::new());
        let start_svc = ServerStartService::new(repo, unified_discovery, control_svc);

        let res = start_svc.restart_profile("wsl-prof");
        // Result will either be Err(WslCommandFailed / DirectoryNotFound) or Ok, but MUST NOT be UnsupportedOperation
        if let Err(e) = res {
            assert_ne!(e.code, StartErrorCode::UnsupportedOperation);
        }
    }
}
