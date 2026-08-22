use crate::models::control::RemainingOwnerInfo;
use crate::models::environment::Environment;
use serde::{Deserialize, Serialize};

/// Persistent domain model representing a saved development server configuration.
/// Encapsulates all instructions required to start and identify a local server.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerProfile {
    /// Persistent unique identifier (UUID v4). Survives restarts and process recreation.
    pub id: String,
    /// Human-friendly display name (e.g. "Company Frontend").
    pub name: String,
    /// Optional developer description or notes.
    pub description: Option<String>,
    /// Target execution environment (Windows Host or specific WSL Distribution).
    pub environment: Environment,
    /// Project root / working directory from which the command should execute.
    pub working_directory: String,
    /// Exact startup command (e.g. "npm run dev", "python -m uvicorn main:app").
    pub command: String,
    /// Expected network listening TCP port (e.g. 3000, 5000, 8080).
    pub expected_port: Option<u16>,
    /// Optional expected host binding (e.g. "127.0.0.1", "0.0.0.0", "localhost").
    pub expected_host: Option<String>,
    /// Whether the profile is currently active/enabled in DevHub.
    pub enabled: bool,
    /// ISO-8601 timestamp string when the profile was created.
    pub created_at: String,
    /// ISO-8601 timestamp string when the profile was last modified.
    pub updated_at: String,
}

/// Request payload to create a new server profile.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProfileRequest {
    pub name: String,
    pub description: Option<String>,
    pub environment: Environment,
    pub working_directory: String,
    pub command: String,
    pub expected_port: Option<u16>,
    pub expected_host: Option<String>,
}

/// Request payload to update an existing server profile.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfileRequest {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub environment: Environment,
    pub working_directory: String,
    pub command: String,
    pub expected_port: Option<u16>,
    pub expected_host: Option<String>,
    pub enabled: Option<bool>,
}

/// Dynamic, runtime-derived operational state of a server profile.
/// Computed on-the-fly by joining persistent profile configuration with live OS discovery snapshots.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProfileRuntimeStatus {
    /// Saved profile configuration exists; no matching process or port is running.
    Stopped,
    /// A start operation is actively launching and monitoring process/port discovery.
    Starting,
    /// Matching server process is discovered alive and listening on expected port.
    Running,
    /// Startup command failed, timed out, or process exited with error.
    Error,
}

impl std::fmt::Display for ProfileRuntimeStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Stopped => write!(f, "stopped"),
            Self::Starting => write!(f, "starting"),
            Self::Running => write!(f, "running"),
            Self::Error => write!(f, "error"),
        }
    }
}

/// Composite presentation view model pairing persistent ServerProfile with its live runtime status.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerProfileView {
    /// Persistent configuration.
    pub profile: ServerProfile,
    /// Live derived runtime status.
    pub status: ProfileRuntimeStatus,
    /// Associated operating system Process ID if currently running.
    pub active_pid: Option<u32>,
    /// Associated listening TCP port if currently active.
    pub active_port: Option<u16>,
    /// Diagnostic error message if in Error status.
    pub error_message: Option<String>,
    /// ISO timestamp when the server was started in the current session.
    pub last_started_at: Option<String>,
    /// Associated dashboard server snapshot ID if linked.
    pub dashboard_server_id: Option<String>,
}

/// Result returned after starting or restarting a server profile.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartProfileResult {
    pub profile_id: String,
    pub status: ProfileRuntimeStatus,
    pub pid: Option<u32>,
    pub port: Option<u16>,
    pub message: String,
}

/// Structured error codes for server profile and start operations.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum StartErrorCode {
    #[serde(rename = "PROFILE_NOT_FOUND")]
    ProfileNotFound,
    #[serde(rename = "INVALID_PROFILE")]
    InvalidProfile,
    #[serde(rename = "WORKING_DIRECTORY_NOT_FOUND")]
    WorkingDirectoryNotFound,
    #[serde(rename = "COMMAND_NOT_FOUND")]
    CommandNotFound,
    #[serde(rename = "PORT_ALREADY_IN_USE")]
    PortAlreadyInUse,
    #[serde(rename = "ENVIRONMENT_UNAVAILABLE")]
    EnvironmentUnavailable,
    #[serde(rename = "WSL_DISTRO_NOT_FOUND")]
    WslDistroNotFound,
    #[serde(rename = "WSL_DISTRO_STOPPED")]
    WslDistroStopped,
    #[serde(rename = "START_FAILED")]
    StartFailed,
    #[serde(rename = "PROCESS_EXITED")]
    ProcessExited,
    #[serde(rename = "STARTUP_TIMEOUT")]
    StartupTimeout,
    #[serde(rename = "PORT_OWNER_CHANGED")]
    PortOwnerChanged,
    #[serde(rename = "PROCESS_ASSOCIATION_FAILED")]
    ProcessAssociationFailed,
    #[serde(rename = "DATABASE_ERROR")]
    DatabaseError,
    #[serde(rename = "UNSUPPORTED_OPERATION")]
    UnsupportedOperation,
    #[serde(rename = "ALREADY_RUNNING")]
    AlreadyRunning,
}

