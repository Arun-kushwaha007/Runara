use crate::models::control::{ControlResult, ProcessControlError, ProcessTarget};
use crate::process::ProcessControlService;

/// Tauri command to safely stop a discovered development server.
/// Validates target identity against fresh system state, terminates target & verified descendants,
/// and verifies process exit and port release before returning.
#[tauri::command]
pub fn stop_server(target: ProcessTarget) -> Result<ControlResult, ProcessControlError> {
    let service = ProcessControlService::new();
    service.stop_server(&target)
}

/// Tauri command to forcefully terminate a development server without graceful exit waits.
#[tauri::command]
pub fn force_stop_server(mut target: ProcessTarget) -> Result<ControlResult, ProcessControlError> {
    target.force = true;
    let service = ProcessControlService::new();
    service.stop_server(&target)
}
