use crate::discovery::{
    PortDiscovery, ProcessDiscovery, WindowsPortDiscovery, WindowsProcessDiscovery,
};
use crate::models::control::{
    ControlResult, ControlStatus, ProcessControlError, ProcessControlErrorCode, ProcessTarget,
    RemainingOwnerInfo,
};
use crate::models::environment::{Environment, WslDistroState};
use crate::models::{PortInfo, ProcessInfo};
use crate::windows::{
    ProcessController, WindowsProcessController, ERROR_ACCESS_DENIED,
    PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_TERMINATE, SYNCHRONIZE,
};
use crate::wsl::{
    DefaultWslDistroDiscovery, DefaultWslPortDiscovery, DefaultWslProcessController,
    DefaultWslProcessDiscovery, WslDistroDiscovery, WslPortDiscovery, WslProcessController,
    WslProcessDiscovery,
};
use std::collections::{HashMap, HashSet, VecDeque};
use std::path::Path;
use std::sync::{Arc, Mutex};

/// Set of known Windows system-critical process names that must never be terminated.
const PROTECTED_WINDOWS_PROCESSES: &[&str] = &[
    "system",
    "idle",
    "smss.exe",
    "csrss.exe",
    "wininit.exe",
    "services.exe",
    "lsass.exe",
    "svchost.exe",
    "explorer.exe",
    "winlogon.exe",
    "fontdrvhost.exe",
    "dwm.exe",
];

/// Set of known Linux / WSL system-critical process names that must never be terminated.
const PROTECTED_LINUX_PROCESSES: &[&str] = &[
    "systemd",
    "init",
    "kthreadd",
    "systemd-journald",
    "systemd-udevd",
    "systemd-logind",
    "systemd-resolved",
    "dbus-daemon",
    "sshd",
    "cron",
    "crond",
    "rsyslogd",
    "wsl-bootstrap",
    "wsl-procmgr",
    "wslg",
];

/// Maximum depth bound for descendant process traversal to avoid pathological recursion.
const MAX_DESCENDANT_DEPTH: usize = 32;

/// Core service responsible for safe target validation, descendant resolution,
/// process termination, and post-termination verification across Windows and WSL.
pub struct ProcessControlService {
    windows_process_discovery: Arc<dyn ProcessDiscovery>,
    windows_port_discovery: Arc<dyn PortDiscovery>,
    windows_process_controller: Arc<dyn ProcessController>,
    wsl_distro_discovery: Arc<dyn WslDistroDiscovery>,
    wsl_process_discovery: Arc<dyn WslProcessDiscovery>,
    wsl_port_discovery: Arc<dyn WslPortDiscovery>,
    wsl_process_controller: Arc<dyn WslProcessController>,
    active_operations: Arc<Mutex<HashSet<String>>>,
}

