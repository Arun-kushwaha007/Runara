use crate::discovery::{ProcessDiscovery, WindowsProcessDiscovery};
use crate::models::ProcessInfo;

/// Tauri command to discover and return active Windows processes.
///
/// Keeps the IPC command handler thin: delegates directly to the
/// `WindowsProcessDiscovery` service and returns structured process data.
#[tauri::command]
pub fn get_processes() -> Result<Vec<ProcessInfo>, String> {
    let discovery = WindowsProcessDiscovery::new();
    discovery
        .enumerate()
        .map_err(|err| format!("Failed to discover Windows processes: {}", err))
}
