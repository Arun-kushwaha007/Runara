use crate::models::environment::Environment;
use crate::models::process::{ProcessInfo, ProcessStatus};
use crate::wsl::executor::{DefaultWslExecutor, WslExecutionError, WslExecutor};
use std::sync::Arc;

/// Default timeout for WSL process discovery (4 seconds).
pub const WSL_PROCESS_TIMEOUT_MS: u64 = 4000;

/// Trait defining WSL process discovery abstraction.
pub trait WslProcessDiscovery: Send + Sync {
    /// Discovers all Linux processes inside the specified running WSL distribution.
    fn enumerate(&self, distro: &str) -> Result<Vec<ProcessInfo>, WslExecutionError>;
}

/// Default implementation of `WslProcessDiscovery` using `ps` inside the Linux guest.
pub struct DefaultWslProcessDiscovery {
    executor: Arc<dyn WslExecutor>,
}

impl DefaultWslProcessDiscovery {
    pub fn new() -> Self {
        Self {
            executor: Arc::new(DefaultWslExecutor::new()),
        }
    }

    pub fn with_executor(executor: Arc<dyn WslExecutor>) -> Self {
        Self { executor }
    }
}

impl Default for DefaultWslProcessDiscovery {
    fn default() -> Self {
        Self::new()
    }
}

impl WslProcessDiscovery for DefaultWslProcessDiscovery {
    fn enumerate(&self, distro: &str) -> Result<Vec<ProcessInfo>, WslExecutionError> {
        let output = self.executor.execute(
            distro,
            "ps",
            &["-eo", "pid,ppid,comm,args", "--no-headers"],
            WSL_PROCESS_TIMEOUT_MS,
        )?;

        if !output.success && output.stdout.trim().is_empty() {
            return Err(WslExecutionError::CommandFailed {
                distro: Some(distro.to_string()),
                command: "ps -eo pid,ppid,comm,args --no-headers".to_string(),
                message: if !output.stderr.is_empty() {
                    output.stderr
                } else {
                    format!("ps exited with code {}", output.exit_code)
                },
            });
        }

        let mut processes = parse_wsl_ps_output(&output.stdout, distro);
        processes.sort_by_key(|p| p.pid);
        Ok(processes)
    }
}

/// Parses the output of `ps -eo pid,ppid,comm,args --no-headers` from a Linux distribution.
///
/// Example raw output:
/// ```text
///      1       0 systemd         /sbin/init
///    240       1 redis-server    /usr/bin/redis-server 127.0.0.1:6379
///    421     390 node            npm run dev
///    945     695 python3         python3 -m http.server 8000
/// ```
pub fn parse_wsl_ps_output(raw_output: &str, distro: &str) -> Vec<ProcessInfo> {
    let mut processes = Vec::new();
    let env = Environment::wsl(distro);

    for line in raw_output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        // Clean null bytes if any
        let clean_line = trimmed.replace('\0', "");
        let clean_trimmed = clean_line.trim();
        if clean_trimmed.is_empty() {
            continue;
        }

        // Split into at most 4 segments: pid, ppid, comm, args
        let mut parts = clean_trimmed.split_whitespace();
        let pid_str = match parts.next() {
            Some(p) => p,
            None => continue,
        };
        let ppid_str = match parts.next() {
            Some(p) => p,
            None => continue,
        };
        let comm_str = match parts.next() {
            Some(c) => c,
            None => continue,
        };

        let pid = match pid_str.parse::<u32>() {
            Ok(p) => p,
            Err(_) => continue,
        };

        let ppid = match ppid_str.parse::<u32>() {
            Ok(0) => None,
            Ok(p) => Some(p),
            Err(_) => None,
        };

        let name = comm_str.to_string();

        // The remainder of the line represents the full command line arguments
        // Find position where comm ends in clean_trimmed
        let remainder = extract_args_after_comm(clean_trimmed, pid_str, ppid_str, comm_str);
        let command_line = if remainder.trim().is_empty() {
            None
        } else {
            Some(remainder.trim().to_string())
        };

        // Extract executable path if the first word of args is an absolute Linux path
        let executable_path = command_line.as_ref().and_then(|cmd| {
            let first_token = cmd.split_whitespace().next()?;
            if first_token.starts_with('/') {
                Some(first_token.to_string())
            } else {
                None
            }
        });

        processes.push(ProcessInfo {
            pid,
            parent_pid: ppid,
            name,
            executable_path,
            command_line,
            working_directory: None,
            status: ProcessStatus::Running,
            environment: env.clone(),
        });
    }

    processes
}

