use crate::launcher::{EnvironmentLauncher, LaunchHandle};
use crate::models::environment::WslDistroState;
use crate::models::profile::{StartError, StartErrorCode};
use crate::wsl::distro::{DefaultWslDistroDiscovery, WslDistroDiscovery};
use crate::wsl::executor::{DefaultWslExecutor, WslExecutor};
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

/// WSL-specific environment launcher using `wsl.exe -d <distro> --cd <dir>`.
pub struct WslLauncher {
    pub distro: String,
    executor: Arc<dyn WslExecutor>,
    distro_discovery: Arc<dyn WslDistroDiscovery>,
}

impl WslLauncher {
    pub fn new(distro: impl Into<String>) -> Self {
        let executor = Arc::new(DefaultWslExecutor::new());
        let distro_discovery = Arc::new(DefaultWslDistroDiscovery::with_executor(executor.clone()));
        Self {
            distro: distro.into(),
            executor,
            distro_discovery,
        }
    }

    pub fn with_dependencies(
        distro: impl Into<String>,
        executor: Arc<dyn WslExecutor>,
        distro_discovery: Arc<dyn WslDistroDiscovery>,
    ) -> Self {
        Self {
            distro: distro.into(),
            executor,
            distro_discovery,
        }
    }
}

impl EnvironmentLauncher for WslLauncher {
    fn validate_environment(&self) -> Result<(), StartError> {
        let distros = self
            .distro_discovery
            .enumerate()
            .map_err(|e| StartError {
                code: StartErrorCode::EnvironmentUnavailable,
                message: format!("Failed to discover WSL distributions: {}", e),
                profile_id: None,
                current_owner: None,
            })?;

        let target = distros
            .iter()
            .find(|d| d.name.eq_ignore_ascii_case(&self.distro));

        match target {
            None => Err(StartError {
                code: StartErrorCode::WslDistroNotFound,
                message: format!(
                    "WSL distribution '{}' is not installed on this system.",
                    self.distro
                ),
                profile_id: None,
                current_owner: None,
            }),
            Some(d) => match d.state {
                WslDistroState::Running => Ok(()),
                WslDistroState::Stopped => Err(StartError {
                    code: StartErrorCode::WslDistroStopped,
                    message: format!(
                        "WSL distribution '{}' is stopped. Start the distribution before launching servers.",
                        self.distro
                    ),
                    profile_id: None,
                    current_owner: None,
                }),
                _ => Err(StartError {
                    code: StartErrorCode::EnvironmentUnavailable,
                    message: format!(
                        "WSL distribution '{}' is in an invalid or unknown state ({}).",
                        self.distro, d.state
                    ),
                    profile_id: None,
                    current_owner: None,
                }),
            },
        }
    }

    fn validate_working_directory(&self, dir: &str) -> Result<(), StartError> {
        let output = self
            .executor
            .execute(&self.distro, "test", &["-d", dir], 3000)
            .map_err(|e| StartError {
                code: StartErrorCode::EnvironmentUnavailable,
                message: format!(
                    "Failed to check working directory '{}' in WSL distro '{}': {}",
                    dir, self.distro, e
                ),
                profile_id: None,
                current_owner: None,
            })?;

        if !output.success {
            return Err(StartError {
                code: StartErrorCode::WorkingDirectoryNotFound,
                message: format!(
                    "Configured Linux working directory '{}' does not exist inside WSL distribution '{}'.",
                    dir, self.distro
                ),
                profile_id: None,
                current_owner: None,
            });
        }

        Ok(())
    }

    fn launch_server(&self, working_dir: &str, command: &str) -> Result<LaunchHandle, StartError> {
        self.validate_environment()?;
        self.validate_working_directory(working_dir)?;

        let mut cmd = Command::new("wsl.exe");
        cmd.args(["-d", &self.distro, "--cd", working_dir, "--", "sh", "-c", command]);
        cmd.stdin(Stdio::null());
        cmd.stdout(Stdio::null());
        cmd.stderr(Stdio::null());

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
            cmd.creation_flags(CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP);
        }

        let child = cmd.spawn().map_err(|e| StartError {
            code: StartErrorCode::StartFailed,
            message: format!(
                "Failed to spawn command '{}' in WSL distribution '{}': {}",
                command, self.distro, e
            ),
            profile_id: None,
            current_owner: None,
        })?;

        let initial_pid = child.id();
        let started_at_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        Ok(LaunchHandle {
            initial_pid,
            started_at_ms,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::environment::WslDistribution;
    use crate::wsl::executor::{WslCommandOutput, WslExecutionError};

    struct MockExecutor {
        dir_exists: bool,
    }

    impl WslExecutor for MockExecutor {
        fn execute(
            &self,
            _distro: &str,
            _command: &str,
            _args: &[&str],
            _timeout_ms: u64,
        ) -> Result<WslCommandOutput, WslExecutionError> {
            Ok(WslCommandOutput {
                stdout: String::new(),
                stderr: String::new(),
                exit_code: if self.dir_exists { 0 } else { 1 },
                success: self.dir_exists,
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

    struct MockDistroDiscovery {
        distros: Vec<WslDistribution>,
    }

    impl WslDistroDiscovery for MockDistroDiscovery {
        fn enumerate(&self) -> Result<Vec<WslDistribution>, WslExecutionError> {
            Ok(self.distros.clone())
        }
    }

    #[test]
    fn test_wsl_validation_distro_not_found() {
        let discovery = Arc::new(MockDistroDiscovery { distros: vec![] });
        let executor = Arc::new(MockExecutor { dir_exists: true });
        let launcher = WslLauncher::with_dependencies("Ubuntu", executor, discovery);

        let err = launcher.validate_environment().unwrap_err();
        assert_eq!(err.code, StartErrorCode::WslDistroNotFound);
    }

    #[test]
    fn test_wsl_validation_distro_stopped() {
        let discovery = Arc::new(MockDistroDiscovery {
            distros: vec![WslDistribution {
                name: "Ubuntu".to_string(),
                state: WslDistroState::Stopped,
                is_default: true,
                version: Some(2),
            }],
        });
        let executor = Arc::new(MockExecutor { dir_exists: true });
        let launcher = WslLauncher::with_dependencies("Ubuntu", executor, discovery);

        let err = launcher.validate_environment().unwrap_err();
        assert_eq!(err.code, StartErrorCode::WslDistroStopped);
    }

    #[test]
    fn test_wsl_validation_directory_missing() {
        let discovery = Arc::new(MockDistroDiscovery {
            distros: vec![WslDistribution {
                name: "Fedora".to_string(),
                state: WslDistroState::Running,
                is_default: true,
                version: Some(2),
            }],
        });
        let executor = Arc::new(MockExecutor { dir_exists: false });
        let launcher = WslLauncher::with_dependencies("Fedora", executor, discovery);

        let err = launcher.validate_working_directory("/home/missing/path").unwrap_err();
        assert_eq!(err.code, StartErrorCode::WorkingDirectoryNotFound);
    }
}
