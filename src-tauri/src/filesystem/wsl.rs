use crate::models::environment::WslDistroState;
use crate::models::filesystem::{DirectoryEntry, DirectoryListing, PathValidationResult};
use crate::wsl::distro::{DefaultWslDistroDiscovery, WslDistroDiscovery};
use crate::wsl::executor::{DefaultWslExecutor, WslExecutor};
use std::sync::Arc;

/// Default timeout for WSL directory operations (4 seconds).
pub const WSL_FS_TIMEOUT_MS: u64 = 4000;

/// WSL Guest filesystem operations and directory listing provider.
pub struct WslFilesystemProvider {
    executor: Arc<dyn WslExecutor>,
    distro_discovery: Arc<dyn WslDistroDiscovery>,
}

impl WslFilesystemProvider {
    pub fn new() -> Self {
        let executor = Arc::new(DefaultWslExecutor::new());
        let distro_discovery = Arc::new(DefaultWslDistroDiscovery::with_executor(executor.clone()));
        Self {
            executor,
            distro_discovery,
        }
    }

    pub fn with_dependencies(
        executor: Arc<dyn WslExecutor>,
        distro_discovery: Arc<dyn WslDistroDiscovery>,
    ) -> Self {
        Self {
            executor,
            distro_discovery,
        }
    }

    /// Verifies that the specified WSL distribution exists and is currently running.
    pub fn validate_distribution(&self, distro: &str) -> Result<(), String> {
        let distros = self.distro_discovery.enumerate().map_err(|e| {
            format!("Failed to discover WSL distributions: {}", e)
        })?;

        let target = distros
            .iter()
            .find(|d| d.name.eq_ignore_ascii_case(distro));

        match target {
            None => Err(format!(
                "WSL distribution '{}' is not installed on this system.",
                distro
            )),
            Some(d) => match d.state {
                WslDistroState::Running => Ok(()),
                WslDistroState::Stopped => Err(format!(
                    "WSL distribution '{}' is stopped. Start the distribution before browsing.",
                    distro
                )),
                _ => Err(format!(
                    "WSL distribution '{}' is in an invalid state ({}).",
                    distro, d.state
                )),
            },
        }
    }

    /// Obtains the default user home directory inside the target WSL distribution.
    pub fn get_default_directory(&self, distro: &str) -> String {
        match self.executor.execute(distro, "printenv", &["HOME"], 2000) {
            Ok(out) if out.success && !out.stdout.trim().is_empty() => {
                out.stdout.trim().to_string()
            }
            _ => "/".to_string(),
        }
    }

    /// Lists subdirectories of a given Linux path inside a specific WSL distribution.
    pub fn list_directories(
        &self,
        distro: &str,
        target_path: Option<&str>,
    ) -> Result<DirectoryListing, String> {
        self.validate_distribution(distro)?;

        // Determine effective path
        let mut path = match target_path {
            Some(p) if !p.trim().is_empty() => p.trim().to_string(),
            _ => self.get_default_directory(distro),
        };

        // Normalize path: Ensure leading slash
        if !path.starts_with('/') {
            path = format!("/{}", path);
        }

        // Normalize trailing slashes (except for root "/")
        while path.len() > 1 && path.ends_with('/') {
            path.pop();
        }

        // Compute parent path
        let parent_path = compute_parent_path(&path);

        // Execute directory listing using `find <path> -maxdepth 1 -mindepth 1 ( -type d -o -xtype d )`
        let output = self.executor.execute(
            distro,
            "find",
            &[&path, "-maxdepth", "1", "-mindepth", "1", "(", "-type", "d", "-o", "-xtype", "d", ")"],
            WSL_FS_TIMEOUT_MS,
        ).map_err(|e| format!("Failed to list directories in WSL: {}", e))?;

        if !output.success {
            let stderr_lower = output.stderr.to_lowercase();
            if stderr_lower.contains("permission denied") {
                return Err(format!("Unable to access directory '{}' (Permission denied).", path));
            } else if stderr_lower.contains("no such file") {
                return Err(format!("Directory '{}' not found inside WSL distribution '{}'.", path, distro));
            } else if !output.stderr.trim().is_empty() {
                return Err(format!("Failed to list directory '{}': {}", path, output.stderr.trim()));
            } else {
                return Err(format!("Directory listing for '{}' failed with exit code {}.", path, output.exit_code));
            }
        }

        let entries = parse_wsl_find_output(&output.stdout);

        Ok(DirectoryListing {
            current_path: path,
            parent_path,
            entries,
        })
    }