/// Helper function to extract args string preserving spaces inside the argument list.
fn extract_args_after_comm<'a>(
    line: &'a str,
    pid_str: &str,
    ppid_str: &str,
    comm_str: &str,
) -> &'a str {
    // Find pid token
    if let Some(pos_pid) = line.find(pid_str) {
        let after_pid = &line[pos_pid + pid_str.len()..];
        if let Some(pos_ppid) = after_pid.find(ppid_str) {
            let after_ppid = &after_pid[pos_ppid + ppid_str.len()..];
            if let Some(pos_comm) = after_ppid.find(comm_str) {
                return &after_ppid[pos_comm + comm_str.len()..];
            }
        }
    }

    ""
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::wsl::executor::WslCommandOutput;

    struct MockWslExecutor {
        output: Result<WslCommandOutput, WslExecutionError>,
    }

    impl WslExecutor for MockWslExecutor {
        fn execute(
            &self,
            _distro: &str,
            _command: &str,
            _args: &[&str],
            _timeout_ms: u64,
        ) -> Result<WslCommandOutput, WslExecutionError> {
            self.output.clone()
        }

        fn execute_host(
            &self,
            _args: &[&str],
            _timeout_ms: u64,
        ) -> Result<WslCommandOutput, WslExecutionError> {
            self.output.clone()
        }
    }

    #[test]
    fn test_parse_wsl_ps_output_synthetic() {
        let sample = "\
      1       0 systemd         /sbin/init
    240       1 redis-server    /usr/bin/redis-server 127.0.0.1:6379
    421     390 node            /usr/bin/node /home/dev/app/server.js
    945     695 python3         python3 -m http.server 8000
";
        let procs = parse_wsl_ps_output(sample, "Ubuntu");
        assert_eq!(procs.len(), 4);

        // Process 1: init
        assert_eq!(procs[0].pid, 1);
        assert_eq!(procs[0].parent_pid, None);
        assert_eq!(procs[0].name, "systemd");
        assert_eq!(procs[0].executable_path, Some("/sbin/init".to_string()));
        assert_eq!(procs[0].command_line, Some("/sbin/init".to_string()));
        assert_eq!(procs[0].environment, Environment::wsl("Ubuntu"));

        // Process 2: redis
        assert_eq!(procs[1].pid, 240);
        assert_eq!(procs[1].parent_pid, Some(1));
        assert_eq!(procs[1].name, "redis-server");
        assert_eq!(procs[1].executable_path, Some("/usr/bin/redis-server".to_string()));
        assert_eq!(
            procs[1].command_line,
            Some("/usr/bin/redis-server 127.0.0.1:6379".to_string())
        );

        // Process 3: node
        assert_eq!(procs[2].pid, 421);
        assert_eq!(procs[2].parent_pid, Some(390));
        assert_eq!(procs[2].name, "node");
        assert_eq!(procs[2].executable_path, Some("/usr/bin/node".to_string()));
        assert_eq!(
            procs[2].command_line,
            Some("/usr/bin/node /home/dev/app/server.js".to_string())
        );

        // Process 4: python3
        assert_eq!(procs[3].pid, 945);
        assert_eq!(procs[3].parent_pid, Some(695));
        assert_eq!(procs[3].name, "python3");
        assert_eq!(procs[3].executable_path, None); // relative command
        assert_eq!(
            procs[3].command_line,
            Some("python3 -m http.server 8000".to_string())
        );
    }

    #[test]
    fn test_wsl_process_discovery_with_mock() {
        let mock_output = WslCommandOutput {
            stdout: "    500     100 node        /usr/local/bin/node index.js\n".to_string(),
            stderr: String::new(),
            exit_code: 0,
            success: true,
        };

        let executor = Arc::new(MockWslExecutor {
            output: Ok(mock_output),
        });
        let discovery = DefaultWslProcessDiscovery::with_executor(executor);
        let result = discovery.enumerate("Fedora");

        assert!(result.is_ok());
        let procs = result.unwrap();
        assert_eq!(procs.len(), 1);
        assert_eq!(procs[0].pid, 500);
        assert_eq!(procs[0].environment, Environment::wsl("Fedora"));
        assert_eq!(procs[0].executable_path, Some("/usr/local/bin/node".to_string()));
    }
}
