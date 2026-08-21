use crate::discovery::{PortDiscovery, WindowsPortDiscovery};
use crate::models::PortInfo;

/// Tauri command to discover and return active Windows listening TCP ports.
///
/// Keeps the IPC command handler thin: delegates directly to the
/// `WindowsPortDiscovery` service and returns structured port endpoint data.
#[tauri::command]
pub fn get_listening_ports() -> Result<Vec<PortInfo>, String> {
    let discovery = WindowsPortDiscovery::new();
    discovery
        .enumerate()
        .map_err(|err| format!("Failed to discover Windows listening ports: {}", err))
}