impl ProcessControlService {
    /// Creates a new `ProcessControlService` using standard Windows and WSL discovery and controllers.
    pub fn new() -> Self {
        Self {
            windows_process_discovery: Arc::new(WindowsProcessDiscovery::new()),
            windows_port_discovery: Arc::new(WindowsPortDiscovery::new()),
            windows_process_controller: Arc::new(WindowsProcessController::new()),
            wsl_distro_discovery: Arc::new(DefaultWslDistroDiscovery::new()),
            wsl_process_discovery: Arc::new(DefaultWslProcessDiscovery::new()),
            wsl_port_discovery: Arc::new(DefaultWslPortDiscovery::new()),
            wsl_process_controller: Arc::new(DefaultWslProcessController::new()),
            active_operations: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    /// Creates a `ProcessControlService` with injected Windows dependencies for testing and backward compatibility.
    pub fn with_dependencies(
        process_discovery: Arc<dyn ProcessDiscovery>,
        port_discovery: Arc<dyn PortDiscovery>,
        process_controller: Arc<dyn ProcessController>,
    ) -> Self {
        Self {
            windows_process_discovery: process_discovery,
            windows_port_discovery: port_discovery,
            windows_process_controller: process_controller,
            wsl_distro_discovery: Arc::new(DefaultWslDistroDiscovery::new()),
            wsl_process_discovery: Arc::new(DefaultWslProcessDiscovery::new()),
            wsl_port_discovery: Arc::new(DefaultWslPortDiscovery::new()),
            wsl_process_controller: Arc::new(DefaultWslProcessController::new()),
            active_operations: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    /// Creates a `ProcessControlService` with full injected dependencies for multi-environment testing.
    pub fn with_all_dependencies(
        windows_process_discovery: Arc<dyn ProcessDiscovery>,
        windows_port_discovery: Arc<dyn PortDiscovery>,
        windows_process_controller: Arc<dyn ProcessController>,
        wsl_distro_discovery: Arc<dyn WslDistroDiscovery>,
        wsl_process_discovery: Arc<dyn WslProcessDiscovery>,
        wsl_port_discovery: Arc<dyn WslPortDiscovery>,
        wsl_process_controller: Arc<dyn WslProcessController>,
    ) -> Self {
        Self {
            windows_process_discovery,
            windows_port_discovery,
            windows_process_controller,
            wsl_distro_discovery,
            wsl_process_discovery,
            wsl_port_discovery,
            wsl_process_controller,
            active_operations: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    /// Performs safe, multi-signal pre-termination target validation against fresh OS snapshots.
    pub fn validate_target(
        &self,
        target: &ProcessTarget,
        current_processes: &[ProcessInfo],
        current_ports: &[PortInfo],
    ) -> Result<ProcessInfo, ProcessControlError> {
        let env = target
            .environment
            .as_ref()
            .cloned()
            .unwrap_or_else(Environment::windows);

        if env.is_windows() {
            self.validate_windows_target(target, current_processes, current_ports)
        } else if let Some(distro) = env.distro_name() {
            self.validate_wsl_target(distro, target, current_processes, current_ports)
        } else {
            Err(ProcessControlError {
                code: ProcessControlErrorCode::InvalidTarget,
                message: "Target environment specification is invalid.".to_string(),
                pid: Some(target.pid),
            })
        }
    }

    /// Validates Windows-specific target processes against system snapshot.
    fn validate_windows_target(
        &self,
        target: &ProcessTarget,
        current_processes: &[ProcessInfo],
        current_ports: &[PortInfo],
    ) -> Result<ProcessInfo, ProcessControlError> {
        // Rule 1: Refuse PID 0 (Idle) and PID 4 (System)
        if target.pid == 0 || target.pid == 4 {
            return Err(ProcessControlError {
                code: ProcessControlErrorCode::UnsafeTarget,
                message: format!(
                    "Refusing to terminate critical Windows operating system process (PID {}).",
                    target.pid
                ),
                pid: Some(target.pid),
            });
        }

        // Rule 2: Refuse protected system process names
        let target_name_lower = target.process_name.to_lowercase();
        if PROTECTED_WINDOWS_PROCESSES
            .iter()
            .any(|&sys_name| sys_name == target_name_lower)
        {
            return Err(ProcessControlError {
                code: ProcessControlErrorCode::UnsafeTarget,
                message: format!(
                    "Refusing to terminate protected system process '{}' (PID {}).",
                    target.process_name, target.pid
                ),
                pid: Some(target.pid),
            });
        }

        // Rule 3: Find target process in current snapshot (must be a Windows process)
        let target_proc = match current_processes
            .iter()
            .find(|p| p.pid == target.pid && p.environment.is_windows())
        {
            Some(p) => p,
            None => {
                // Process does not exist in current process snapshot.
                // Check if the expected port is still bound by another process.
                for expected_port in &target.expected_ports {
                    if let Some(port_info) = current_ports
                        .iter()
                        .find(|p| p.port == *expected_port && p.environment.is_windows())
                    {
                        if port_info.pid != target.pid {
                            let owner_name = current_processes
                                .iter()
                                .find(|p| p.pid == port_info.pid && p.environment.is_windows())
                                .map(|p| p.name.clone())
                                .unwrap_or_else(|| format!("PID {}", port_info.pid));

                            return Err(ProcessControlError {
                                code: ProcessControlErrorCode::PortOwnerChanged,
                                message: format!(
                                    "Target process (PID {}) has exited. Port {} is now occupied by {} (PID {}). Refresh before stopping.",
                                    target.pid, expected_port, owner_name, port_info.pid
                                ),
                                pid: Some(target.pid),
                            });
                        }
                    }
                }

                return Err(ProcessControlError {
                    code: ProcessControlErrorCode::AlreadyStopped,
                    message: format!(
                        "Process with PID {} is no longer running. It may have already exited.",
                        target.pid
                    ),
                    pid: Some(target.pid),
                });
            }
        };

        // Rule 4: Verify Process Name
        let current_name = target_proc.name.trim();
        let expected_name = target.process_name.trim();
        if !Self::normalize_process_name(current_name)
            .eq_ignore_ascii_case(&Self::normalize_process_name(expected_name))
        {
            return Err(ProcessControlError {
                code: ProcessControlErrorCode::ProcessIdentityChanged,
                message: format!(
                    "Process identity changed for PID {}. Expected process '{}', but found '{}'. Refresh before stopping.",
                    target.pid, expected_name, current_name
                ),
                pid: Some(target.pid),
            });
        }

        // Rule 5: Verify Executable Path (when available in both)
        if let (Some(expected_exe), Some(current_exe)) = (
            target.executable_path.as_deref(),
            target_proc.executable_path.as_deref(),
        ) {
            if !expected_exe.is_empty() && !current_exe.is_empty() {
                if !Self::normalize_path(expected_exe)
                    .eq_ignore_ascii_case(&Self::normalize_path(current_exe))
                {
                    return Err(ProcessControlError {
                        code: ProcessControlErrorCode::ProcessIdentityChanged,
                        message: format!(
                            "Executable path changed for PID {}. Expected '{}', but found '{}'. Refresh before stopping.",
                            target.pid, expected_exe, current_exe
                        ),
                        pid: Some(target.pid),
                    });
                }
            }
        }

        // Rule 6: Verify Working Directory (when available in both)
        if let (Some(expected_cwd), Some(current_cwd)) = (
            target.working_directory.as_deref(),
            target_proc.working_directory.as_deref(),
        ) {
            if !expected_cwd.is_empty() && !current_cwd.is_empty() {
                if !Self::normalize_path(expected_cwd)
                    .eq_ignore_ascii_case(&Self::normalize_path(current_cwd))
                {
                    return Err(ProcessControlError {
                        code: ProcessControlErrorCode::ProcessIdentityChanged,
                        message: format!(
                            "Working directory changed for PID {}. Expected '{}', but found '{}'. Refresh before stopping.",
                            target.pid, expected_cwd, current_cwd
                        ),
                        pid: Some(target.pid),
                    });
                }
            }
        }

        Ok(target_proc.clone())
    }

    /// Validates WSL Linux target processes against distribution snapshot.
    fn validate_wsl_target(
        &self,
        distro: &str,
        target: &ProcessTarget,
        current_processes: &[ProcessInfo],
        current_ports: &[PortInfo],
    ) -> Result<ProcessInfo, ProcessControlError> {
        let target_env = Environment::wsl(distro);

        // Rule 1: Refuse PID 0 (Kernel) and PID 1 (Init/Systemd)
        if target.pid == 0 || target.pid == 1 {
            return Err(ProcessControlError {
                code: ProcessControlErrorCode::UnsafeTarget,
                message: format!(
                    "Refusing to terminate critical Linux system init process (PID {}) inside distribution '{}'.",
                    target.pid, distro
                ),
                pid: Some(target.pid),
            });
        }

        // Rule 2: Refuse protected Linux system process names
        let target_name_lower = target.process_name.to_lowercase();
        if PROTECTED_LINUX_PROCESSES
            .iter()
            .any(|&sys_name| sys_name == target_name_lower)
        {
            return Err(ProcessControlError {
                code: ProcessControlErrorCode::UnsafeTarget,
                message: format!(
                    "Refusing to terminate protected Linux system process '{}' (PID {}) in distribution '{}'.",
                    target.process_name, target.pid, distro
                ),
                pid: Some(target.pid),
            });
        }

        // Rule 3: Find target process in current WSL snapshot for this distribution
        let target_proc = match current_processes
            .iter()
            .find(|p| p.pid == target.pid && p.environment == target_env)
        {
            Some(p) => p,
            None => {
                // Process not found. Check if port is bound by a different process.
                for expected_port in &target.expected_ports {
                    if let Some(port_info) = current_ports
                        .iter()
                        .find(|p| p.port == *expected_port && p.environment == target_env)
                    {
                        if port_info.pid != target.pid {
                            let owner_name = current_processes
                                .iter()
                                .find(|p| p.pid == port_info.pid && p.environment == target_env)
                                .map(|p| p.name.clone())
                                .unwrap_or_else(|| format!("PID {}", port_info.pid));

                            return Err(ProcessControlError {
                                code: ProcessControlErrorCode::PortOwnerChanged,
                                message: format!(
                                    "Target process (PID {}) has exited in WSL distribution '{}'. Port {} is now occupied by {} (PID {}). Refresh before stopping.",
                                    target.pid, distro, expected_port, owner_name, port_info.pid
                                ),
                                pid: Some(target.pid),
                            });
                        }
                    }
                }

                return Err(ProcessControlError {
                    code: ProcessControlErrorCode::AlreadyStopped,
                    message: format!(
                        "Process with PID {} is no longer running in WSL distribution '{}'. It may have already exited.",
                        target.pid, distro
                    ),
                    pid: Some(target.pid),
                });
            }
        };

        // Rule 4: Verify Process Name
        let current_name = target_proc.name.trim();
        let expected_name = target.process_name.trim();
        if !Self::normalize_process_name(current_name)
            .eq_ignore_ascii_case(&Self::normalize_process_name(expected_name))
        {
            return Err(ProcessControlError {
                code: ProcessControlErrorCode::ProcessIdentityChanged,
                message: format!(
                    "Process identity changed for PID {} in WSL distribution '{}'. Expected process '{}', but found '{}'. Refresh before stopping.",
                    target.pid, distro, expected_name, current_name
                ),
                pid: Some(target.pid),
            });
        }

        // Rule 5: Verify Executable Path (when available in both)
        if let (Some(expected_exe), Some(current_exe)) = (
            target.executable_path.as_deref(),
            target_proc.executable_path.as_deref(),
        ) {
            if !expected_exe.is_empty() && !current_exe.is_empty() {
                if !Self::normalize_path(expected_exe)
                    .eq_ignore_ascii_case(&Self::normalize_path(current_exe))
                {
                    return Err(ProcessControlError {
                        code: ProcessControlErrorCode::ProcessIdentityChanged,
                        message: format!(
                            "Executable path changed for PID {} in WSL distribution '{}'. Expected '{}', but found '{}'. Refresh before stopping.",
                            target.pid, distro, expected_exe, current_exe
                        ),
                        pid: Some(target.pid),
                    });
                }
            }
        }

        // Rule 6: Verify Working Directory (when available in both)
        if let (Some(expected_cwd), Some(current_cwd)) = (
            target.working_directory.as_deref(),
            target_proc.working_directory.as_deref(),
        ) {
            if !expected_cwd.is_empty() && !current_cwd.is_empty() {
                if !Self::normalize_path(expected_cwd)
                    .eq_ignore_ascii_case(&Self::normalize_path(current_cwd))
                {
                    return Err(ProcessControlError {
                        code: ProcessControlErrorCode::ProcessIdentityChanged,
                        message: format!(
                            "Working directory changed for PID {} in WSL distribution '{}'. Expected '{}', but found '{}'. Refresh before stopping.",
                            target.pid, distro, expected_cwd, current_cwd
                        ),
                        pid: Some(target.pid),
                    });
                }
            }
        }

        Ok(target_proc.clone())
    }

    /// Reconstructs all verified descendant process PIDs (children, grandchildren, etc.)
    /// of `target_pid` with cycle protection. Ancestors are NEVER included.
    pub fn find_descendants(
        &self,
        target_pid: u32,
        process_map: &HashMap<u32, &ProcessInfo>,
    ) -> Vec<u32> {
        // Step 1: Build adjacency map: parent_pid -> Vec<child_pid>
        let mut children_by_parent: HashMap<u32, Vec<u32>> = HashMap::new();
        for proc in process_map.values() {
            if let Some(parent_pid) = proc.parent_pid {
                if parent_pid != proc.pid {
                    children_by_parent.entry(parent_pid).or_default().push(proc.pid);
                }
            }
        }

        // Step 2: BFS traversal starting strictly from children of target_pid
        let mut descendants = Vec::new();
        let mut visited = HashSet::new();
        visited.insert(target_pid); // Prevent target or cycles from adding target as descendant

        let mut queue: VecDeque<(u32, usize)> = VecDeque::new();
        if let Some(immediate_children) = children_by_parent.get(&target_pid) {
            for &child_pid in immediate_children {
                if visited.insert(child_pid) {
                    queue.push_back((child_pid, 1));
                    descendants.push(child_pid);
                }
            }
        }

        while let Some((curr_pid, depth)) = queue.pop_front() {
            if depth >= MAX_DESCENDANT_DEPTH {
                continue;
            }

            if let Some(children) = children_by_parent.get(&curr_pid) {
                for &child_pid in children {
                    if visited.insert(child_pid) {
                        queue.push_back((child_pid, depth + 1));
                        descendants.push(child_pid);
                    }
                }
            }
        }

        descendants
    }

    /// Orchestrates stopping a server target (Windows or WSL):
    /// 1. Concurrency lock to prevent duplicate simultaneous stop requests.
    /// 2. Fresh OS discovery (processes + ports).
    /// 3. Strict target validation.
    /// 4. Reconstructs descendant tree.
    /// 5. Gracefully or forcefully terminates descendants and target.
    /// 6. Bounded wait for process exit.
    /// 7. Post-termination verification of process exit and port release.
    pub fn stop_server(&self, target: &ProcessTarget) -> Result<ControlResult, ProcessControlError> {
        let env = target
            .environment
            .as_ref()
            .cloned()
            .unwrap_or_else(Environment::windows);

        let op_key = match &env {
            Environment::Windows => format!("win:{}", target.pid),
            Environment::Wsl { distro } => format!("wsl:{}:{}", distro, target.pid),
        };

        // Concurrency Lock: Prevent duplicate stop operations on the same target
        {
            let mut ops = self.active_operations.lock().unwrap();
            if ops.contains(&op_key) {
                return Err(ProcessControlError {
                    code: ProcessControlErrorCode::OperationInProgress,
                    message: format!(
                        "A stop operation is already in progress for PID {} ({}).",
                        target.pid,
                        env.display_name()
                    ),
                    pid: Some(target.pid),
                });
            }
            ops.insert(op_key.clone());
        }

        let result = match &env {
            Environment::Windows => self.stop_windows_server(target),
            Environment::Wsl { distro } => self.stop_wsl_server(distro, target),
        };

        // Release concurrency lock
        {
            let mut ops = self.active_operations.lock().unwrap();
            ops.remove(&op_key);
        }

        result
    }

    /// Internal execution sequence for Windows server termination.
    fn stop_windows_server(
        &self,
        target: &ProcessTarget,
    ) -> Result<ControlResult, ProcessControlError> {
        // Step 1: Fresh process and port discovery
        let current_processes = self
            .windows_process_discovery
            .enumerate()
            .map_err(|err| ProcessControlError {
                code: ProcessControlErrorCode::UnknownError,
                message: format!("Failed to query system processes: {}", err),
                pid: Some(target.pid),
            })?;

        let current_ports = self
            .windows_port_discovery
            .enumerate()
            .unwrap_or_default();

        // Step 2: Pre-termination validation
        let _validated_proc = self.validate_windows_target(target, &current_processes, &current_ports)?;

        // Step 3: Descendant resolution
        let process_map: HashMap<u32, &ProcessInfo> = current_processes
            .iter()
            .filter(|p| p.environment.is_windows())
            .map(|p| (p.pid, p))
            .collect();
        let descendants = self.find_descendants(target.pid, &process_map);

        // Step 4: Open process handles
        let target_handle_res = self.windows_process_controller.open_process(
            target.pid,
            PROCESS_TERMINATE | SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION,
        );

        let target_handle = match target_handle_res {
            Ok(handle) => Some(handle),
            Err(err_code) => {
                if err_code == ERROR_ACCESS_DENIED {
                    return Err(ProcessControlError {
                        code: ProcessControlErrorCode::ProcessAccessDenied,
                        message: format!(
                            "Access denied by Windows when opening process {} (Error code: {}). Elevated administrator privileges may be required.",
                            target.pid, err_code
                        ),
                        pid: Some(target.pid),
                    });
                } else if !self.windows_process_controller.is_process_alive(target.pid) {
                    None
                } else {
                    return Err(ProcessControlError {
                        code: ProcessControlErrorCode::ProcessTerminationFailed,
                        message: format!(
                            "Failed to open process handle for PID {} (Windows error: {}).",
                            target.pid, err_code
                        ),
                        pid: Some(target.pid),
                    });
                }
            }
        };

        // Open handles for descendants
        let mut descendant_handles = Vec::new();
        for &desc_pid in &descendants {
            if let Ok(h) = self.windows_process_controller.open_process(
                desc_pid,
                PROCESS_TERMINATE | SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION,
            ) {
                descendant_handles.push(h);
            }
        }

        // Step 5: Terminate descendants first (leaves-to-root)
        let mut remaining_children = Vec::new();
        for desc_handle in descendant_handles.iter().rev() {
            let pid = desc_handle.pid();
            if let Err(_err) = self
                .windows_process_controller
                .terminate_process(desc_handle, 1)
            {
                if self.windows_process_controller.is_process_alive(pid) {
                    remaining_children.push(pid);
                }
            }
        }

        // Terminate target process
        if let Some(ref handle) = target_handle {
            if let Err(err_code) = self
                .windows_process_controller
                .terminate_process(handle, 1)
            {
                if self.windows_process_controller.is_process_alive(target.pid) {
                    return Err(ProcessControlError {
                        code: ProcessControlErrorCode::ProcessTerminationFailed,
                        message: format!(
                            "Failed to terminate process PID {} (Windows error: {}).",
                            target.pid, err_code
                        ),
                        pid: Some(target.pid),
                    });
                }
            }
        }

        // Step 6: Bounded exit wait (up to 3000ms in 100ms slices)
        let wait_timeout_ms = 3000u32;
        let slice_ms = 100u32;
        let mut elapsed_ms = 0u32;
        let mut target_exited = false;

        while elapsed_ms < wait_timeout_ms {
            if let Some(ref handle) = target_handle {
                if let Ok(exited) = self
                    .windows_process_controller
                    .wait_for_exit(handle, slice_ms)
                {
                    if exited {
                        target_exited = true;
                        break;
                    }
                }
            } else if !self.windows_process_controller.is_process_alive(target.pid) {
                target_exited = true;
                break;
            }
            elapsed_ms += slice_ms;
        }

        if !target_exited && self.windows_process_controller.is_process_alive(target.pid) {
            return Err(ProcessControlError {
                code: ProcessControlErrorCode::Timeout,
                message: format!(
                    "Server process (PID {}) did not exit within {} ms. Try using Force Stop.",
                    target.pid, wait_timeout_ms
                ),
                pid: Some(target.pid),
            });
        }

        drop(target_handle);
        drop(descendant_handles);

        // Step 7: Post-termination verification
        self.verify_windows_termination(target, &remaining_children)
    }

    /// Verifies Windows termination status and inspects port release.
    fn verify_windows_termination(
        &self,
        target: &ProcessTarget,
        remaining_children: &[u32],
    ) -> Result<ControlResult, ProcessControlError> {
        let fresh_ports = self
            .windows_port_discovery
            .enumerate()
            .unwrap_or_default();
        let mut released_ports = Vec::new();
        let mut new_owner_info: Option<RemainingOwnerInfo> = None;

        for &port_num in &target.expected_ports {
            if let Some(port_entry) = fresh_ports
                .iter()
                .find(|p| p.port == port_num && p.environment.is_windows())
            {
                if new_owner_info.is_none() {
                    let owner_pid = port_entry.pid;
                    let procs = self
                        .windows_process_discovery
                        .enumerate()
                        .unwrap_or_default();
                    let owner_name = procs
                        .iter()
                        .find(|p| p.pid == owner_pid && p.environment.is_windows())
                        .map(|p| p.name.clone())
                        .unwrap_or_else(|| format!("PID {}", owner_pid));

                    new_owner_info = Some(RemainingOwnerInfo {
                        pid: owner_pid,
                        process_name: owner_name,
                        port: port_num,
                    });
                }
            } else {
                released_ports.push(port_num);
            }
        }

        if let Some(new_owner) = new_owner_info {
            if new_owner.pid != target.pid {
                return Ok(ControlResult {
                    status: ControlStatus::PortOwnerChanged,
                    pid: target.pid,
                    released_ports,
                    remaining_children: remaining_children.to_vec(),
                    remaining_owner: Some(new_owner.clone()),
                    message: format!(
                        "Process {} exited, but port {} is now owned by {} (PID {}).",
                        target.pid, new_owner.port, new_owner.process_name, new_owner.pid
                    ),
                });
            } else {
                return Ok(ControlResult {
                    status: ControlStatus::PortStillInUse,
                    pid: target.pid,
                    released_ports,
                    remaining_children: remaining_children.to_vec(),
                    remaining_owner: Some(new_owner.clone()),
                    message: format!(
                        "Process {} terminated, but port {} remains occupied by the operating system socket stack.",
                        target.pid, new_owner.port
                    ),
                });
            }
        }

        Ok(ControlResult {
            status: ControlStatus::Stopped,
            pid: target.pid,
            released_ports: target.expected_ports.clone(),
            remaining_children: remaining_children.to_vec(),
            remaining_owner: None,
            message: format!(
                "Server '{}' (PID {}) was safely stopped.",
                target.process_name, target.pid
            ),
        })
    }

    /// Internal execution sequence for WSL Linux server termination.
    fn stop_wsl_server(
        &self,
        distro: &str,
        target: &ProcessTarget,
    ) -> Result<ControlResult, ProcessControlError> {
        // Step 1: Validate WSL distribution is running
        let distros = self
            .wsl_distro_discovery
            .enumerate()
            .map_err(|e| ProcessControlError {
                code: ProcessControlErrorCode::WslError,
                message: format!("Failed to query WSL distributions: {}", e),
                pid: Some(target.pid),
            })?;

        let target_distro = distros.iter().find(|d| d.name.eq_ignore_ascii_case(distro));
        match target_distro {
            Some(d) => {
                if d.state != WslDistroState::Running {
                    return Err(ProcessControlError {
                        code: ProcessControlErrorCode::WslDistributionStopped,
                        message: format!(
                            "WSL distribution '{}' is currently stopped. Start the distribution before issuing process control commands.",
                            distro
                        ),
                        pid: Some(target.pid),
                    });
                }
            }
            None => {
                return Err(ProcessControlError {
                    code: ProcessControlErrorCode::WslDistributionNotFound,
                    message: format!("WSL distribution '{}' was not found on this host.", distro),
                    pid: Some(target.pid),
                });
            }
        }

        // Step 2: Fresh WSL discovery (processes + ports for this distribution)
        let current_processes = self
            .wsl_process_discovery
            .enumerate(distro)
            .map_err(|e| ProcessControlError {
                code: ProcessControlErrorCode::WslError,
                message: format!("Failed to query Linux processes in distribution '{}': {}", distro, e),
                pid: Some(target.pid),
            })?;

        let current_ports = self
            .wsl_port_discovery
            .enumerate(distro)
            .unwrap_or_default();

        // Step 3: Pre-termination validation
        let _validated_proc = self.validate_wsl_target(distro, target, &current_processes, &current_ports)?;

        // Step 4: Descendant resolution
        let target_env = Environment::wsl(distro);
        let process_map: HashMap<u32, &ProcessInfo> = current_processes
            .iter()
            .filter(|p| p.environment == target_env)
            .map(|p| (p.pid, p))
            .collect();
        let descendants = self.find_descendants(target.pid, &process_map);

        // Step 5: Terminate descendants first (leaf-to-root), then target
        let mut pids_to_kill: Vec<u32> = descendants.iter().rev().cloned().collect();
        pids_to_kill.push(target.pid);

        if target.force {
            self.wsl_process_controller
                .terminate_force(distro, &pids_to_kill)
                .map_err(|e| ProcessControlError {
                    code: ProcessControlErrorCode::ProcessTerminationFailed,
                    message: format!("Failed to force-terminate Linux process: {}", e),
                    pid: Some(target.pid),
                })?;
        } else {
            self.wsl_process_controller
                .terminate_graceful(distro, &pids_to_kill)
                .map_err(|e| ProcessControlError {
                    code: ProcessControlErrorCode::ProcessTerminationFailed,
                    message: format!("Failed to terminate Linux process: {}", e),
                    pid: Some(target.pid),
                })?;
        }

        // Step 6: Bounded exit wait (up to 3000ms in 100ms intervals)
        let wait_timeout_ms = 3000u64;
        let exited = self
            .wsl_process_controller
            .wait_for_exit(distro, target.pid, wait_timeout_ms)
            .unwrap_or(false);

        if !exited && self.wsl_process_controller.is_process_alive(distro, target.pid) {
            return Err(ProcessControlError {
                code: ProcessControlErrorCode::Timeout,
                message: format!(
                    "WSL server process (PID {}) did not exit within {} ms. Try using Force Stop.",
                    target.pid, wait_timeout_ms
                ),
                pid: Some(target.pid),
            });
        }

        // Step 7: Post-termination verification
        self.verify_wsl_termination(distro, target, &descendants)
    }

    /// Verifies WSL termination status and inspects port release in the guest.
    fn verify_wsl_termination(
        &self,
        distro: &str,
        target: &ProcessTarget,
        descendants: &[u32],
    ) -> Result<ControlResult, ProcessControlError> {
        let fresh_ports = self
            .wsl_port_discovery
            .enumerate(distro)
            .unwrap_or_default();
        let fresh_procs = self
            .wsl_process_discovery
            .enumerate(distro)
            .unwrap_or_default();

        let mut remaining_children = Vec::new();
        for &desc_pid in descendants {
            if self.wsl_process_controller.is_process_alive(distro, desc_pid) {
                remaining_children.push(desc_pid);
            }
        }

        let mut released_ports = Vec::new();
        let mut new_owner_info: Option<RemainingOwnerInfo> = None;
        let target_env = Environment::wsl(distro);

        for &port_num in &target.expected_ports {
            if let Some(port_entry) = fresh_ports
                .iter()
                .find(|p| p.port == port_num && p.environment == target_env)
            {
                if new_owner_info.is_none() {
                    let owner_pid = port_entry.pid;
                    let owner_name = fresh_procs
                        .iter()
                        .find(|p| p.pid == owner_pid && p.environment == target_env)
                        .map(|p| p.name.clone())
                        .unwrap_or_else(|| format!("PID {}", owner_pid));

                    new_owner_info = Some(RemainingOwnerInfo {
                        pid: owner_pid,
                        process_name: owner_name,
                        port: port_num,
                    });
                }
            } else {
                released_ports.push(port_num);
            }
        }

        if let Some(new_owner) = new_owner_info {
            if new_owner.pid != target.pid {
                return Ok(ControlResult {
                    status: ControlStatus::PortOwnerChanged,
                    pid: target.pid,
                    released_ports,
                    remaining_children,
                    remaining_owner: Some(new_owner.clone()),
                    message: format!(
                        "Process {} exited in WSL / {}, but port {} is now owned by {} (PID {}).",
                        target.pid, distro, new_owner.port, new_owner.process_name, new_owner.pid
                    ),
                });
            } else {
                return Ok(ControlResult {
                    status: ControlStatus::PortStillInUse,
                    pid: target.pid,
                    released_ports,
                    remaining_children,
                    remaining_owner: Some(new_owner.clone()),
                    message: format!(
                        "Process {} terminated, but port {} remains occupied by the Linux socket stack.",
                        target.pid, new_owner.port
                    ),
                });
            }
        }

        Ok(ControlResult {
            status: ControlStatus::Stopped,
            pid: target.pid,
            released_ports: target.expected_ports.clone(),
            remaining_children,
            remaining_owner: None,
            message: format!(
                "Server '{}' (PID {}) in WSL / {} was safely stopped.",
                target.process_name, target.pid, distro
            ),
        })
    }

    /// Normalizes process names (e.g. removes trailing .exe or trims spaces) for robust comparison.
    fn normalize_process_name(name: &str) -> String {
        let trimmed = name.trim();
        if let Some(stripped) = trimmed.strip_suffix(".exe") {
            stripped.to_lowercase()
        } else {
            trimmed.to_lowercase()
        }
    }

    /// Normalizes filesystem paths (replaces forward slashes with backslashes, strips trailing slashes).
    fn normalize_path(path: &str) -> String {
        Path::new(path)
            .to_string_lossy()
            .replace('/', "\\")
            .trim_end_matches('\\')
            .to_string()
    }
}

impl Default for ProcessControlService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::environment::WslDistribution;
    use crate::models::ProcessStatus;
    use crate::windows::ProcessHandle;
    use crate::wsl::control::tests::MockWslController;
    use crate::wsl::executor::WslExecutionError;

    // --- Mock Process Discovery ---
    struct MockProcessDiscovery {
        processes: Vec<ProcessInfo>,
    }

    impl ProcessDiscovery for MockProcessDiscovery {
        fn enumerate(&self) -> Result<Vec<ProcessInfo>, String> {
            Ok(self.processes.clone())
        }
    }

    // --- Mock Port Discovery ---
    struct MockPortDiscovery {
        ports: Mutex<Vec<PortInfo>>,
    }

    impl PortDiscovery for MockPortDiscovery {
        fn enumerate(&self) -> Result<Vec<PortInfo>, String> {
            Ok(self.ports.lock().unwrap().clone())
        }
    }

    // --- Mock Process Controller ---
    struct MockProcessController {
        alive_pids: Mutex<HashSet<u32>>,
        terminated_pids: Mutex<Vec<u32>>,
    }

    impl MockProcessController {
        fn new(pids: &[u32]) -> Self {
            let mut set = HashSet::new();
            for &p in pids {
                set.insert(p);
            }
            Self {
                alive_pids: Mutex::new(set),
                terminated_pids: Mutex::new(Vec::new()),
            }
        }
    }

    impl ProcessController for MockProcessController {
        fn open_process(&self, pid: u32, _desired_access: u32) -> Result<ProcessHandle, u32> {
            if self.alive_pids.lock().unwrap().contains(&pid) {
                Ok(ProcessHandle::new(0x1234 as *mut std::ffi::c_void, pid))
            } else {
                Err(87) // Invalid parameter / not found
            }
        }

        fn terminate_process(&self, handle: &ProcessHandle, _exit_code: u32) -> Result<(), u32> {
            let pid = handle.pid();
            self.alive_pids.lock().unwrap().remove(&pid);
            self.terminated_pids.lock().unwrap().push(pid);
            Ok(())
        }

        fn wait_for_exit(&self, handle: &ProcessHandle, _timeout_ms: u32) -> Result<bool, u32> {
            let pid = handle.pid();
            let alive = self.alive_pids.lock().unwrap().contains(&pid);
            Ok(!alive)
        }

        fn is_process_alive(&self, pid: u32) -> bool {
            if pid == 0 || pid == 4 {
                return true;
            }
            self.alive_pids.lock().unwrap().contains(&pid)
        }
    }

    // --- Mock WSL Distro Discovery ---
    struct MockWslDistroDiscovery {
        distros: Vec<WslDistribution>,
    }

    impl WslDistroDiscovery for MockWslDistroDiscovery {
        fn enumerate(&self) -> Result<Vec<WslDistribution>, WslExecutionError> {
            Ok(self.distros.clone())
        }
    }

    // --- Mock WSL Process Discovery ---
    struct MockWslProcessDiscovery {
        procs: Mutex<Vec<ProcessInfo>>,
    }

    impl WslProcessDiscovery for MockWslProcessDiscovery {
        fn enumerate(&self, _distro: &str) -> Result<Vec<ProcessInfo>, WslExecutionError> {
            Ok(self.procs.lock().unwrap().clone())
        }
    }

    // --- Mock WSL Port Discovery ---
    struct MockWslPortDiscovery {
        ports: Mutex<Vec<PortInfo>>,
    }

    impl WslPortDiscovery for MockWslPortDiscovery {
        fn enumerate(&self, _distro: &str) -> Result<Vec<PortInfo>, WslExecutionError> {
            Ok(self.ports.lock().unwrap().clone())
        }
    }

    fn make_test_proc(
        pid: u32,
        parent_pid: Option<u32>,
        name: &str,
        exe: Option<&str>,
        cwd: Option<&str>,
    ) -> ProcessInfo {
        ProcessInfo {
            pid,
            parent_pid,
            name: name.to_string(),
            executable_path: exe.map(|s| s.to_string()),
            command_line: Some(format!("{} test", name)),
            working_directory: cwd.map(|s| s.to_string()),
            status: ProcessStatus::Running,
            environment: Environment::windows(),
        }
    }

    fn make_wsl_test_proc(
        distro: &str,
        pid: u32,
        parent_pid: Option<u32>,
        name: &str,
        exe: Option<&str>,
        cwd: Option<&str>,
    ) -> ProcessInfo {
        ProcessInfo {
            pid,
            parent_pid,
            name: name.to_string(),
            executable_path: exe.map(|s| s.to_string()),
            command_line: Some(format!("{} test", name)),
            working_directory: cwd.map(|s| s.to_string()),
            status: ProcessStatus::Running,
            environment: Environment::wsl(distro),
        }
    }

    #[test]
    fn test_target_validation_successful_match() {
        let p_node = make_test_proc(
            18240,
            Some(1200),
            "node.exe",
            Some("C:\\Program Files\\nodejs\\node.exe"),
            Some("C:\\Projects\\company-frontend"),
        );
        let procs = vec![p_node];
        let ports = vec![PortInfo {
            port: 3000,
            pid: 18240,
            protocol: "tcp".to_string(),
            address: "127.0.0.1".to_string(),
            state: "listening".to_string(),
            environment: Environment::windows(),
        }];

        let target = ProcessTarget {
            pid: 18240,
            process_name: "node.exe".to_string(),
            executable_path: Some("C:\\Program Files\\nodejs\\node.exe".to_string()),
            working_directory: Some("C:\\Projects\\company-frontend".to_string()),
            expected_ports: vec![3000],
            force: false,
            environment: Some(Environment::windows()),
        };

        let service = ProcessControlService::new();
        let validated = service.validate_target(&target, &procs, &ports);

        assert!(validated.is_ok(), "Validation should succeed on exact match");
        assert_eq!(validated.unwrap().pid, 18240);
    }

    #[test]
    fn test_target_validation_pid_not_found() {
        let procs = vec![];
        let ports = vec![];

        let target = ProcessTarget {
            pid: 99999,
            process_name: "node.exe".to_string(),
            executable_path: None,
            working_directory: None,
            expected_ports: vec![3000],
            force: false,
            environment: Some(Environment::windows()),
        };

        let service = ProcessControlService::new();
        let err = service.validate_target(&target, &procs, &ports).unwrap_err();
        assert_eq!(err.code, ProcessControlErrorCode::AlreadyStopped);
    }

    #[test]
    fn test_target_validation_pid_reuse_process_name_mismatch() {
        let p_reused = make_test_proc(
            18240,
            None,
            "python.exe",
            Some("C:\\Python311\\python.exe"),
            Some("C:\\Projects\\backend"),
        );
        let procs = vec![p_reused];
        let ports = vec![];

        let target = ProcessTarget {
            pid: 18240,
            process_name: "node.exe".to_string(),
            executable_path: Some("C:\\nodejs\\node.exe".to_string()),
            working_directory: Some("C:\\Projects\\frontend".to_string()),
            expected_ports: vec![3000],
            force: false,
            environment: Some(Environment::windows()),
        };

        let service = ProcessControlService::new();
        let err = service.validate_target(&target, &procs, &ports).unwrap_err();
        assert_eq!(err.code, ProcessControlErrorCode::ProcessIdentityChanged);
        assert!(err.message.contains("Expected process 'node.exe', but found 'python.exe'"));
    }

    #[test]
    fn test_target_validation_executable_path_mismatch() {
        let p_node = make_test_proc(
            18240,
            None,
            "node.exe",
            Some("D:\\AnotherNode\\node.exe"),
            Some("C:\\Projects\\app"),
        );
        let procs = vec![p_node];
        let ports = vec![];

        let target = ProcessTarget {
            pid: 18240,
            process_name: "node.exe".to_string(),
            executable_path: Some("C:\\Program Files\\nodejs\\node.exe".to_string()),
            working_directory: Some("C:\\Projects\\app".to_string()),
            expected_ports: vec![],
            force: false,
            environment: Some(Environment::windows()),
        };

        let service = ProcessControlService::new();
        let err = service.validate_target(&target, &procs, &ports).unwrap_err();
        assert_eq!(err.code, ProcessControlErrorCode::ProcessIdentityChanged);
        assert!(err.message.contains("Executable path changed"));
    }

    #[test]
    fn test_target_validation_working_directory_mismatch() {
        let p_node = make_test_proc(
            18240,
            None,
            "node.exe",
            Some("C:\\nodejs\\node.exe"),
            Some("C:\\Projects\\project-B"),
        );
        let procs = vec![p_node];
        let ports = vec![];

        let target = ProcessTarget {
            pid: 18240,
            process_name: "node.exe".to_string(),
            executable_path: Some("C:\\nodejs\\node.exe".to_string()),
            working_directory: Some("C:\\Projects\\project-A".to_string()),
            expected_ports: vec![],
            force: false,
            environment: Some(Environment::windows()),
        };

        let service = ProcessControlService::new();
        let err = service.validate_target(&target, &procs, &ports).unwrap_err();
        assert_eq!(err.code, ProcessControlErrorCode::ProcessIdentityChanged);
        assert!(err.message.contains("Working directory changed"));
    }

    #[test]
    fn test_target_validation_protected_system_processes() {
        let service = ProcessControlService::new();
        let procs = vec![
            make_test_proc(0, None, "System Idle Process", None, None),
            make_test_proc(4, None, "System", None, None),
            make_test_proc(500, None, "explorer.exe", Some("C:\\Windows\\explorer.exe"), None),
        ];
        let ports = vec![];

        // PID 0 test
        let t_idle = ProcessTarget {
            pid: 0,
            process_name: "idle".to_string(),
            executable_path: None,
            working_directory: None,
            expected_ports: vec![],
            force: false,
            environment: Some(Environment::windows()),
        };
        let err_idle = service.validate_target(&t_idle, &procs, &ports).unwrap_err();
        assert_eq!(err_idle.code, ProcessControlErrorCode::UnsafeTarget);

        // PID 4 test
        let t_sys = ProcessTarget {
            pid: 4,
            process_name: "System".to_string(),
            executable_path: None,
            working_directory: None,
            expected_ports: vec![],
            force: false,
            environment: Some(Environment::windows()),
        };
        let err_sys = service.validate_target(&t_sys, &procs, &ports).unwrap_err();
        assert_eq!(err_sys.code, ProcessControlErrorCode::UnsafeTarget);

        // explorer.exe test
        let t_exp = ProcessTarget {
            pid: 500,
            process_name: "explorer.exe".to_string(),
            executable_path: Some("C:\\Windows\\explorer.exe".to_string()),
            working_directory: None,
            expected_ports: vec![],
            force: false,
            environment: Some(Environment::windows()),
        };
        let err_exp = service.validate_target(&t_exp, &procs, &ports).unwrap_err();
        assert_eq!(err_exp.code, ProcessControlErrorCode::UnsafeTarget);
    }

    #[test]
    fn test_descendant_discovery_and_ancestor_exclusion() {
        let p_code = make_test_proc(1000, None, "Code.exe", None, None);
        let p_pwsh = make_test_proc(1100, Some(1000), "pwsh.exe", None, None);
        let p_npm = make_test_proc(1200, Some(1100), "npm.cmd", None, None);
        let p_node = make_test_proc(18240, Some(1200), "node.exe", None, None);
        let p_esbuild = make_test_proc(18300, Some(18240), "esbuild.exe", None, None);
        let p_worker = make_test_proc(18400, Some(18300), "worker.exe", None, None);

        let procs = vec![p_code, p_pwsh, p_npm, p_node, p_esbuild, p_worker];
        let map: HashMap<u32, &ProcessInfo> = procs.iter().map(|p| (p.pid, p)).collect();

        let service = ProcessControlService::new();
        let descendants = service.find_descendants(18240, &map);

        assert_eq!(descendants.len(), 2);
        assert!(descendants.contains(&18300));
        assert!(descendants.contains(&18400));

        assert!(!descendants.contains(&18240), "Target itself must not be in descendants");
        assert!(!descendants.contains(&1200), "npm parent must not be in descendants");
        assert!(!descendants.contains(&1100), "pwsh grandparent must not be in descendants");
        assert!(!descendants.contains(&1000), "Code.exe ancestor must not be in descendants");
    }

    #[test]
    fn test_descendant_discovery_cycle_protection() {
        let p1 = make_test_proc(2000, Some(2002), "proc1.exe", None, None);
        let p2 = make_test_proc(2001, Some(2000), "proc2.exe", None, None);
        let p3 = make_test_proc(2002, Some(2001), "proc3.exe", None, None);

        let procs = vec![p1, p2, p3];
        let map: HashMap<u32, &ProcessInfo> = procs.iter().map(|p| (p.pid, p)).collect();

        let service = ProcessControlService::new();
        let descendants = service.find_descendants(2000, &map);

        assert_eq!(descendants.len(), 2);
        assert!(descendants.contains(&2001));
        assert!(descendants.contains(&2002));
        assert!(!descendants.contains(&2000));
    }

    #[test]
    fn test_stop_server_end_to_end_mocked_success() {
        let p_node = make_test_proc(18240, None, "node.exe", Some("C:\\nodejs\\node.exe"), None);
        let p_worker = make_test_proc(18250, Some(18240), "node.exe", None, None);

        let proc_mock = Arc::new(MockProcessDiscovery {
            processes: vec![p_node, p_worker],
        });

        let port_mock = Arc::new(MockPortDiscovery {
            ports: Mutex::new(vec![PortInfo {
                port: 3000,
                pid: 18240,
                protocol: "tcp".to_string(),
                address: "127.0.0.1".to_string(),
                state: "listening".to_string(),
                environment: Environment::windows(),
            }]),
        });

        let ctrl_mock = Arc::new(MockProcessController::new(&[18240, 18250]));

        let service = ProcessControlService::with_dependencies(
            proc_mock.clone(),
            port_mock.clone(),
            ctrl_mock.clone(),
        );

        let target = ProcessTarget {
            pid: 18240,
            process_name: "node.exe".to_string(),
            executable_path: Some("C:\\nodejs\\node.exe".to_string()),
            working_directory: None,
            expected_ports: vec![3000],
            force: false,
            environment: Some(Environment::windows()),
        };

        // Clear port on termination to simulate OS freeing socket
        port_mock.ports.lock().unwrap().clear();

        let result = service.stop_server(&target).expect("Stop server should succeed");

        assert_eq!(result.status, ControlStatus::Stopped);
        assert_eq!(result.pid, 18240);
        assert_eq!(result.released_ports, vec![3000]);
        assert_eq!(result.remaining_children, Vec::<u32>::new());

        let terminated = ctrl_mock.terminated_pids.lock().unwrap();
        assert!(terminated.contains(&18250), "Descendant 18250 should be terminated");
        assert!(terminated.contains(&18240), "Target 18240 should be terminated");
    }

    #[test]
    fn test_stop_server_port_owner_changed_diagnostic() {
        let p_node = make_test_proc(18240, None, "node.exe", None, None);
        let p_new_python = make_test_proc(19320, None, "python.exe", None, None);

        let proc_mock = Arc::new(MockProcessDiscovery {
            processes: vec![p_node, p_new_python],
        });

        let port_mock = Arc::new(MockPortDiscovery {
            ports: Mutex::new(vec![PortInfo {
                port: 3000,
                pid: 19320,
                protocol: "tcp".to_string(),
                address: "127.0.0.1".to_string(),
                state: "listening".to_string(),
                environment: Environment::windows(),
            }]),
        });

        let ctrl_mock = Arc::new(MockProcessController::new(&[18240]));

        let service = ProcessControlService::with_dependencies(
            proc_mock,
            port_mock,
            ctrl_mock,
        );

        let target = ProcessTarget {
            pid: 18240,
            process_name: "node.exe".to_string(),
            executable_path: None,
            working_directory: None,
            expected_ports: vec![3000],
            force: false,
            environment: Some(Environment::windows()),
        };

        let result = service.stop_server(&target).expect("Should return diagnostic result");
        assert_eq!(result.status, ControlStatus::PortOwnerChanged);
        assert_eq!(result.pid, 18240);
        assert!(result.remaining_owner.is_some());
        let owner = result.remaining_owner.unwrap();
        assert_eq!(owner.pid, 19320);
        assert_eq!(owner.process_name, "python.exe");
        assert_eq!(owner.port, 3000);
    }

    // --- WSL Process Control Unit Tests (Milestone 11) ---

    #[test]
    fn test_wsl_target_validation_successful_match() {
        let p_wsl_node = make_wsl_test_proc(
            "Fedora",
            421,
            Some(390),
            "node",
            Some("/usr/bin/node"),
            Some("/home/dev/app"),
        );
        let procs = vec![p_wsl_node];
        let ports = vec![PortInfo {
            port: 5000,
            pid: 421,
            protocol: "tcp".to_string(),
            address: "127.0.0.1".to_string(),
            state: "listening".to_string(),
            environment: Environment::wsl("Fedora"),
        }];

        let target = ProcessTarget {
            pid: 421,
            process_name: "node".to_string(),
            executable_path: Some("/usr/bin/node".to_string()),
            working_directory: Some("/home/dev/app".to_string()),
            expected_ports: vec![5000],
            force: false,
            environment: Some(Environment::wsl("Fedora")),
        };

        let service = ProcessControlService::new();
        let validated = service.validate_target(&target, &procs, &ports);

        assert!(validated.is_ok(), "Validation should succeed for WSL target");
        assert_eq!(validated.unwrap().pid, 421);
    }

    #[test]
    fn test_wsl_target_validation_protected_init() {
        let procs = vec![make_wsl_test_proc(
            "Ubuntu",
            1,
            None,
            "systemd",
            Some("/sbin/init"),
            None,
        )];
        let ports = vec![];

        let target = ProcessTarget {
            pid: 1,
            process_name: "systemd".to_string(),
            executable_path: None,
            working_directory: None,
            expected_ports: vec![],
            force: false,
            environment: Some(Environment::wsl("Ubuntu")),
        };

        let service = ProcessControlService::new();
        let err = service.validate_target(&target, &procs, &ports).unwrap_err();
        assert_eq!(err.code, ProcessControlErrorCode::UnsafeTarget);
        assert!(err.message.contains("critical Linux system init process"));
    }

    #[test]
    fn test_wsl_target_validation_pid_reuse_name_mismatch() {
        let p_python = make_wsl_test_proc("Fedora", 421, None, "python3", None, None);
        let procs = vec![p_python];
        let ports = vec![];

        let target = ProcessTarget {
            pid: 421,
            process_name: "node".to_string(),
            executable_path: None,
            working_directory: None,
            expected_ports: vec![],
            force: false,
            environment: Some(Environment::wsl("Fedora")),
        };

        let service = ProcessControlService::new();
        let err = service.validate_target(&target, &procs, &ports).unwrap_err();
        assert_eq!(err.code, ProcessControlErrorCode::ProcessIdentityChanged);
        assert!(err.message.contains("Expected process 'node', but found 'python3'"));
    }

    #[test]
    fn test_wsl_stop_server_end_to_end_success() {
        let p_bash = make_wsl_test_proc("Fedora", 300, Some(1), "bash", Some("/bin/bash"), None);
        let p_node = make_wsl_test_proc("Fedora", 421, Some(300), "node", Some("/usr/bin/node"), Some("/home/dev/app"));
        let p_worker = make_wsl_test_proc("Fedora", 422, Some(421), "node", Some("/usr/bin/node"), Some("/home/dev/app"));

        let win_proc_disc = Arc::new(MockProcessDiscovery { processes: vec![] });
        let win_port_disc = Arc::new(MockPortDiscovery { ports: Mutex::new(vec![]) });
        let win_ctrl = Arc::new(MockProcessController::new(&[]));

        let wsl_distro_disc = Arc::new(MockWslDistroDiscovery {
            distros: vec![WslDistribution {
                name: "Fedora".to_string(),
                state: WslDistroState::Running,
                is_default: true,
                version: Some(2),
            }],
        });

        let wsl_proc_disc = Arc::new(MockWslProcessDiscovery {
            procs: Mutex::new(vec![p_bash, p_node, p_worker]),
        });

        let wsl_port_disc = Arc::new(MockWslPortDiscovery {
            ports: Mutex::new(vec![PortInfo {
                port: 5000,
                pid: 421,
                protocol: "tcp".to_string(),
                address: "127.0.0.1".to_string(),
                state: "listening".to_string(),
                environment: Environment::wsl("Fedora"),
            }]),
        });

        let wsl_ctrl = Arc::new(MockWslController::new(&[421, 422]));

        let service = ProcessControlService::with_all_dependencies(
            win_proc_disc,
            win_port_disc,
            win_ctrl,
            wsl_distro_disc,
            wsl_proc_disc.clone(),
            wsl_port_disc.clone(),
            wsl_ctrl.clone(),
        );

        let target = ProcessTarget {
            pid: 421,
            process_name: "node".to_string(),
            executable_path: Some("/usr/bin/node".to_string()),
            working_directory: Some("/home/dev/app".to_string()),
            expected_ports: vec![5000],
            force: false,
            environment: Some(Environment::wsl("Fedora")),
        };

        // Simulate port freed on termination
        wsl_port_disc.ports.lock().unwrap().clear();

        let result = service.stop_server(&target).expect("WSL stop should succeed");

        assert_eq!(result.status, ControlStatus::Stopped);
        assert_eq!(result.pid, 421);
        assert_eq!(result.released_ports, vec![5000]);

        // Verify that target and descendant were terminated gracefully (SIGTERM)
        let graceful = wsl_ctrl.terminated_graceful.lock().unwrap();
        assert!(graceful.contains(&422), "Descendant 422 must be terminated");
        assert!(graceful.contains(&421), "Target 421 must be terminated");
        assert!(!graceful.contains(&300), "Parent bash 300 MUST NOT be terminated");
    }

    #[test]
    fn test_wsl_stop_server_stopped_distro_rejected() {
        let win_proc_disc = Arc::new(MockProcessDiscovery { processes: vec![] });
        let win_port_disc = Arc::new(MockPortDiscovery { ports: Mutex::new(vec![]) });
        let win_ctrl = Arc::new(MockProcessController::new(&[]));

        let wsl_distro_disc = Arc::new(MockWslDistroDiscovery {
            distros: vec![WslDistribution {
                name: "Ubuntu".to_string(),
                state: WslDistroState::Stopped,
                is_default: true,
                version: Some(2),
            }],
        });

        let wsl_proc_disc = Arc::new(MockWslProcessDiscovery { procs: Mutex::new(vec![]) });
        let wsl_port_disc = Arc::new(MockWslPortDiscovery { ports: Mutex::new(vec![]) });
        let wsl_ctrl = Arc::new(MockWslController::new(&[]));

        let service = ProcessControlService::with_all_dependencies(
            win_proc_disc,
            win_port_disc,
            win_ctrl,
            wsl_distro_disc,
            wsl_proc_disc,
            wsl_port_disc,
            wsl_ctrl,
        );

        let target = ProcessTarget {
            pid: 421,
            process_name: "node".to_string(),
            executable_path: None,
            working_directory: None,
            expected_ports: vec![],
            force: false,
            environment: Some(Environment::wsl("Ubuntu")),
        };

        let err = service.stop_server(&target).unwrap_err();
        assert_eq!(err.code, ProcessControlErrorCode::WslDistributionStopped);
        assert!(err.message.contains("is currently stopped"));
    }

    #[test]
    fn test_wsl_stop_server_distro_not_found() {
        let win_proc_disc = Arc::new(MockProcessDiscovery { processes: vec![] });
        let win_port_disc = Arc::new(MockPortDiscovery { ports: Mutex::new(vec![]) });
        let win_ctrl = Arc::new(MockProcessController::new(&[]));

        let wsl_distro_disc = Arc::new(MockWslDistroDiscovery {
            distros: vec![],
        });

        let wsl_proc_disc = Arc::new(MockWslProcessDiscovery { procs: Mutex::new(vec![]) });
        let wsl_port_disc = Arc::new(MockWslPortDiscovery { ports: Mutex::new(vec![]) });
        let wsl_ctrl = Arc::new(MockWslController::new(&[]));

        let service = ProcessControlService::with_all_dependencies(
            win_proc_disc,
            win_port_disc,
            win_ctrl,
            wsl_distro_disc,
            wsl_proc_disc,
            wsl_port_disc,
            wsl_ctrl,
        );

        let target = ProcessTarget {
            pid: 421,
            process_name: "node".to_string(),
            executable_path: None,
            working_directory: None,
            expected_ports: vec![],
            force: false,
            environment: Some(Environment::wsl("NonExistentDistro")),
        };

        let err = service.stop_server(&target).unwrap_err();
        assert_eq!(err.code, ProcessControlErrorCode::WslDistributionNotFound);
        assert!(err.message.contains("was not found on this host"));
    }
}
