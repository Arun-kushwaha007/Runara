use crate::wsl::executor::{DefaultWslExecutor, WslCommandOutput, WslExecutionError, WslExecutor};
use std::sync::Arc;
use std::thread::sleep;
use std::time::Duration;

/// Default timeout for WSL signal execution commands (3000ms).
pub const WSL_SIGNAL_TIMEOUT_MS: u64 = 3000;

/// Trait defining process control operations inside WSL distributions.
pub trait WslProcessController: Send + Sync {
    /// Sends a POSIX signal to one or more PIDs inside the specified WSL distribution.
    fn send_signal(
        &self,
        distro: &str,
        pids: &[u32],
        signal: i32,
    ) -> Result<WslCommandOutput, WslExecutionError>;

    /// Checks if a Linux process with the given PID is alive inside the specified distribution (via `kill -0`).
    fn is_process_alive(&self, distro: &str, pid: u32) -> bool;

    /// Attempts graceful process termination (SIGTERM = 15) of the given PIDs.
    fn terminate_graceful(&self, distro: &str, pids: &[u32]) -> Result<(), WslExecutionError>;

    /// Forces process termination (SIGKILL = 9) of the given PIDs.
    fn terminate_force(&self, distro: &str, pids: &[u32]) -> Result<(), WslExecutionError>;

    /// Waits up to `timeout_ms` for a process to exit inside the specified distribution.
    /// Returns `Ok(true)` if the process exited within the timeout, `Ok(false)` if timed out.
    fn wait_for_exit(
        &self,
        distro: &str,
        pid: u32,
        timeout_ms: u64,
    ) -> Result<bool, WslExecutionError>;
}

/// Default implementation of `WslProcessController` executing Linux `kill` through `WslExecutor`.
pub struct DefaultWslProcessController {
    executor: Arc<dyn WslExecutor>,
}

impl DefaultWslProcessController {
    pub fn new() -> Self {
        Self {
            executor: Arc::new(DefaultWslExecutor::new()),
        }
    }

    pub fn with_executor(executor: Arc<dyn WslExecutor>) -> Self {
        Self { executor }
    }
}

impl Default for DefaultWslProcessController {
    fn default() -> Self {
        Self::new()
    }
}

impl WslProcessController for DefaultWslProcessController {
    fn send_signal(
        &self,
        distro: &str,
        pids: &[u32],
        signal: i32,
    ) -> Result<WslCommandOutput, WslExecutionError> {
        if pids.is_empty() {
            return Ok(WslCommandOutput {
                stdout: String::new(),
                stderr: String::new(),
                exit_code: 0,
                success: true,
            });
        }

        let sig_str = format!("-{}", signal.abs());
        let pid_strings: Vec<String> = pids.iter().map(|p| p.to_string()).collect();
        let mut args: Vec<&str> = Vec::with_capacity(1 + pid_strings.len());
        args.push(&sig_str);
        for pid_s in &pid_strings {
            args.push(pid_s.as_str());
        }

        self.executor.execute(distro, "kill", &args, WSL_SIGNAL_TIMEOUT_MS)
    }

    fn is_process_alive(&self, distro: &str, pid: u32) -> bool {
        // PID 0 or PID 1 are always considered alive in a running Linux environment
        if pid == 0 || pid == 1 {
            return true;
        }

        let pid_str = pid.to_string();
        // kill -0 checks if a process exists and if the caller has permission to send signals to it.
        // Return codes:
        // 0 -> process exists and is alive.
        // 1 (with "Operation not permitted" / EPERM) -> process exists but is owned by another user (still alive).
        // 1 (with "No such process" / ESRCH) -> process does not exist.
        match self.executor.execute(distro, "kill", &["-0", &pid_str], 2000) {
            Ok(output) => {
                if output.success || output.exit_code == 0 {
                    true
                } else if output.stderr.to_lowercase().contains("operation not permitted") {
                    true
                } else {
                    false
                }
            }
            Err(_) => false,
        }
    }

