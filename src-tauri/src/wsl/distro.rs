use crate::models::environment::{WslDistribution, WslDistroState};
use crate::wsl::executor::{DefaultWslExecutor, WslExecutionError, WslExecutor};
use std::sync::Arc;

/// Default timeout for WSL distribution listing command (3 seconds).
pub const WSL_LIST_TIMEOUT_MS: u64 = 3000;

/// Trait defining WSL distribution discovery abstraction.
pub trait WslDistroDiscovery: Send + Sync {
    /// Discovers all installed WSL distributions and their current states.
    fn enumerate(&self) -> Result<Vec<WslDistribution>, WslExecutionError>;
}

/// Default implementation of `WslDistroDiscovery` using `WslExecutor`.
pub struct DefaultWslDistroDiscovery {
    executor: Arc<dyn WslExecutor>,
}

impl DefaultWslDistroDiscovery {
    pub fn new() -> Self {
        Self {
            executor: Arc::new(DefaultWslExecutor::new()),
        }
    }

    pub fn with_executor(executor: Arc<dyn WslExecutor>) -> Self {
        Self { executor }
    }
}

impl Default for DefaultWslDistroDiscovery {
    fn default() -> Self {
        Self::new()
    }
}

impl WslDistroDiscovery for DefaultWslDistroDiscovery {
    fn enumerate(&self) -> Result<Vec<WslDistribution>, WslExecutionError> {
        let output = self.executor.execute_host(&["--list", "--verbose"], WSL_LIST_TIMEOUT_MS)?;
        if !output.success && output.stdout.trim().is_empty() {
            return Err(WslExecutionError::CommandFailed {
                distro: None,
                command: "wsl.exe --list --verbose".to_string(),
                message: if !output.stderr.is_empty() {
                    output.stderr
                } else {
                    format!("wsl.exe exited with code {}", output.exit_code)
                },
            });
        }

        let distros = parse_wsl_list_output(&output.stdout);
        Ok(distros)
    }
}

/// Parses the tabular stdout output of `wsl.exe --list --verbose` or `wsl.exe -l -v`.
///
/// Example raw output:
/// ```text
///   NAME                   STATE           VERSION
/// * Ubuntu                 Running         2
///   docker-desktop         Stopped         2
///   FedoraLinux-44         Running         2
/// ```
pub fn parse_wsl_list_output(raw_output: &str) -> Vec<WslDistribution> {
    let mut distributions = Vec::new();

    for line in raw_output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        // Clean out any null bytes or non-printable artifacts
        let clean_line = trimmed.replace('\0', "");
        let clean_trimmed = clean_line.trim();
        if clean_trimmed.is_empty() {
            continue;
        }

        // Check if this line is the header ("NAME STATE VERSION")
        let upper = clean_trimmed.to_uppercase();
        if upper.contains("NAME") && upper.contains("STATE") && upper.contains("VERSION") {
            continue;
        }

        let is_default = clean_trimmed.starts_with('*');
        let line_without_star = if is_default {
            clean_trimmed.strip_prefix('*').unwrap_or(clean_trimmed).trim()
        } else {
            clean_trimmed
        };

        // Split tokens by whitespace
        let tokens: Vec<&str> = line_without_star.split_whitespace().collect();
        if tokens.is_empty() {
            continue;
        }

        let name = tokens[0].to_string();

        let state = if tokens.len() >= 2 {
            match tokens[1].to_lowercase().as_str() {
                "running" => WslDistroState::Running,
                "stopped" => WslDistroState::Stopped,
                "error" => WslDistroState::Error,
                _ => WslDistroState::Unknown,
            }
        } else {
            WslDistroState::Unknown
        };

        let version = if tokens.len() >= 3 {
            tokens[2].parse::<u32>().ok()
        } else {
            None
        };

        distributions.push(WslDistribution {
            name,
            state,
            is_default,
            version,
        });
    }

    distributions
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
    fn test_parse_wsl_list_output_multiple_distros() {
        let sample = "\
  NAME                   STATE           VERSION
* Ubuntu                 Running         2
  docker-desktop         Stopped         2
  FedoraLinux-44         Running         2
";
        let distros = parse_wsl_list_output(sample);
        assert_eq!(distros.len(), 3);

        assert_eq!(distros[0].name, "Ubuntu");
        assert_eq!(distros[0].state, WslDistroState::Running);
        assert!(distros[0].is_default);
        assert_eq!(distros[0].version, Some(2));

        assert_eq!(distros[1].name, "docker-desktop");
        assert_eq!(distros[1].state, WslDistroState::Stopped);
        assert!(!distros[1].is_default);
        assert_eq!(distros[1].version, Some(2));

        assert_eq!(distros[2].name, "FedoraLinux-44");
        assert_eq!(distros[2].state, WslDistroState::Running);
        assert!(!distros[2].is_default);
        assert_eq!(distros[2].version, Some(2));
    }

    #[test]
    fn test_parse_wsl_list_output_single_distro_no_default_star() {
        let sample = "\
  NAME                   STATE           VERSION
  Debian                 Stopped         1
";
        let distros = parse_wsl_list_output(sample);
        assert_eq!(distros.len(), 1);
        assert_eq!(distros[0].name, "Debian");
        assert_eq!(distros[0].state, WslDistroState::Stopped);
        assert!(!distros[0].is_default);
        assert_eq!(distros[0].version, Some(1));
    }

    #[test]
    fn test_parse_wsl_list_output_empty() {
        let distros = parse_wsl_list_output("");
        assert!(distros.is_empty());
    }

    #[test]
    fn test_discovery_with_mock_executor() {
        let mock_output = WslCommandOutput {
            stdout: "\
  NAME       STATE     VERSION
* Fedora     Running   2
  Ubuntu     Stopped   2
"
            .to_string(),
            stderr: String::new(),
            exit_code: 0,
            success: true,
        };

        let executor = Arc::new(MockWslExecutor {
            output: Ok(mock_output),
        });
        let discovery = DefaultWslDistroDiscovery::with_executor(executor);
        let result = discovery.enumerate();

        assert!(result.is_ok());
        let distros = result.unwrap();
        assert_eq!(distros.len(), 2);
        assert_eq!(distros[0].name, "Fedora");
        assert_eq!(distros[0].state, WslDistroState::Running);
        assert!(distros[0].is_default);
        assert_eq!(distros[1].name, "Ubuntu");
        assert_eq!(distros[1].state, WslDistroState::Stopped);
    }
}
