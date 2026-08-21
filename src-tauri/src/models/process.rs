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
        };

        let json = serde_json::to_string(&info).expect("Failed to serialize");
        assert!(json.contains("\"parentPid\":5678"));
        assert!(json.contains("\"executablePath\":\"C:\\\\Program Files\\\\nodejs\\\\node.exe\""));
        assert!(json.contains("\"commandLine\":\"node server.js\""));
        assert!(json.contains("\"workingDirectory\":\"C:\\\\projects\\\\app\""));
        assert!(json.contains("\"status\":\"running\""));
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
        };

        let json = serde_json::to_string(&info).expect("Failed to serialize");
        let deserialized: ProcessInfo = serde_json::from_str(&json).expect("Failed to deserialize");
        assert_eq!(deserialized.pid, 4);
        assert_eq!(deserialized.parent_pid, None);
        assert_eq!(deserialized.executable_path, None);
        assert_eq!(deserialized.status, ProcessStatus::AccessRestricted);
    }
}