    /// Validates a Linux path inside a specific WSL distribution.
    pub fn validate_directory(
        &self,
        distro: &str,
        path_str: &str,
    ) -> Result<PathValidationResult, String> {
        let trimmed = path_str.trim();
        if trimmed.is_empty() {
            return Ok(PathValidationResult {
                is_valid: false,
                error: Some("Working directory cannot be empty.".to_string()),
                resolved_path: None,
            });
        }

        // Validate distribution state first
        if let Err(distro_err) = self.validate_distribution(distro) {
            return Ok(PathValidationResult {
                is_valid: false,
                error: Some(distro_err),
                resolved_path: None,
            });
        }

        let output = self.executor.execute(distro, "test", &["-d", trimmed], WSL_FS_TIMEOUT_MS).map_err(|e| {
            format!("Failed to validate directory in WSL: {}", e)
        })?;

        if output.success {
            Ok(PathValidationResult {
                is_valid: true,
                error: None,
                resolved_path: Some(trimmed.to_string()),
            })
        } else {
            Ok(PathValidationResult {
                is_valid: false,
                error: Some(format!(
                    "Directory '{}' does not exist inside WSL distribution '{}'.",
                    trimmed, distro
                )),
                resolved_path: None,
            })
        }
    }
}

impl Default for WslFilesystemProvider {
    fn default() -> Self {
        Self::new()
    }
}

/// Computes the parent directory path for a normalized Linux path.
pub fn compute_parent_path(path: &str) -> Option<String> {
    if path == "/" || path.is_empty() {
        return None;
    }

    let trimmed = path.trim_end_matches('/');
    match trimmed.rfind('/') {
        Some(0) => Some("/".to_string()),
        Some(idx) => Some(trimmed[..idx].to_string()),
        None => Some("/".to_string()),
    }
}

