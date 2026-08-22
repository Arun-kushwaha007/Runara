use crate::launcher::{EnvironmentLauncher, LaunchHandle};
use crate::models::profile::{StartError, StartErrorCode};
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};

/// Windows-specific environment launcher using `cmd.exe /D /C` with `CREATE_NO_WINDOW`.
pub struct WindowsLauncher;

impl WindowsLauncher {
    pub fn new() -> Self {
        Self
    }
}

impl Default for WindowsLauncher {
    fn default() -> Self {
        Self::new()
    }
}

impl EnvironmentLauncher for WindowsLauncher {
    fn validate_environment(&self) -> Result<(), StartError> {
        // Windows Host is always available on a Windows desktop application
        Ok(())
    }

    fn validate_working_directory(&self, dir: &str) -> Result<(), StartError> {
        let path = Path::new(dir);
        if !path.exists() {
            return Err(StartError {
                code: StartErrorCode::WorkingDirectoryNotFound,
                message: format!(
                    "Configured working directory '{}' does not exist on the Windows file system.",
                    dir
                ),
                profile_id: None,
                current_owner: None,
            });
        }

        if !path.is_dir() {
            return Err(StartError {
                code: StartErrorCode::WorkingDirectoryNotFound,
                message: format!(
                    "Configured path '{}' is a file, not a valid directory.",
                    dir
                ),
                profile_id: None,
                current_owner: None,
            });
        }

        Ok(())
    }

    fn launch_server(&self, working_dir: &str, command: &str) -> Result<LaunchHandle, StartError> {
        // Pre-validate working directory
        self.validate_working_directory(working_dir)?;

        let mut cmd = Command::new("cmd.exe");
        cmd.args(["/D", "/C", command]);
        cmd.current_dir(working_dir);
        cmd.stdin(Stdio::null());
        cmd.stdout(Stdio::null());
        cmd.stderr(Stdio::null());

        // On Windows, hide command window and decouple from parent process group
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
            cmd.creation_flags(CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP);
        }

        let child = cmd.spawn().map_err(|e| StartError {
            code: StartErrorCode::StartFailed,
            message: format!("Failed to spawn command '{}' via cmd.exe: {}", command, e),
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

    #[test]
    fn test_validate_working_directory_non_existent() {
        let launcher = WindowsLauncher::new();
        let err = launcher
            .validate_working_directory("C:\\non_existent_dir_12345_devhub")
            .unwrap_err();
        assert_eq!(err.code, StartErrorCode::WorkingDirectoryNotFound);
    }

    #[test]
    fn test_validate_working_directory_valid() {
        let launcher = WindowsLauncher::new();
        let temp_dir = std::env::temp_dir();
        let res = launcher.validate_working_directory(temp_dir.to_str().unwrap());
        assert!(res.is_ok());
    }
}
