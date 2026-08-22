use crate::models::environment::Environment;
use crate::models::port::PortInfo;
use crate::wsl::executor::{DefaultWslExecutor, WslExecutionError, WslExecutor};
use std::sync::Arc;

/// Default timeout for WSL listening port discovery (4 seconds).
pub const WSL_PORT_TIMEOUT_MS: u64 = 4000;

/// Trait defining WSL listening port discovery abstraction.
pub trait WslPortDiscovery: Send + Sync {
    /// Discovers all listening TCP ports inside the specified running WSL distribution.
    fn enumerate(&self, distro: &str) -> Result<Vec<PortInfo>, WslExecutionError>;
}

/// Default implementation of `WslPortDiscovery` using `ss -tlpn -H` in the Linux guest.
pub struct DefaultWslPortDiscovery {
    executor: Arc<dyn WslExecutor>,
}

impl DefaultWslPortDiscovery {
    pub fn new() -> Self {
        Self {
            executor: Arc::new(DefaultWslExecutor::new()),
        }
    }

    pub fn with_executor(executor: Arc<dyn WslExecutor>) -> Self {
        Self { executor }
    }
}

impl Default for DefaultWslPortDiscovery {
    fn default() -> Self {
        Self::new()
    }
}

impl WslPortDiscovery for DefaultWslPortDiscovery {
    fn enumerate(&self, distro: &str) -> Result<Vec<PortInfo>, WslExecutionError> {
        let output = self
            .executor
            .execute(distro, "ss", &["-tlpn", "-H"], WSL_PORT_TIMEOUT_MS)?;

        if !output.success && output.stdout.trim().is_empty() {
            return Err(WslExecutionError::CommandFailed {
                distro: Some(distro.to_string()),
                command: "ss -tlpn -H".to_string(),
                message: if !output.stderr.is_empty() {
                    output.stderr
                } else {
                    format!("ss exited with code {}", output.exit_code)
                },
            });
        }

        let mut ports = parse_wsl_ss_output(&output.stdout, distro);
        ports.sort_by(|a, b| {
            a.port
                .cmp(&b.port)
                .then_with(|| a.address.cmp(&b.address))
                .then_with(|| a.pid.cmp(&b.pid))
        });
        ports.dedup();

        Ok(ports)
    }
}

/// Parses the tabular stdout output of `ss -tlpn -H` from a Linux distribution.
///
/// Example raw output:
/// ```text
/// LISTEN 0      5             0.0.0.0:8000  0.0.0.0:* users:(("python3",pid=945,fd=3))
/// LISTEN 0      1024        127.0.0.1:11211 0.0.0.0:* users:(("memcached",pid=246,fd=26))
/// LISTEN 0      4096                *:4369        *:* users:(("epmd",pid=242,fd=3),("systemd",pid=1,fd=60))
/// LISTEN 0      4096             [::]:22       [::]:* users:(("systemd",pid=1,fd=66))
/// LISTEN 0      511             [::1]:6379     [::]:* users:(("redis-server",pid=252,fd=7))
/// ```
pub fn parse_wsl_ss_output(raw_output: &str, distro: &str) -> Vec<PortInfo> {
    let mut ports = Vec::new();
    let env = Environment::wsl(distro);

    for line in raw_output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let clean_line = trimmed.replace('\0', "");
        let clean_trimmed = clean_line.trim();
        if clean_trimmed.is_empty() {
            continue;
        }

        let tokens: Vec<&str> = clean_trimmed.split_whitespace().collect();
        if tokens.len() < 4 {
            continue;
        }

        // Token 0 is typically "LISTEN" or "UNCONN" etc.
        let state_token = tokens[0].to_lowercase();
        if state_token != "listen" && state_token != "listening" {
            continue;
        }

        // Token 3 is Local Address:Port (e.g. 127.0.0.1:8000, 0.0.0.0:3000, [::]:8080, *:5000, 127.0.0.53%lo:53)
        let local_addr_token = tokens[3];
        let (raw_addr, port) = match parse_local_address_and_port(local_addr_token) {
            Some((a, p)) => (a, p),
            None => continue,
        };

        if port == 0 {
            continue;
        }

        // Extract PIDs from remaining tokens (e.g. users:(("python3",pid=945,fd=3)))
        let remaining_str = if tokens.len() >= 5 {
            tokens[4..].join(" ")
        } else {
            String::new()
        };

        let pids = extract_pids_from_users_field(&remaining_str);

        if pids.is_empty() {
            // No specific PID detected (e.g. permissions or kernel socket), record with PID 0
            ports.push(PortInfo {
                port,
                pid: 0,
                protocol: "tcp".to_string(),
                address: raw_addr,
                state: "listening".to_string(),
                environment: env.clone(),
            });
        } else {
            for pid in pids {
                ports.push(PortInfo {
                    port,
                    pid,
                    protocol: "tcp".to_string(),
                    address: raw_addr.clone(),
                    state: "listening".to_string(),
                    environment: env.clone(),
                });
            }
        }
    }

    ports
}

