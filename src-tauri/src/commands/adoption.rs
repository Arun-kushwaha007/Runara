use crate::models::environment::Environment;
use crate::models::profile::ServerProfile;
use crate::profile::{ServerProfileService, find_duplicate_profiles};
use std::sync::Arc;
use tauri::State;

/// Finds saved profiles that are potential duplicates of the proposed adoption parameters.
///
/// This command is advisory only — it does NOT prevent profile creation.
/// The frontend uses the result to warn the user before they save.
///
/// Duplicates are determined by exact match on:
/// - Environment type (and distro for WSL)
/// - Working directory (normalized)
/// - Command (trimmed)
/// - Expected port (None matches None, Some(n) matches Some(n) only)
#[tauri::command]
pub fn find_duplicate_server_profiles(
    environment: Environment,
    working_directory: String,
    command: String,
    expected_port: Option<u16>,
    profile_service: State<'_, Arc<ServerProfileService>>,
) -> Result<Vec<ServerProfile>, String> {
    let profiles = profile_service
        .list_profiles()
        .map_err(|e| e.to_string())?;

    let duplicates = find_duplicate_profiles(
        &environment,
        &working_directory,
        &command,
        expected_port,
        &profiles,
    );

    Ok(duplicates)
}
