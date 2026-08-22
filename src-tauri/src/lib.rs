pub mod commands;
pub mod db;
pub mod discovery;
pub mod filesystem;
pub mod identity;
pub mod launcher;
pub mod models;
pub mod process;
pub mod profile;
pub mod project;
pub mod windows;
pub mod wsl;

use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Determine local application data directory for SQLite persistence
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("DevHub"));

            let db_path = app_data_dir.join("devhub.db");

            // Initialize SQLite database and run versioned migrations
            let sqlite_repo = Arc::new(
                db::initialize_database(&db_path)
                    .expect("Failed to initialize DevHub SQLite database"),
            );

            let profile_repo: Arc<dyn db::ServerProfileRepository> = sqlite_repo.clone();
            let project_repo: Arc<dyn db::ProjectRepository> = sqlite_repo;

            let profile_service = Arc::new(profile::ServerProfileService::new(profile_repo.clone()));
            let discovery_service = Arc::new(discovery::UnifiedDiscoveryService::new());
            let process_control_service = Arc::new(process::ProcessControlService::new());
            let start_service = Arc::new(profile::ServerStartService::new(
                profile_repo.clone(),
                discovery_service.clone(),
                process_control_service.clone(),
            ));

            let project_service = Arc::new(project::ProjectService::new(project_repo.clone()));
            let project_orchestrator = Arc::new(project::ProjectOrchestrator::new(
                project_repo,
                profile_repo,
                start_service.clone(),
                process_control_service,
                discovery_service.clone(),
            ));
            let filesystem_service = Arc::new(filesystem::FilesystemService::new());

            app.manage(profile_service);
            app.manage(discovery_service);
            app.manage(start_service);
            app.manage(project_service);
            app.manage(project_orchestrator);
            app.manage(filesystem_service);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::system::get_system_info,
            commands::system::get_diagnostics,
            commands::processes::get_processes,
            commands::ports::get_listening_ports,
            commands::identity::get_process_identities,
            commands::identity::get_process_identity,
            commands::control::stop_server,
            commands::control::force_stop_server,
            commands::wsl::get_wsl_distributions,
            commands::wsl::get_unified_snapshot,
            commands::profiles::get_server_profiles,
            commands::profiles::get_server_profile,
            commands::profiles::create_server_profile,
            commands::profiles::update_server_profile,
            commands::profiles::delete_server_profile,
            commands::profiles::get_server_profiles_with_status,
            commands::profiles::start_server_profile,
            commands::profiles::restart_server_profile,
            commands::adoption::find_duplicate_server_profiles,
            commands::project::get_projects,
            commands::project::get_project,
            commands::project::create_project,
            commands::project::update_project,
            commands::project::delete_project,
            commands::project::add_profile_to_project,
            commands::project::remove_profile_from_project,
            commands::project::reorder_project_profiles,
            commands::project::get_project_for_profile,
            commands::project::get_project_views,
            commands::project::start_project,
            commands::project::stop_project,
            commands::project::restart_project,
            commands::filesystem::pick_folder,
            commands::filesystem::list_wsl_directories,
            commands::filesystem::validate_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}



