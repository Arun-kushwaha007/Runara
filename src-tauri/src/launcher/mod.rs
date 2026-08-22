pub mod windows;
pub mod wsl;

pub use windows::WindowsLauncher;
pub use wsl::WslLauncher;

use crate::models::profile::StartError;

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
    fn launch_server(&self, working_dir: &str, command: &str) -> Result<LaunchHandle, StartError>;
}
