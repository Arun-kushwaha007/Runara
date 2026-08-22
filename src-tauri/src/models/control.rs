use crate::models::environment::Environment;
use serde::{Deserialize, Serialize};

/// Target process payload sent by the frontend to request a stop or restart operation.
/// Encapsulates multiple identity signals for fresh pre-termination verification.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessTarget {
    /// Operating system Process Identifier (PID).
    pub pid: u32,
    /// Expected process image name (e.g. "node.exe", "python.exe").
    pub process_name: String,
    /// Expected executable binary path on disk (if previously discovered).
    pub executable_path: Option<String>,
    /// Expected working directory / project workspace path (if previously discovered).
    pub working_directory: Option<String>,
    /// Expected network listening ports bound by this process.
    #[serde(default)]
    pub expected_ports: Vec<u16>,
    /// If true, performs immediate force termination without waiting for graceful exit.
    #[serde(default)]
    pub force: bool,
    /// Target execution environment (Windows or WSL).
    #[serde(default)]
    pub environment: Option<Environment>,
}

/// Operational status returned after a process control action.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ControlStatus {
    /// Target process and its descendants exited, and all associated ports released.
    Stopped,
    /// Target process exited, but one or more ports are still bound by a remaining process.
    PortStillInUse,
    /// Target process exited, but a new process has bound to the expected port.
    PortOwnerChanged,
    /// Target process was already terminated prior to the stop request.
    AlreadyStopped,
    /// The control operation failed.
    Error,
}

/// Diagnostics for a port that remains occupied following process termination.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemainingOwnerInfo {
    pub pid: u32,
    pub process_name: String,
    pub port: u16,
}

/// Structured outcome of a process control operation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ControlResult {
    /// Final lifecycle status of the operation.
    pub status: ControlStatus,
    /// The target PID that was operated on.
    pub pid: u32,
    /// List of TCP ports successfully freed and verified released.
    pub released_ports: Vec<u16>,
    /// List of descendant PIDs that could not be terminated (if any).
    #[serde(default)]
    pub remaining_children: Vec<u32>,
    /// Information on any new or remaining process occupying the expected ports.
    pub remaining_owner: Option<RemainingOwnerInfo>,
    /// Human-readable diagnostic or informational message.
    pub message: String,
}

/// Structured domain error codes for process control operations.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProcessControlErrorCode {
    #[serde(rename = "PROCESS_NOT_FOUND")]
    ProcessNotFound,
    #[serde(rename = "PROCESS_IDENTITY_CHANGED")]
    ProcessIdentityChanged,
    #[serde(rename = "PROCESS_ACCESS_DENIED")]
    ProcessAccessDenied,
    #[serde(rename = "PROCESS_TERMINATION_FAILED")]
    ProcessTerminationFailed,
    #[serde(rename = "DESCENDANT_TERMINATION_FAILED")]
    DescendantTerminationFailed,
    #[serde(rename = "TIMEOUT")]
    Timeout,
    #[serde(rename = "PORT_STILL_IN_USE")]
    PortStillInUse,
    #[serde(rename = "PORT_OWNER_CHANGED")]
    PortOwnerChanged,
    #[serde(rename = "INVALID_TARGET")]
    InvalidTarget,
    #[serde(rename = "ALREADY_STOPPED")]
    AlreadyStopped,
    #[serde(rename = "UNSAFE_TARGET")]
    UnsafeTarget,
    #[serde(rename = "WSL_DISTRIBUTION_NOT_FOUND")]
    WslDistributionNotFound,
    #[serde(rename = "WSL_DISTRIBUTION_STOPPED")]
    WslDistributionStopped,
    #[serde(rename = "WSL_ERROR")]
    WslError,
    #[serde(rename = "OPERATION_IN_PROGRESS")]
    OperationInProgress,
    #[serde(rename = "UNKNOWN_ERROR")]
    UnknownError,
}