    fn terminate_graceful(&self, distro: &str, pids: &[u32]) -> Result<(), WslExecutionError> {
        if pids.is_empty() {
            return Ok(());
        }

        // SIGTERM = 15
        let output = self.send_signal(distro, pids, 15)?;
        // If exit code is non-zero, check if processes were already dead or permission denied
        if !output.success && !output.stderr.is_empty() {
            let lower = output.stderr.to_lowercase();
            if lower.contains("no such process") {
                // Process already exited, treat as successful termination
                return Ok(());
            }
            if lower.contains("operation not permitted") {
                return Err(WslExecutionError::CommandFailed {
                    distro: Some(distro.to_string()),
                    command: format!("kill -15 {:?}", pids),
                    message: format!("Operation not permitted. Elevated root/sudo permissions may be required: {}", output.stderr),
                });
            }
        }

        Ok(())
    }

    fn terminate_force(&self, distro: &str, pids: &[u32]) -> Result<(), WslExecutionError> {
        if pids.is_empty() {
            return Ok(());
        }

        // SIGKILL = 9
        let output = self.send_signal(distro, pids, 9)?;
        if !output.success && !output.stderr.is_empty() {
            let lower = output.stderr.to_lowercase();
            if lower.contains("no such process") {
                return Ok(());
            }
            if lower.contains("operation not permitted") {
                return Err(WslExecutionError::CommandFailed {
                    distro: Some(distro.to_string()),
                    command: format!("kill -9 {:?}", pids),
                    message: format!("Operation not permitted. Elevated root/sudo permissions may be required: {}", output.stderr),
                });
            }
        }

        Ok(())
    }