/// Helper function to parse an `ss` local endpoint string into (address, port).
fn parse_local_address_and_port(token: &str) -> Option<(String, u16)> {
    let (addr_part, port_str) = token.rsplit_once(':')?;
    let port = port_str.parse::<u16>().ok()?;

    let normalized_address = match addr_part {
        "*" => "0.0.0.0".to_string(),
        "[::]" => "[::]".to_string(),
        "[::1]" => "[::1]".to_string(),
        other => {
            if other.contains('%') {
                // Strip interface specifier (e.g. 127.0.0.53%lo -> 127.0.0.53)
                other.split('%').next().unwrap_or(other).to_string()
            } else {
                other.to_string()
            }
        }
    };

    Some((normalized_address, port))
}

/// Helper function to extract all PID integers from `users:(("name",pid=123,fd=...))` in `ss` output.
fn extract_pids_from_users_field(text: &str) -> Vec<u32> {
    let mut pids = Vec::new();
    let mut search_slice = text;

    while let Some(pos) = search_slice.find("pid=") {
        let after_pid = &search_slice[pos + 4..];
        // Take numeric digits
        let num_str: String = after_pid.chars().take_while(|c| c.is_ascii_digit()).collect();
        if let Ok(pid) = num_str.parse::<u32>() {
            if !pids.contains(&pid) {
                pids.push(pid);
            }
        }
        if after_pid.len() > num_str.len() {
            search_slice = &after_pid[num_str.len()..];
        } else {
            break;
        }
    }

    pids
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
    fn test_parse_wsl_ss_output_synthetic() {
        let sample = "\
LISTEN 0      5             0.0.0.0:8000  0.0.0.0:* users:((\"python3\",pid=945,fd=3))
LISTEN 0      1024        127.0.0.1:11211 0.0.0.0:* users:((\"memcached\",pid=246,fd=26))
LISTEN 0      4096                *:4369        *:* users:((\"epmd\",pid=242,fd=3),(\"systemd\",pid=1,fd=60))
LISTEN 0      4096             [::]:22       [::]:* users:((\"systemd\",pid=1,fd=66))
LISTEN 0      511             [::1]:6379     [::]:* users:((\"redis-server\",pid=252,fd=7))
LISTEN 0      4096    127.0.0.53%lo:53    0.0.0.0:* users:((\"systemd-resolve\",pid=224,fd=15))
";
        let ports = parse_wsl_ss_output(sample, "Ubuntu");
        assert_eq!(ports.len(), 7); // note: port 4369 has 2 pids (242, 1)

        // 1. Python 8000
        assert_eq!(ports[0].port, 8000);
        assert_eq!(ports[0].pid, 945);
        assert_eq!(ports[0].address, "0.0.0.0");
        assert_eq!(ports[0].environment, Environment::wsl("Ubuntu"));

        // 2. Memcached 11211
        assert_eq!(ports[1].port, 11211);
        assert_eq!(ports[1].pid, 246);
        assert_eq!(ports[1].address, "127.0.0.1");

        // 3. Epmd & systemd on 4369
        assert_eq!(ports[2].port, 4369);
        assert_eq!(ports[2].pid, 242);
        assert_eq!(ports[3].port, 4369);
        assert_eq!(ports[3].pid, 1);

        // 4. SSH on [::]:22
        assert_eq!(ports[4].port, 22);
        assert_eq!(ports[4].pid, 1);
        assert_eq!(ports[4].address, "[::]");

        // 5. Redis on [::1]:6379
        assert_eq!(ports[5].port, 6379);
        assert_eq!(ports[5].pid, 252);
        assert_eq!(ports[5].address, "[::1]");

        // 6. Systemd-resolve on 127.0.0.53%lo:53
        assert_eq!(ports[6].port, 53);
        assert_eq!(ports[6].pid, 224);
        assert_eq!(ports[6].address, "127.0.0.53");
    }

    #[test]
    fn test_parse_wsl_ss_without_pids() {
        let sample = "LISTEN 0 128 0.0.0.0:3000 0.0.0.0:*\n";
        let ports = parse_wsl_ss_output(sample, "Fedora");
        assert_eq!(ports.len(), 1);
        assert_eq!(ports[0].port, 3000);
        assert_eq!(ports[0].pid, 0);
        assert_eq!(ports[0].address, "0.0.0.0");
        assert_eq!(ports[0].environment, Environment::wsl("Fedora"));
    }

    #[test]
    fn test_wsl_port_discovery_with_mock() {
        let mock_output = WslCommandOutput {
            stdout: "LISTEN 0 128 127.0.0.1:5000 0.0.0.0:* users:((\"node\",pid=421,fd=18))\n"
                .to_string(),
            stderr: String::new(),
            exit_code: 0,
            success: true,
        };

        let executor = Arc::new(MockWslExecutor {
            output: Ok(mock_output),
        });
        let discovery = DefaultWslPortDiscovery::with_executor(executor);
        let result = discovery.enumerate("Ubuntu");

        assert!(result.is_ok());
        let ports = result.unwrap();
        assert_eq!(ports.len(), 1);
        assert_eq!(ports[0].port, 5000);
        assert_eq!(ports[0].pid, 421);
        assert_eq!(ports[0].environment, Environment::wsl("Ubuntu"));
    }
}
