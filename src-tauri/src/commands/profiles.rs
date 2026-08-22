use crate::discovery::{UnifiedDiscovery, UnifiedDiscoveryService};
use crate::models::profile::{
    CreateProfileRequest, ServerProfile, ServerProfileView, StartError, StartProfileResult,
    UpdateProfileRequest,
};
use crate::profile::{ServerProfileService, ServerStartService};
use std::sync::Arc;
use tauri::State;


/// Retrieves all saved Server Profiles without derived runtime status.
#[tauri::command]
pub fn get_server_profiles(
    profile_service: State<'_, Arc<ServerProfileService>>,
) -> Result<Vec<ServerProfile>, String> {
    profile_service.list_profiles().map_err(|e| e.to_string())
}

/// Retrieves an individual Server Profile by its persistent UUID.
#[tauri::command]
pub fn get_server_profile(
    id: String,
    profile_service: State<'_, Arc<ServerProfileService>>,
) -> Result<Option<ServerProfile>, String> {
    profile_service.get_profile(&id).map_err(|e| e.to_string())
}

/// Creates a new Server Profile and persists it to SQLite.
#[tauri::command]
pub fn create_server_profile(
    request: CreateProfileRequest,
    profile_service: State<'_, Arc<ServerProfileService>>,
) -> Result<ServerProfile, String> {
    profile_service.create_profile(request).map_err(|e| e.to_string())
}

/// Updates an existing Server Profile in SQLite.
#[tauri::command]
pub fn update_server_profile(
    request: UpdateProfileRequest,
    profile_service: State<'_, Arc<ServerProfileService>>,
) -> Result<ServerProfile, String> {
    profile_service.update_profile(request).map_err(|e| e.to_string())
}

/// Deletes a Server Profile by UUID.
/// Does not terminate any active server process.
#[tauri::command]
pub fn delete_server_profile(
    id: String,
    profile_service: State<'_, Arc<ServerProfileService>>,
) -> Result<bool, String> {
    profile_service.delete_profile(&id).map_err(|e| e.to_string())
}

/// Retrieves all Server Profiles enriched with live runtime operational status
/// (Stopped, Starting, Running, Error) and associated PID/port telemetry.
#[tauri::command]
pub fn get_server_profiles_with_status(
    profile_service: State<'_, Arc<ServerProfileService>>,
    start_service: State<'_, Arc<ServerStartService>>,
    discovery_service: State<'_, Arc<UnifiedDiscoveryService>>,
) -> Result<Vec<ServerProfileView>, String> {
    let profiles = profile_service.list_profiles().map_err(|e| e.to_string())?;
    let snapshot = discovery_service.discover_all().unwrap_or_default();
    let active_start_states = start_service.get_active_start_states();


    let views = profile_service.derive_profile_views(
        &profiles,
        &snapshot.processes,
        &snapshot.ports,
        &active_start_states,
    );

    Ok(views)
}

/// Starts a server profile and monitors discovery until ready or timed out.
#[tauri::command]
pub fn start_server_profile(
    id: String,
    start_service: State<'_, Arc<ServerStartService>>,
) -> Result<StartProfileResult, StartError> {
    start_service.start_profile(&id)
}

/// Restarts a Windows server profile (stops existing instance, verifies port release, and starts).
#[tauri::command]
pub fn restart_server_profile(
    id: String,
    start_service: State<'_, Arc<ServerStartService>>,
) -> Result<StartProfileResult, StartError> {
    start_service.restart_profile(&id)
}