    fn wait_for_exit(
        &self,
        distro: &str,
        pid: u32,
        timeout_ms: u64,
    ) -> Result<bool, WslExecutionError> {
        let slice_ms = 100u64;
        let mut elapsed = 0u64;

        while elapsed < timeout_ms {
            if !self.is_process_alive(distro, pid) {
                return Ok(true);
            }
            sleep(Duration::from_millis(slice_ms));
            elapsed += slice_ms;
        }

        Ok(!self.is_process_alive(distro, pid))
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use std::sync::Mutex;

    pub struct MockWslController {
        alive_pids: Mutex<std::collections::HashSet<u32>>,
        pub terminated_graceful: Mutex<Vec<u32>>,
        pub terminated_force: Mutex<Vec<u32>>,
    }

    impl MockWslController {
        pub fn new(pids: &[u32]) -> Self {
            let mut set = std::collections::HashSet::new();
            for &p in pids {
                set.insert(p);
            }
            Self {
                alive_pids: Mutex::new(set),
                terminated_graceful: Mutex::new(Vec::new()),
                terminated_force: Mutex::new(Vec::new()),
            }
        }
    }

    impl WslProcessController for MockWslController {
        fn send_signal(
            &self,
            _distro: &str,
            pids: &[u32],
            signal: i32,
        ) -> Result<WslCommandOutput, WslExecutionError> {
            let mut alive = self.alive_pids.lock().unwrap();
            for &pid in pids {
                alive.remove(&pid);
                if signal == 15 {
                    self.terminated_graceful.lock().unwrap().push(pid);
                } else if signal == 9 {
                    self.terminated_force.lock().unwrap().push(pid);
                }
            }
            Ok(WslCommandOutput {
                stdout: String::new(),
                stderr: String::new(),
                exit_code: 0,
                success: true,
            })
        }

        fn is_process_alive(&self, _distro: &str, pid: u32) -> bool {
            if pid == 0 || pid == 1 {
                return true;
            }
            self.alive_pids.lock().unwrap().contains(&pid)
        }

        fn terminate_graceful(&self, distro: &str, pids: &[u32]) -> Result<(), WslExecutionError> {
            self.send_signal(distro, pids, 15).map(|_| ())
        }

        fn terminate_force(&self, distro: &str, pids: &[u32]) -> Result<(), WslExecutionError> {
            self.send_signal(distro, pids, 9).map(|_| ())
        }

        fn wait_for_exit(
            &self,
            distro: &str,
            pid: u32,
            _timeout_ms: u64,
        ) -> Result<bool, WslExecutionError> {
            Ok(!self.is_process_alive(distro, pid))
        }
    }

    struct MockWslExecutorWithState {
        alive_pids: Mutex<std::collections::HashSet<u32>>,
    }

    impl WslExecutor for MockWslExecutorWithState {
        fn execute(
            &self,
            _distro: &str,
            command: &str,
            args: &[&str],
            _timeout_ms: u64,
        ) -> Result<WslCommandOutput, WslExecutionError> {
            if command == "kill" {
                if args.is_empty() {
                    return Ok(WslCommandOutput {
                        stdout: String::new(),
                        stderr: String::new(),
                        exit_code: 0,
                        success: true,
                    });
                }
                let sig = args[0];
                let mut alive = self.alive_pids.lock().unwrap();

                if sig == "-0" {
                    let pid: u32 = args[1].parse().unwrap_or(0);
                    if alive.contains(&pid) {
                        return Ok(WslCommandOutput {
                            stdout: String::new(),
                            stderr: String::new(),
                            exit_code: 0,
                            success: true,
                        });
                    } else {
                        return Ok(WslCommandOutput {
                            stdout: String::new(),
                            stderr: format!("kill: ({}): No such process", pid),
                            exit_code: 1,
                            success: false,
                        });
                    }
                }

                if sig == "-15" || sig == "-9" {
                    for &arg in &args[1..] {
                        if let Ok(pid) = arg.parse::<u32>() {
                            alive.remove(&pid);
                        }
                    }
                    return Ok(WslCommandOutput {
                        stdout: String::new(),
                        stderr: String::new(),
                        exit_code: 0,
                        success: true,
                    });
                }
            }

            Ok(WslCommandOutput {
                stdout: String::new(),
                stderr: String::new(),
                exit_code: 0,
                success: true,
            })
        }

        fn execute_host(
            &self,
            _args: &[&str],
            _timeout_ms: u64,
        ) -> Result<WslCommandOutput, WslExecutionError> {
            Ok(WslCommandOutput {
                stdout: String::new(),
                stderr: String::new(),
                exit_code: 0,
                success: true,
            })
        }
    }

    #[test]
    fn test_wsl_controller_graceful_termination() {
        let mut initial_pids = std::collections::HashSet::new();
        initial_pids.insert(421);
        initial_pids.insert(422);

        let executor = Arc::new(MockWslExecutorWithState {
            alive_pids: Mutex::new(initial_pids),
        });
        let controller = DefaultWslProcessController::with_executor(executor.clone());

        assert!(controller.is_process_alive("Fedora", 421));
        assert!(controller.is_process_alive("Fedora", 422));

        let res = controller.terminate_graceful("Fedora", &[422, 421]);
        assert!(res.is_ok());

        assert!(!controller.is_process_alive("Fedora", 421));
        assert!(!controller.is_process_alive("Fedora", 422));
    }

    #[test]
    fn test_wsl_controller_force_termination() {
        let mut initial_pids = std::collections::HashSet::new();
        initial_pids.insert(500);

        let executor = Arc::new(MockWslExecutorWithState {
            alive_pids: Mutex::new(initial_pids),
        });
        let controller = DefaultWslProcessController::with_executor(executor.clone());

        assert!(controller.is_process_alive("Ubuntu", 500));

        let res = controller.terminate_force("Ubuntu", &[500]);
        assert!(res.is_ok());

        assert!(!controller.is_process_alive("Ubuntu", 500));
    }

    #[test]
    fn test_wsl_controller_wait_for_exit() {
        let mut initial_pids = std::collections::HashSet::new();
        initial_pids.insert(600);

        let executor = Arc::new(MockWslExecutorWithState {
            alive_pids: Mutex::new(initial_pids),
        });
        let controller = DefaultWslProcessController::with_executor(executor.clone());

        // Process is alive, then terminated
        assert!(controller.is_process_alive("Fedora", 600));
        let _ = controller.terminate_graceful("Fedora", &[600]);

        let exited = controller.wait_for_exit("Fedora", 600, 500).unwrap();
        assert!(exited);
    }
}
