pub mod commands;
pub mod discovery;
pub mod identity;
pub mod models;
pub mod process;
pub mod windows;
pub mod wsl;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::system::get_system_info,
            commands::processes::get_processes,
            commands::ports::get_listening_ports,
            commands::identity::get_process_identities,
            commands::identity::get_process_identity,
            commands::control::stop_server,
            commands::control::force_stop_server,
            commands::wsl::get_wsl_distributions,
            commands::wsl::get_unified_snapshot
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