impl std::fmt::Display for ProcessControlErrorCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ProcessNotFound => write!(f, "PROCESS_NOT_FOUND"),
            Self::ProcessIdentityChanged => write!(f, "PROCESS_IDENTITY_CHANGED"),
            Self::ProcessAccessDenied => write!(f, "PROCESS_ACCESS_DENIED"),
            Self::ProcessTerminationFailed => write!(f, "PROCESS_TERMINATION_FAILED"),
            Self::DescendantTerminationFailed => write!(f, "DESCENDANT_TERMINATION_FAILED"),
            Self::Timeout => write!(f, "TIMEOUT"),
            Self::PortStillInUse => write!(f, "PORT_STILL_IN_USE"),
            Self::PortOwnerChanged => write!(f, "PORT_OWNER_CHANGED"),
            Self::InvalidTarget => write!(f, "INVALID_TARGET"),
            Self::AlreadyStopped => write!(f, "ALREADY_STOPPED"),
            Self::UnsafeTarget => write!(f, "UNSAFE_TARGET"),
            Self::WslDistributionNotFound => write!(f, "WSL_DISTRIBUTION_NOT_FOUND"),
            Self::WslDistributionStopped => write!(f, "WSL_DISTRIBUTION_STOPPED"),
            Self::WslError => write!(f, "WSL_ERROR"),
            Self::OperationInProgress => write!(f, "OPERATION_IN_PROGRESS"),
            Self::UnknownError => write!(f, "UNKNOWN_ERROR"),
        }
    }
}

/// Structured error payload returned to Tauri IPC clients on failure.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessControlError {
    pub code: ProcessControlErrorCode,
    pub message: String,
    pub pid: Option<u32>,
}

impl std::fmt::Display for ProcessControlError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}]: {}", self.code, self.message)
    }
}

impl std::error::Error for ProcessControlError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_target_serialization_camel_case() {
        let target = ProcessTarget {
            pid: 18240,
            process_name: "node.exe".to_string(),
            executable_path: Some("C:\\nodejs\\node.exe".to_string()),
            working_directory: Some("C:\\projects\\app".to_string()),
            expected_ports: vec![3000, 3001],
            force: false,
            environment: Some(Environment::windows()),
        };

        let json = serde_json::to_string(&target).expect("Serialization failed");
        assert!(json.contains("\"processName\":\"node.exe\""));
        assert!(json.contains("\"executablePath\":\"C:\\\\nodejs\\\\node.exe\""));
        assert!(json.contains("\"workingDirectory\":\"C:\\\\projects\\\\app\""));
        assert!(json.contains("\"expectedPorts\":[3000,3001]"));
        assert!(json.contains("\"force\":false"));
        assert!(json.contains("\"environment\":{\"type\":\"windows\"}"));

        let deserialized: ProcessTarget = serde_json::from_str(&json).expect("Deserialization failed");
        assert_eq!(deserialized, target);
    }

    #[test]
    fn test_control_result_serialization_camel_case() {
        let result = ControlResult {
            status: ControlStatus::Stopped,
            pid: 18240,
            released_ports: vec![3000],
            remaining_children: vec![],
            remaining_owner: None,
            message: "Process 18240 stopped successfully and port 3000 released.".to_string(),
        };

        let json = serde_json::to_string(&result).expect("Serialization failed");
        assert!(json.contains("\"status\":\"stopped\""));
        assert!(json.contains("\"pid\":18240"));
        assert!(json.contains("\"releasedPorts\":[3000]"));
        assert!(json.contains("\"remainingChildren\":[]"));
        assert!(json.contains("\"remainingOwner\":null"));

        let deserialized: ControlResult = serde_json::from_str(&json).expect("Deserialization failed");
        assert_eq!(deserialized, result);
    }

    #[test]
    fn test_port_owner_changed_serialization() {
        let result = ControlResult {
            status: ControlStatus::PortOwnerChanged,
            pid: 18240,
            released_ports: vec![],
            remaining_children: vec![],
            remaining_owner: Some(RemainingOwnerInfo {
                pid: 19320,
                process_name: "node.exe".to_string(),
                port: 3000,
            }),
            message: "Server stopped, but port 3000 is now owned by PID 19320 (node.exe)".to_string(),
        };

        let json = serde_json::to_string(&result).expect("Serialization failed");
        assert!(json.contains("\"status\":\"port_owner_changed\""));
        assert!(json.contains("\"remainingOwner\":{\"pid\":19320,\"processName\":\"node.exe\",\"port\":3000}"));
    }

    #[test]
    fn test_error_code_formatting() {
        assert_eq!(ProcessControlErrorCode::ProcessNotFound.to_string(), "PROCESS_NOT_FOUND");
        assert_eq!(ProcessControlErrorCode::ProcessIdentityChanged.to_string(), "PROCESS_IDENTITY_CHANGED");
        assert_eq!(ProcessControlErrorCode::ProcessAccessDenied.to_string(), "PROCESS_ACCESS_DENIED");
        assert_eq!(ProcessControlErrorCode::UnsafeTarget.to_string(), "UNSAFE_TARGET");
    }
}
