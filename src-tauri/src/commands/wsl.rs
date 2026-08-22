use crate::discovery::{UnifiedDiscovery, UnifiedDiscoveryService};
use crate::models::environment::{UnifiedSnapshot, WslDistribution};
use crate::wsl::{DefaultWslDistroDiscovery, WslDistroDiscovery};

/// Tauri command to discover installed WSL distributions and their current states.
#[tauri::command]
pub fn get_wsl_distributions() -> Result<Vec<WslDistribution>, String> {
    let discovery = DefaultWslDistroDiscovery::new();
    discovery
        .enumerate()
        .map_err(|err| format!("Failed to discover WSL distributions: {}", err))
}

/// Tauri command to execute a unified discovery cycle across Windows and running WSL distributions.
#[tauri::command]
pub fn get_unified_snapshot() -> Result<UnifiedSnapshot, String> {
    let service = UnifiedDiscoveryService::new();
    service
        .discover_all()
        .map_err(|err| format!("Failed to execute unified discovery: {}", err))
}