/// Parses the output of `find <dir> -maxdepth 1 -mindepth 1 ( -type d -o -xtype d )`.
pub fn parse_wsl_find_output(stdout: &str) -> Vec<DirectoryEntry> {
    let mut entries: Vec<DirectoryEntry> = stdout
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .filter_map(|full_path| {
            let name = full_path.rsplit('/').next()?.trim();
            if name.is_empty() || name == "." || name == ".." {
                return None;
            }

            Some(DirectoryEntry {
                name: name.to_string(),
                path: full_path.to_string(),
                is_directory: true,
                is_hidden: name.starts_with('.'),
            })
        })
        .collect();

    // Sort entries alphabetically (case-insensitive for developer convenience)
    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    entries
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::environment::WslDistribution;
    use crate::wsl::executor::{WslCommandOutput, WslExecutionError};
    use std::sync::Mutex;

    struct MockExecutor {
        responses: Mutex<Vec<Result<WslCommandOutput, WslExecutionError>>>,
    }

    impl MockExecutor {
        fn new(responses: Vec<Result<WslCommandOutput, WslExecutionError>>) -> Self {
            Self {
                responses: Mutex::new(responses),
            }
        }
    }

    impl WslExecutor for MockExecutor {
        fn execute(
            &self,
            _distro: &str,
            _command: &str,
            _args: &[&str],
            _timeout_ms: u64,
        ) -> Result<WslCommandOutput, WslExecutionError> {
            let mut list = self.responses.lock().unwrap();
            if list.is_empty() {
                Ok(WslCommandOutput {
                    stdout: String::new(),
                    stderr: String::new(),
                    exit_code: 0,
                    success: true,
                })
            } else {
                list.remove(0)
            }
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

    struct MockDistroDiscovery {
        distros: Vec<WslDistribution>,
    }

    impl WslDistroDiscovery for MockDistroDiscovery {
        fn enumerate(&self) -> Result<Vec<WslDistribution>, WslExecutionError> {
            Ok(self.distros.clone())
        }
    }

    #[test]
    fn test_compute_parent_path() {
        assert_eq!(compute_parent_path("/"), None);
        assert_eq!(compute_parent_path("/home"), Some("/".to_string()));
        assert_eq!(compute_parent_path("/home/user"), Some("/home".to_string()));
        assert_eq!(compute_parent_path("/home/user/projects"), Some("/home/user".to_string()));
        assert_eq!(compute_parent_path("/home/user/projects/"), Some("/home/user".to_string()));
    }

    #[test]
    fn test_parse_wsl_find_output() {
        let raw = "\
/home/user/api
/home/user/.config
/home/user/frontend
/home/user/Worker Service
/home/user/.git
";
        let entries = parse_wsl_find_output(raw);
        assert_eq!(entries.len(), 5);

        // Verify sorted alphabetically (.config, .git, api, frontend, Worker Service)
        assert_eq!(entries[0].name, ".config");
        assert!(entries[0].is_hidden);
        assert_eq!(entries[0].path, "/home/user/.config");

        assert_eq!(entries[1].name, ".git");
        assert!(entries[1].is_hidden);

        assert_eq!(entries[2].name, "api");
        assert!(!entries[2].is_hidden);

        assert_eq!(entries[3].name, "frontend");
        assert_eq!(entries[4].name, "Worker Service");
    }

    #[test]
    fn test_list_directories_stopped_distro_rejected() {
        let distro = "Ubuntu";
        let distros = vec![WslDistribution {
            name: distro.to_string(),
            state: WslDistroState::Stopped,
            version: Some(2),
            is_default: true,
        }];

        let provider = WslFilesystemProvider::with_dependencies(
            Arc::new(MockExecutor::new(vec![])),
            Arc::new(MockDistroDiscovery { distros }),
        );

        let err = provider.list_directories(distro, Some("/home")).unwrap_err();
        assert!(err.contains("is stopped"));
    }

    #[test]
    fn test_list_directories_success() {
        let distro = "Fedora";
        let distros = vec![WslDistribution {
            name: distro.to_string(),
            state: WslDistroState::Running,
            version: Some(2),
            is_default: true,
        }];

        let mock_out = WslCommandOutput {
            stdout: "/home/user/api\n/home/user/frontend\n".to_string(),
            stderr: String::new(),
            exit_code: 0,
            success: true,
        };

        let provider = WslFilesystemProvider::with_dependencies(
            Arc::new(MockExecutor::new(vec![Ok(mock_out)])),
            Arc::new(MockDistroDiscovery { distros }),
        );

        let listing = provider.list_directories(distro, Some("/home/user")).unwrap();
        assert_eq!(listing.current_path, "/home/user");
        assert_eq!(listing.parent_path, Some("/home".to_string()));
        assert_eq!(listing.entries.len(), 2);
        assert_eq!(listing.entries[0].name, "api");
        assert_eq!(listing.entries[1].name, "frontend");
    }

    #[test]
    fn test_list_directories_permission_denied() {
        let distro = "Fedora";
        let distros = vec![WslDistribution {
            name: distro.to_string(),
            state: WslDistroState::Running,
            version: Some(2),
            is_default: true,
        }];

        let mock_out = WslCommandOutput {
            stdout: String::new(),
            stderr: "find: ‘/root’: Permission denied".to_string(),
            exit_code: 1,
            success: false,
        };

        let provider = WslFilesystemProvider::with_dependencies(
            Arc::new(MockExecutor::new(vec![Ok(mock_out)])),
            Arc::new(MockDistroDiscovery { distros }),
        );

        let err = provider.list_directories(distro, Some("/root")).unwrap_err();
        assert!(err.contains("Permission denied"));
    }
}
