use serde::Serialize;

#[derive(Serialize)]
pub struct SystemInfo {
    pub app: String,
    pub version: String,
    pub backend: String,
    pub status: String,
    pub platform: String,
}

#[tauri::command]
pub fn get_system_info() -> SystemInfo {
    SystemInfo {
        app: "DevHub".to_string(),
        version: "0.1.0".to_string(),
        backend: "rust".to_string(),
        status: "ok".to_string(),
        platform: std::env::consts::OS.to_string(),
    }
}