impl std::fmt::Display for StartErrorCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ProfileNotFound => write!(f, "PROFILE_NOT_FOUND"),
            Self::InvalidProfile => write!(f, "INVALID_PROFILE"),
            Self::WorkingDirectoryNotFound => write!(f, "WORKING_DIRECTORY_NOT_FOUND"),
            Self::CommandNotFound => write!(f, "COMMAND_NOT_FOUND"),
            Self::PortAlreadyInUse => write!(f, "PORT_ALREADY_IN_USE"),
            Self::EnvironmentUnavailable => write!(f, "ENVIRONMENT_UNAVAILABLE"),
            Self::WslDistroNotFound => write!(f, "WSL_DISTRO_NOT_FOUND"),
            Self::WslDistroStopped => write!(f, "WSL_DISTRO_STOPPED"),
            Self::StartFailed => write!(f, "START_FAILED"),
            Self::ProcessExited => write!(f, "PROCESS_EXITED"),
            Self::StartupTimeout => write!(f, "STARTUP_TIMEOUT"),
            Self::PortOwnerChanged => write!(f, "PORT_OWNER_CHANGED"),
            Self::ProcessAssociationFailed => write!(f, "PROCESS_ASSOCIATION_FAILED"),
            Self::DatabaseError => write!(f, "DATABASE_ERROR"),
            Self::UnsupportedOperation => write!(f, "UNSUPPORTED_OPERATION"),
            Self::AlreadyRunning => write!(f, "ALREADY_RUNNING"),
        }
    }
}

/// Structured error payload returned to Tauri IPC clients on startup or profile failure.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartError {
    pub code: StartErrorCode,
    pub message: String,
    pub profile_id: Option<String>,
    pub current_owner: Option<RemainingOwnerInfo>,
}

impl std::fmt::Display for StartError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}]: {}", self.code, self.message)
    }
}

impl std::error::Error for StartError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_server_profile_serialization_camel_case() {
        let profile = ServerProfile {
            id: "550e8400-e29b-41d4-a716-446655440000".to_string(),
            name: "Company Frontend".to_string(),
            description: Some("Main React dashboard".to_string()),
            environment: Environment::windows(),
            working_directory: "C:\\Projects\\company-frontend".to_string(),
            command: "npm run dev".to_string(),
            expected_port: Some(3000),
            expected_host: Some("127.0.0.1".to_string()),
            enabled: true,
            created_at: "2026-08-22T20:00:00Z".to_string(),
            updated_at: "2026-08-22T20:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&profile).expect("Failed to serialize");
        assert!(json.contains("\"id\":\"550e8400-e29b-41d4-a716-446655440000\""));
        assert!(json.contains("\"name\":\"Company Frontend\""));
        assert!(json.contains("\"workingDirectory\":\"C:\\\\Projects\\\\company-frontend\""));
        assert!(json.contains("\"command\":\"npm run dev\""));
        assert!(json.contains("\"expectedPort\":3000"));
        assert!(json.contains("\"expectedHost\":\"127.0.0.1\""));
        assert!(json.contains("\"createdAt\":\"2026-08-22T20:00:00Z\""));

        let deserialized: ServerProfile = serde_json::from_str(&json).expect("Failed to deserialize");
        assert_eq!(deserialized, profile);
    }

    #[test]
    fn test_server_profile_wsl_serialization() {
        let profile = ServerProfile {
            id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8".to_string(),
            name: "Company API".to_string(),
            description: None,
            environment: Environment::wsl("Fedora"),
            working_directory: "/home/developer/projects/api".to_string(),
            command: "npm run dev".to_string(),
            expected_port: Some(5000),
            expected_host: None,
            enabled: true,
            created_at: "2026-08-22T20:00:00Z".to_string(),
            updated_at: "2026-08-22T20:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&profile).expect("Failed to serialize");
        assert!(json.contains("\"environment\":{\"type\":\"wsl\",\"distro\":\"Fedora\"}"));

        let deserialized: ServerProfile = serde_json::from_str(&json).expect("Failed to deserialize");
        assert_eq!(deserialized, profile);
    }

    #[test]
    fn test_profile_view_serialization() {
        let view = ServerProfileView {
            profile: ServerProfile {
                id: "123".to_string(),
                name: "Test Server".to_string(),
                description: None,
                environment: Environment::windows(),
                working_directory: "C:\\test".to_string(),
                command: "npm start".to_string(),
                expected_port: Some(8080),
                expected_host: None,
                enabled: true,
                created_at: "2026-08-22T20:00:00Z".to_string(),
                updated_at: "2026-08-22T20:00:00Z".to_string(),
            },
            status: ProfileRuntimeStatus::Running,
            active_pid: Some(18240),
            active_port: Some(8080),
            error_message: None,
            last_started_at: Some("2026-08-22T20:05:00Z".to_string()),
            dashboard_server_id: Some("win-18240-8080".to_string()),
        };

        let json = serde_json::to_string(&view).expect("Failed to serialize");
        assert!(json.contains("\"status\":\"running\""));
        assert!(json.contains("\"activePid\":18240"));
        assert!(json.contains("\"activePort\":8080"));
        assert!(json.contains("\"dashboardServerId\":\"win-18240-8080\""));
    }

    #[test]
    fn test_start_error_code_formatting() {
        assert_eq!(StartErrorCode::PortAlreadyInUse.to_string(), "PORT_ALREADY_IN_USE");
        assert_eq!(StartErrorCode::WorkingDirectoryNotFound.to_string(), "WORKING_DIRECTORY_NOT_FOUND");
        assert_eq!(StartErrorCode::WslDistroNotFound.to_string(), "WSL_DISTRO_NOT_FOUND");
        assert_eq!(StartErrorCode::StartupTimeout.to_string(), "STARTUP_TIMEOUT");
    }
}
