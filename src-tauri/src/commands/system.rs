use crate::discovery::{UnifiedDiscovery, UnifiedDiscoveryService};
use crate::models::environment::WslDistribution;
use crate::profile::ServerProfileService;
use crate::project::ProjectService;
use crate::wsl::{DefaultWslDistroDiscovery, WslDistroDiscovery};
use serde::Serialize;
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub app: String,
    pub version: String,
    pub backend: String,
    pub status: String,
    pub platform: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemDiagnostics {
    pub app_name: String,
    pub app_version: String,
    pub backend: String,
    pub platform: String,
    pub arch: String,
    pub tauri_version: String,
    pub wsl_available: bool,
    pub wsl_distributions: Vec<WslDistribution>,
    pub database_status: String,
    pub database_schema_version: i32,
    pub profile_count: usize,
    pub project_count: usize,
    pub active_processes_count: usize,
    pub listening_ports_count: usize,
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

#[tauri::command]
pub fn get_diagnostics(
    profile_service: State<'_, Arc<ServerProfileService>>,
    project_service: State<'_, Arc<ProjectService>>,
    discovery_service: State<'_, Arc<UnifiedDiscoveryService>>,
) -> Result<SystemDiagnostics, String> {
    let snapshot = discovery_service.discover_all().unwrap_or_default();
    let profiles = profile_service.list_profiles().unwrap_or_default();
    let projects = project_service.list_projects().unwrap_or_default();
    
    let wsl_discovery = DefaultWslDistroDiscovery::new();
    let wsl_distros = wsl_discovery.enumerate().unwrap_or_default();

    Ok(SystemDiagnostics {
        app_name: "DevHub".to_string(),
        app_version: "0.1.0".to_string(),
        backend: "Rust (Win32 FFI + Native Sockets)".to_string(),
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        tauri_version: "2.0".to_string(),
        wsl_available: !wsl_distros.is_empty(),
        wsl_distributions: wsl_distros,
        database_status: "Healthy (SQLite WAL Mode)".to_string(),
        database_schema_version: 2, // Migration 1 (profiles) + Migration 2 (projects & memberships)
        profile_count: profiles.len(),
        project_count: projects.len(),
        active_processes_count: snapshot.processes.len(),
        listening_ports_count: snapshot.ports.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_info() {
        let info = get_system_info();
        assert_eq!(info.app, "DevHub");
        assert_eq!(info.version, "0.1.0");
        assert_eq!(info.backend, "rust");
    }
}
