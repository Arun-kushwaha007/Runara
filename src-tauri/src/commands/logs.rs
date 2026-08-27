use crate::discovery::{UnifiedDiscovery, UnifiedDiscoveryService};
use crate::log::LogManager;
use crate::models::log::LogSessionView;
use crate::profile::ServerProfileService;
use std::sync::Arc;
use tauri::State;

/// Retrieves the current transient log session snapshot for a given server profile.
/// Accurately identifies whether the service is currently running, whether it was launched
/// by Runara with live capture, or whether it is an unmanaged/externally started process.
#[tauri::command]
pub fn get_service_logs(
    profile_id: String,
    log_manager: State<'_, Arc<LogManager>>,
    profile_service: State<'_, Arc<ServerProfileService>>,
    discovery_service: State<'_, Arc<UnifiedDiscoveryService>>,
) -> Result<LogSessionView, String> {
    let profile = profile_service
        .get_profile(&profile_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Server profile '{}' not found", profile_id))?;

    let snapshot = discovery_service.discover_all().unwrap_or_default();
    let is_running = ServerProfileService::find_matching_process(
        &profile,
        &snapshot.processes,
        &snapshot.ports,
    )
    .is_some();

    let view = log_manager.get_session_view(&profile_id, is_running, false);
    Ok(view)
}

/// Clears the in-memory log buffer for a service session without modifying the process.
#[tauri::command]
pub fn clear_service_logs(
    profile_id: String,
    log_manager: State<'_, Arc<LogManager>>,
) -> Result<bool, String> {
    Ok(log_manager.clear_session(&profile_id))
}
