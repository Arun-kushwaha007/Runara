pub mod commands;
pub mod discovery;
pub mod models;
pub mod windows;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::system::get_system_info,
            commands::processes::get_processes,
            commands::ports::get_listening_ports
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
