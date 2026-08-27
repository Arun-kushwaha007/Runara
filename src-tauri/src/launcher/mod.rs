pub mod windows;
pub mod wsl;

pub use windows::WindowsLauncher;
pub use wsl::WslLauncher;

use crate::log::LogManager;
use crate::models::profile::StartError;
use std::sync::Arc;

/// Handle capturing initial process information recorded immediately after spawning.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LaunchHandle {
    /// Initial Operating System Process Identifier of the spawned launcher shell/process.
    pub initial_pid: u32,
    /// Epoch millisecond timestamp when the launch was initiated.
    pub started_at_ms: u64,
}

/// Abstract contract for environment-specific server process creation and pre-flight validation.
pub trait EnvironmentLauncher: Send + Sync {
    /// Validates that the target execution environment (Host OS or WSL distribution) is available.
    fn validate_environment(&self) -> Result<(), StartError>;

    /// Validates that the configured working directory exists inside the execution environment.
    fn validate_working_directory(&self, dir: &str) -> Result<(), StartError>;

    /// Launches the configured server command asynchronously within the execution environment.
    fn launch_server(&self, working_dir: &str, command: &str) -> Result<LaunchHandle, StartError> {
        self.launch_server_with_logs(working_dir, command, None, None, None)
    }

    /// Launches the server command with optional stdout/stderr log capture streamed to `LogManager`.
    fn launch_server_with_logs(
        &self,
        working_dir: &str,
        command: &str,
        profile_id: Option<&str>,
        session_id: Option<&str>,
        log_manager: Option<Arc<LogManager>>,
    ) -> Result<LaunchHandle, StartError>;
}
