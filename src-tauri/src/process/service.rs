use crate::discovery::{PortDiscovery, ProcessDiscovery, WindowsPortDiscovery, WindowsProcessDiscovery};
use crate::models::control::{
    ControlResult, ControlStatus, ProcessControlError, ProcessControlErrorCode, ProcessTarget,
    RemainingOwnerInfo,
};
use crate::models::{PortInfo, ProcessInfo};
use crate::windows::{
    ProcessController, WindowsProcessController, ERROR_ACCESS_DENIED,
    PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_TERMINATE, SYNCHRONIZE,
};
use std::collections::{HashMap, HashSet, VecDeque};
use std::path::Path;
use std::sync::Arc;

/// Set of known Windows system-critical process names that must never be terminated.
const PROTECTED_SYSTEM_PROCESSES: &[&str] = &[
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

/// Maximum depth bound for descendant process traversal to avoid pathological recursion.
const MAX_DESCENDANT_DEPTH: usize = 32;

/// Core service responsible for safe target validation, descendant resolution,
/// process termination, and post-termination verification.
pub struct ProcessControlService {
    process_discovery: Arc<dyn ProcessDiscovery>,
    port_discovery: Arc<dyn PortDiscovery>,
    process_controller: Arc<dyn ProcessController>,
}

impl ProcessControlService {
    /// Creates a new `ProcessControlService` using standard Windows discovery and controllers.
    pub fn new() -> Self {
        Self {
            process_discovery: Arc::new(WindowsProcessDiscovery::new()),
            port_discovery: Arc::new(WindowsPortDiscovery::new()),
            process_controller: Arc::new(WindowsProcessController::new()),
        }
    }

    /// Creates a `ProcessControlService` with injected dependencies for testing and mocking.
    pub fn with_dependencies(
        process_discovery: Arc<dyn ProcessDiscovery>,
        port_discovery: Arc<dyn PortDiscovery>,
        process_controller: Arc<dyn ProcessController>,
    ) -> Self {
        Self {
            process_discovery,
            port_discovery,
            process_controller,
        }
    }

    /// Performs safe, multi-signal pre-termination target validation against fresh OS snapshots.
    pub fn validate_target(
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
        if PROTECTED_SYSTEM_PROCESSES.iter().any(|&sys_name| sys_name == target_name_lower) {
            return Err(ProcessControlError {
                code: ProcessControlErrorCode::UnsafeTarget,
                message: format!(
                    "Refusing to terminate protected system process '{}' (PID {}).",
                    target.process_name, target.pid
                ),
                pid: Some(target.pid),
            });
        }

        // Rule 3: Find target process in current snapshot
        let target_proc = match current_processes.iter().find(|p| p.pid == target.pid) {
            Some(p) => p,
            None => {
                // Process does not exist in current process snapshot.
                // Check if the expected port is still bound by another process.
                for expected_port in &target.expected_ports {
                    if let Some(port_info) = current_ports.iter().find(|p| p.port == *expected_port) {
                        if port_info.pid != target.pid {
                            let owner_name = current_processes
                                .iter()
                                .find(|p| p.pid == port_info.pid)
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
                if !Self::normalize_path(expected_exe).eq_ignore_ascii_case(&Self::normalize_path(current_exe)) {
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
                if !Self::normalize_path(expected_cwd).eq_ignore_ascii_case(&Self::normalize_path(current_cwd)) {
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

    /// Orchestrates stopping a server target:
    /// 1. Fresh OS discovery (processes + ports).
    /// 2. Strict target validation.
    /// 3. Reconstructs descendant tree.
    /// 4. Acquires Win32 process handles.
    /// 5. Gracefully or forcefully terminates descendants and target.
    /// 6. Bounded wait for process exit.
    /// 7. Post-termination verification of process exit and port release.
    pub fn stop_server(&self, target: &ProcessTarget) -> Result<ControlResult, ProcessControlError> {
        // Step 1: Fresh process and port discovery
        let current_processes = self
            .process_discovery
            .enumerate()
            .map_err(|err| ProcessControlError {
                code: ProcessControlErrorCode::UnknownError,
                message: format!("Failed to query system processes: {}", err),
                pid: Some(target.pid),
            })?;

        let current_ports = self.port_discovery.enumerate().unwrap_or_default();

        // Step 2: Pre-termination validation
        let _validated_proc = self.validate_target(target, &current_processes, &current_ports)?;

        // Step 3: Descendant resolution
        let process_map: HashMap<u32, &ProcessInfo> =
            current_processes.iter().map(|p| (p.pid, p)).collect();
        let descendants = self.find_descendants(target.pid, &process_map);

        // Step 4: Open process handles
        let target_handle_res = self.process_controller.open_process(
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
                } else if !self.process_controller.is_process_alive(target.pid) {
                    // Process already exited between snapshot and handle open
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
            if let Ok(h) = self.process_controller.open_process(
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
            if let Err(_err) = self.process_controller.terminate_process(desc_handle, 1) {
                if self.process_controller.is_process_alive(pid) {
                    remaining_children.push(pid);
                }
            }
        }

        // Terminate target process
        if let Some(ref handle) = target_handle {
            if let Err(err_code) = self.process_controller.terminate_process(handle, 1) {
                if self.process_controller.is_process_alive(target.pid) {
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
                if let Ok(exited) = self.process_controller.wait_for_exit(handle, slice_ms) {
                    if exited {
                        target_exited = true;
                        break;
                    }
                }
            } else if !self.process_controller.is_process_alive(target.pid) {
                target_exited = true;
                break;
            }
            elapsed_ms += slice_ms;
        }

        if !target_exited && self.process_controller.is_process_alive(target.pid) {
            return Err(ProcessControlError {
                code: ProcessControlErrorCode::Timeout,
                message: format!(
                    "Server process (PID {}) did not exit within {} ms. Try using Force Stop.",
                    target.pid, wait_timeout_ms
                ),
                pid: Some(target.pid),
            });
        }

        // Drop handles before post-termination verification
        drop(target_handle);
        drop(descendant_handles);

        // Step 7: Post-termination verification
        self.verify_termination(target, &descendants, &remaining_children)
    }

    /// Verifies that the process has exited and inspects whether expected ports were freed or rebound.
    fn verify_termination(
        &self,
        target: &ProcessTarget,
        _descendants: &[u32],
        remaining_children: &[u32],
    ) -> Result<ControlResult, ProcessControlError> {
        // Check fresh ports table
        let fresh_ports = self.port_discovery.enumerate().unwrap_or_default();
        let mut released_ports = Vec::new();
        let mut occupied_ports = Vec::new();
        let mut new_owner_info: Option<RemainingOwnerInfo> = None;

        for &port_num in &target.expected_ports {
            if let Some(port_entry) = fresh_ports.iter().find(|p| p.port == port_num) {
                occupied_ports.push(port_num);
                if new_owner_info.is_none() {
                    let owner_pid = port_entry.pid;
                    let procs = self.process_discovery.enumerate().unwrap_or_default();
                    let owner_name = procs
                        .iter()
                        .find(|p| p.pid == owner_pid)
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
    use crate::models::ProcessStatus;
    use crate::windows::ProcessHandle;
    use std::sync::Mutex;

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
                // Use a non-null dummy pointer for test handle
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
        }];

        let target = ProcessTarget {
            pid: 18240,
            process_name: "node.exe".to_string(),
            executable_path: Some("C:\\Program Files\\nodejs\\node.exe".to_string()),
            working_directory: Some("C:\\Projects\\company-frontend".to_string()),
            expected_ports: vec![3000],
            force: false,
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
        };

        let service = ProcessControlService::new();
        let err = service.validate_target(&target, &procs, &ports).unwrap_err();
        assert_eq!(err.code, ProcessControlErrorCode::AlreadyStopped);
    }

    #[test]
    fn test_target_validation_pid_reuse_process_name_mismatch() {
        // Original target was node.exe on PID 18240.
        // Current process on PID 18240 is now python.exe.
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
        };
        let err_exp = service.validate_target(&t_exp, &procs, &ports).unwrap_err();
        assert_eq!(err_exp.code, ProcessControlErrorCode::UnsafeTarget);
    }

    #[test]
    fn test_descendant_discovery_and_ancestor_exclusion() {
        // Hierarchy:
        // Code.exe (1000) -> pwsh.exe (1100) -> npm.cmd (1200) -> node.exe (18240) -> esbuild.exe (18300) -> worker (18400)
        let p_code = make_test_proc(1000, None, "Code.exe", None, None);
        let p_pwsh = make_test_proc(1100, Some(1000), "pwsh.exe", None, None);
        let p_npm = make_test_proc(1200, Some(1100), "npm.cmd", None, None);
        let p_node = make_test_proc(18240, Some(1200), "node.exe", None, None);
        let p_esbuild = make_test_proc(18300, Some(18240), "esbuild.exe", None, None);
        let p_worker = make_test_proc(18400, Some(18300), "worker.exe", None, None);

        let procs = vec![p_code, p_pwsh, p_npm, p_node, p_esbuild, p_worker];
        let map: HashMap<u32, &ProcessInfo> = procs.iter().map(|p| (p.pid, p)).collect();

        let service = ProcessControlService::new();

        // Target: node.exe (18240)
        let descendants = service.find_descendants(18240, &map);

        // MUST contain children and grandchildren
        assert_eq!(descendants.len(), 2);
        assert!(descendants.contains(&18300));
        assert!(descendants.contains(&18400));

        // MUST NEVER contain ancestors or target itself
        assert!(!descendants.contains(&18240), "Target itself must not be in descendants");
        assert!(!descendants.contains(&1200), "npm parent must not be in descendants");
        assert!(!descendants.contains(&1100), "pwsh grandparent must not be in descendants");
        assert!(!descendants.contains(&1000), "Code.exe ancestor must not be in descendants");
    }

    #[test]
    fn test_descendant_discovery_cycle_protection() {
        // Create a cycle: 2000 -> 2001 -> 2002 -> 2000
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
        };

        // Clear port on termination to simulate OS freeing socket
        port_mock.ports.lock().unwrap().clear();

        let result = service.stop_server(&target).expect("Stop server should succeed");

        assert_eq!(result.status, ControlStatus::Stopped);
        assert_eq!(result.pid, 18240);
        assert_eq!(result.released_ports, vec![3000]);
        assert_eq!(result.remaining_children, Vec::<u32>::new());

        // Verify that mock controller terminated both child and parent
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
                pid: 19320, // New owner took port 3000
                protocol: "tcp".to_string(),
                address: "127.0.0.1".to_string(),
                state: "listening".to_string(),
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
}
