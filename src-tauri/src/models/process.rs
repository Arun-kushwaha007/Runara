use crate::models::environment::Environment;
use serde::{Deserialize, Serialize};

/// Represents the status or availability of process metadata.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ProcessStatus {
    Running,
    Unavailable,
    AccessRestricted,
    Unknown,
}

/// Normalized process information discovered from the operating system.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pub pid: u32,
    pub parent_pid: Option<u32>,
    pub name: String,
    pub executable_path: Option<String>,
    pub command_line: Option<String>,
    pub working_directory: Option<String>,
    pub status: ProcessStatus,
    #[serde(default)]
    pub environment: Environment,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_info_serialization_camel_case() {
        let info = ProcessInfo {
            pid: 1234,
            parent_pid: Some(5678),
            name: "node.exe".to_string(),
            executable_path: Some("C:\\Program Files\\nodejs\\node.exe".to_string()),
            command_line: Some("node server.js".to_string()),
            working_directory: Some("C:\\projects\\app".to_string()),
            status: ProcessStatus::Running,
            environment: Environment::windows(),
        };

        let json = serde_json::to_string(&info).expect("Failed to serialize");
        assert!(json.contains("\"parentPid\":5678"));
        assert!(json.contains("\"executablePath\":\"C:\\\\Program Files\\\\nodejs\\\\node.exe\""));
        assert!(json.contains("\"commandLine\":\"node server.js\""));
        assert!(json.contains("\"workingDirectory\":\"C:\\\\projects\\\\app\""));
        assert!(json.contains("\"status\":\"running\""));
        assert!(json.contains("\"environment\":{\"type\":\"windows\"}"));
    }

    #[test]
    fn test_process_info_wsl_serialization() {
        let info = ProcessInfo {
            pid: 421,
            parent_pid: Some(390),
            name: "node".to_string(),
            executable_path: Some("/usr/bin/node".to_string()),
            command_line: Some("npm run dev".to_string()),
            working_directory: Some("/home/developer/projects/api".to_string()),
            status: ProcessStatus::Running,
            environment: Environment::wsl("Fedora"),
        };

        let json = serde_json::to_string(&info).expect("Failed to serialize");
        assert!(json.contains("\"environment\":{\"type\":\"wsl\",\"distro\":\"Fedora\"}"));

        let deserialized: ProcessInfo = serde_json::from_str(&json).expect("Failed to deserialize");
        assert_eq!(deserialized.environment, Environment::Wsl { distro: "Fedora".to_string() });
    }

    #[test]
    fn test_process_info_optional_fields() {
        let info = ProcessInfo {
            pid: 4,
            parent_pid: None,
            name: "System".to_string(),
            executable_path: None,
            command_line: None,
            working_directory: None,
            status: ProcessStatus::AccessRestricted,
            environment: Environment::windows(),
        };

        let json = serde_json::to_string(&info).expect("Failed to serialize");
        let deserialized: ProcessInfo = serde_json::from_str(&json).expect("Failed to deserialize");
        assert_eq!(deserialized.pid, 4);
        assert_eq!(deserialized.parent_pid, None);
        assert_eq!(deserialized.executable_path, None);
        assert_eq!(deserialized.status, ProcessStatus::AccessRestricted);
        assert_eq!(deserialized.environment, Environment::Windows);
    }
}
