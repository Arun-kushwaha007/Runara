pub mod commands;
pub mod db;
pub mod discovery;
pub mod identity;
pub mod launcher;
pub mod models;
pub mod process;
pub mod profile;
pub mod windows;
pub mod wsl;

use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Determine local application data directory for SQLite persistence
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("DevHub"));

            let db_path = app_data_dir.join("devhub.db");

            // Initialize SQLite database and run versioned migrations
            let repo: Arc<dyn db::ServerProfileRepository> = Arc::new(
                db::initialize_database(&db_path)
                    .expect("Failed to initialize DevHub SQLite database"),
            );

            let profile_service = Arc::new(profile::ServerProfileService::new(repo.clone()));
            let discovery_service = Arc::new(discovery::UnifiedDiscoveryService::new());
            let process_control_service = Arc::new(process::ProcessControlService::new());
            let start_service = Arc::new(profile::ServerStartService::new(
                repo,
                discovery_service.clone(),
                process_control_service,
            ));

            app.manage(profile_service);
            app.manage(discovery_service);
            app.manage(start_service);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::system::get_system_info,
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
            commands::adoption::find_duplicate_server_profiles
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


