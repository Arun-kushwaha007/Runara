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
        self.launch_server_with_logs(working_dir, command, None, None, None)
    }

    fn launch_server_with_logs(
        &self,
        working_dir: &str,
        command: &str,
        profile_id: Option<&str>,
        session_id: Option<&str>,
        log_manager: Option<std::sync::Arc<crate::log::LogManager>>,
    ) -> Result<LaunchHandle, StartError> {
        // Pre-validate working directory
        self.validate_working_directory(working_dir)?;

        let mut cmd = Command::new("cmd.exe");
        cmd.args(["/D", "/C", command]);
        cmd.current_dir(working_dir);
        cmd.stdin(Stdio::null());

        let is_capturing_logs = log_manager.is_some() && profile_id.is_some() && session_id.is_some();
        if is_capturing_logs {
            cmd.stdout(Stdio::piped());
            cmd.stderr(Stdio::piped());
        } else {
            cmd.stdout(Stdio::null());
            cmd.stderr(Stdio::null());
        }

        // On Windows, hide command window and decouple from parent process group
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
            cmd.creation_flags(CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP);
        }

        let mut child = cmd.spawn().map_err(|e| StartError {
            code: StartErrorCode::StartFailed,
            message: format!("Failed to spawn command '{}' via cmd.exe: {}", command, e),
            profile_id: profile_id.map(|s| s.to_string()),
            current_owner: None,
        })?;

        let initial_pid = child.id();
        let started_at_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        if let (Some(lm), Some(prof_id), Some(sess_id)) = (log_manager, profile_id, session_id) {
            let stdout = child.stdout.take();
            let stderr = child.stderr.take();

            // Background reader thread for stdout
            let lm_out = lm.clone();
            let p_out = prof_id.to_string();
            let s_out = sess_id.to_string();
            let _ = std::thread::Builder::new()
                .name(format!("stdout-{}", prof_id))
                .spawn(move || {
                    if let Some(stdout_pipe) = stdout {
                        use std::io::Read;
                        let mut reader = std::io::BufReader::new(stdout_pipe);
                        let mut buf = [0u8; 4096];
                        while let Ok(n) = reader.read(&mut buf) {
                            if n == 0 {
                                break;
                            }
                            let text = String::from_utf8_lossy(&buf[..n]);
                            lm_out.append_chunk(
                                &p_out,
                                &s_out,
                                crate::models::log::LogStream::Stdout,
                                &text,
                            );
                        }
                        lm_out.flush_partials(
                            &p_out,
                            &s_out,
                            crate::models::log::LogStream::Stdout,
                        );
                    }
                });

            // Background reader thread for stderr
            let lm_err = lm.clone();
            let p_err = prof_id.to_string();
            let s_err = sess_id.to_string();
            let _ = std::thread::Builder::new()
                .name(format!("stderr-{}", prof_id))
                .spawn(move || {
                    if let Some(stderr_pipe) = stderr {
                        use std::io::Read;
                        let mut reader = std::io::BufReader::new(stderr_pipe);
                        let mut buf = [0u8; 4096];
                        while let Ok(n) = reader.read(&mut buf) {
                            if n == 0 {
                                break;
                            }
                            let text = String::from_utf8_lossy(&buf[..n]);
                            lm_err.append_chunk(
                                &p_err,
                                &s_err,
                                crate::models::log::LogStream::Stderr,
                                &text,
                            );
                        }
                        lm_err.flush_partials(
                            &p_err,
                            &s_err,
                            crate::models::log::LogStream::Stderr,
                        );
                    }
                });

            // Background reaper thread for child exit
            let lm_reap = lm.clone();
            let p_reap = prof_id.to_string();
            let s_reap = sess_id.to_string();
            let _ = std::thread::Builder::new()
                .name(format!("reap-{}", prof_id))
                .spawn(move || {
                    match child.wait() {
                        Ok(exit_status) => {
                            let status = if exit_status.success() {
                                crate::models::log::LogSessionStatus::Stopped
                            } else {
                                crate::models::log::LogSessionStatus::Error
                            };
                            lm_reap.mark_status(&p_reap, &s_reap, status);
                        }
                        Err(_) => {
                            lm_reap.mark_status(
                                &p_reap,
                                &s_reap,
                                crate::models::log::LogSessionStatus::Stopped,
                            );
                        }
                    }
                });
        }

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
            .validate_working_directory("C:\\non_existent_dir_12345_runara")
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
