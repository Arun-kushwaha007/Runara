use crate::filesystem::FilesystemService;
use crate::models::environment::Environment;
use crate::models::filesystem::{DirectoryListing, PathValidationResult};
use std::sync::Arc;
use tauri_plugin_dialog::DialogExt;

/// Opens the native Windows folder picker dialog.
#[tauri::command]
pub async fn pick_folder(
    app: tauri::AppHandle,
    default_path: Option<String>,
) -> Result<Option<String>, String> {
    let mut builder = app.dialog().file();

    if let Some(dir) = default_path {
        if !dir.trim().is_empty() {
            builder = builder.set_directory(dir);
        }
    }

    let result = builder.blocking_pick_folder();

    match result {
        Some(file_path) => Ok(Some(file_path.to_string())),
        None => Ok(None),
    }
}

/// Lists directories inside the target WSL distribution at the requested path.
#[tauri::command]
pub async fn list_wsl_directories(
    distro: String,
    path: Option<String>,
    filesystem_service: tauri::State<'_, Arc<FilesystemService>>,
) -> Result<DirectoryListing, String> {
    filesystem_service.list_wsl_directories(&distro, path.as_deref())
}

/// Validates a directory path for the given environment (Windows or WSL distro).
#[tauri::command]
pub async fn validate_directory(
    environment: Environment,
    path: String,
    filesystem_service: tauri::State<'_, Arc<FilesystemService>>,
) -> Result<PathValidationResult, String> {
    filesystem_service.validate_directory(&environment, &path)
}
