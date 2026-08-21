use crate::identity::ProcessIdentityService;
use crate::models::ProcessIdentity;

/// Tauri command to discover all active Windows processes and enrich them
/// into developer-oriented `ProcessIdentity` records.
#[tauri::command]
pub fn get_process_identities() -> Result<Vec<ProcessIdentity>, String> {
    let service = ProcessIdentityService::new();
    service
        .discover_all()
        .map_err(|err| format!("Failed to discover process identities: {}", err))
}

/// Tauri command to retrieve the detailed `ProcessIdentity` for a specific process PID.
#[tauri::command]
pub fn get_process_identity(pid: u32) -> Result<Option<ProcessIdentity>, String> {
    let service = ProcessIdentityService::new();
    service
        .discover_by_pid(pid)
        .map_err(|err| format!("Failed to discover identity for PID {}: {}", pid, err))
}
