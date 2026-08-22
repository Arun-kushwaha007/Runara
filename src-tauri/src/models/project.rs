use crate::models::profile::{ProfileRuntimeStatus, ServerProfile};
use serde::{Deserialize, Serialize};

/// Persistent domain model representing a logical project group of server profiles.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    /// Persistent unique identifier (UUID v4).
    pub id: String,
    /// Project name (e.g., "Company Platform").
    pub name: String,
    /// Optional developer description or notes.
    pub description: Option<String>,
    /// ISO-8601 timestamp string when the project was created.
    pub created_at: String,
    /// ISO-8601 timestamp string when the project was last modified.
    pub updated_at: String,
}

/// Request payload to create a new project.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectRequest {
    pub name: String,
    pub description: Option<String>,
}

/// Request payload to update an existing project.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProjectRequest {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
}

/// Request payload to add a profile to a project.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddProfileToProjectRequest {
    pub project_id: String,
    pub profile_id: String,
    pub order_index: Option<i32>,
}

/// Request payload to reorder profiles within a project.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderProjectProfilesRequest {
    pub project_id: String,
    pub profile_ids: Vec<String>,
}

/// Dynamic runtime operational status of a Project, derived deterministically
/// from the live runtime states of its constituent server profiles.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProjectRuntimeStatus {
    /// All child profiles are stopped, or the project has no profiles.
    Stopped,
    /// A project-level start operation is currently in progress.
    Starting,
    /// All child profiles are running and healthy.
    Running,
    /// Some child profiles are running, while others are stopped or unsupported.
    Partial,
    /// A project-level stop operation is currently in progress.
    Stopping,
    /// A project-level start or stop operation failed or a child profile is in error.
    Error,
    /// Child state cannot be reliably determined.
    Unknown,
}

impl std::fmt::Display for ProjectRuntimeStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Stopped => write!(f, "stopped"),
            Self::Starting => write!(f, "starting"),
            Self::Running => write!(f, "running"),
            Self::Partial => write!(f, "partial"),
            Self::Stopping => write!(f, "stopping"),
            Self::Error => write!(f, "error"),
            Self::Unknown => write!(f, "unknown"),
        }
    }
}

/// Composite presentation model representing an individual profile membership inside a project,
/// including its execution order and live derived runtime state.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectProfileView {
    /// Persistent profile configuration.
    pub profile: ServerProfile,
    /// Deterministic 1-based or 0-based execution order index.
    pub order_index: i32,
    /// Live derived runtime status.
    pub status: ProfileRuntimeStatus,
    /// Active OS Process ID if currently running.
    pub active_pid: Option<u32>,
    /// Active listening TCP port if currently bound.
    pub active_port: Option<u16>,
    /// Diagnostic error message if child is in Error status.
    pub error_message: Option<String>,
}

/// Composite view model representing a full Project with its aggregated runtime status
/// and ordered child profile views.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectView {
    /// Persistent project metadata.
    pub project: Project,
    /// Aggregated live runtime status.
    pub status: ProjectRuntimeStatus,
    /// Ordered list of member profiles.
    pub profiles: Vec<ProjectProfileView>,
    /// Total number of configured services in this project.
    pub total_services: usize,
    /// Count of currently running services.
    pub running_services: usize,
    /// Count of currently stopped services.
    pub stopped_services: usize,
    /// Optional diagnostic error or note (e.g., WSL stop limitation).
    pub diagnostic_message: Option<String>,
}

/// Structured result returned after a project-level start, stop, or restart operation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectOperationResult {
    pub project_id: String,
    pub operation_type: String,
    pub status: ProjectRuntimeStatus,
    pub started_profiles: Vec<String>,
    pub stopped_profiles: Vec<String>,
    pub failed_profile: Option<String>,
    pub pending_profiles: Vec<String>,
    pub unsupported_profiles: Vec<String>,
    pub message: String,
}

/// Structured error codes for project domain and orchestration operations.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProjectErrorCode {
    #[serde(rename = "PROJECT_NOT_FOUND")]
    ProjectNotFound,
    #[serde(rename = "INVALID_PROJECT")]
    InvalidProject,
    #[serde(rename = "PROFILE_NOT_FOUND")]
    ProfileNotFound,
    #[serde(rename = "PROFILE_ALREADY_IN_PROJECT")]
    ProfileAlreadyInProject,
    #[serde(rename = "EMPTY_PROJECT")]
    EmptyProject,
    #[serde(rename = "PROJECT_OPERATION_IN_PROGRESS")]
    ProjectOperationInProgress,
    #[serde(rename = "PROFILE_OPERATION_IN_PROGRESS")]
    ProfileOperationInProgress,
    #[serde(rename = "START_FAILED")]
    StartFailed,
    #[serde(rename = "STOP_FAILED")]
    StopFailed,
    #[serde(rename = "UNSUPPORTED_OPERATION")]
    UnsupportedOperation,
    #[serde(rename = "DATABASE_ERROR")]
    DatabaseError,
}

impl std::fmt::Display for ProjectErrorCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ProjectNotFound => write!(f, "PROJECT_NOT_FOUND"),
            Self::InvalidProject => write!(f, "INVALID_PROJECT"),
            Self::ProfileNotFound => write!(f, "PROFILE_NOT_FOUND"),
            Self::ProfileAlreadyInProject => write!(f, "PROFILE_ALREADY_IN_PROJECT"),
            Self::EmptyProject => write!(f, "EMPTY_PROJECT"),
            Self::ProjectOperationInProgress => write!(f, "PROJECT_OPERATION_IN_PROGRESS"),
            Self::ProfileOperationInProgress => write!(f, "PROFILE_OPERATION_IN_PROGRESS"),
            Self::StartFailed => write!(f, "START_FAILED"),
            Self::StopFailed => write!(f, "STOP_FAILED"),
            Self::UnsupportedOperation => write!(f, "UNSUPPORTED_OPERATION"),
            Self::DatabaseError => write!(f, "DATABASE_ERROR"),
        }
    }
}

/// Structured error payload returned to Tauri IPC clients on project operations.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectError {
    pub code: ProjectErrorCode,
    pub message: String,
    pub project_id: Option<String>,
}

impl std::fmt::Display for ProjectError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}]: {}", self.code, self.message)
    }
}

impl std::error::Error for ProjectError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_project_serialization_camel_case() {
        let proj = Project {
            id: "proj-123".to_string(),
            name: "Company Platform".to_string(),
            description: Some("Core microservices".to_string()),
            created_at: "2026-08-22T20:00:00Z".to_string(),
            updated_at: "2026-08-22T20:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&proj).unwrap();
        assert!(json.contains("\"id\":\"proj-123\""));
        assert!(json.contains("\"name\":\"Company Platform\""));
        assert!(json.contains("\"createdAt\":\"2026-08-22T20:00:00Z\""));

        let deserialized: Project = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, proj);
    }

    #[test]
    fn test_project_runtime_status_display() {
        assert_eq!(ProjectRuntimeStatus::Stopped.to_string(), "stopped");
        assert_eq!(ProjectRuntimeStatus::Starting.to_string(), "starting");
        assert_eq!(ProjectRuntimeStatus::Running.to_string(), "running");
        assert_eq!(ProjectRuntimeStatus::Partial.to_string(), "partial");
        assert_eq!(ProjectRuntimeStatus::Stopping.to_string(), "stopping");
        assert_eq!(ProjectRuntimeStatus::Error.to_string(), "error");
        assert_eq!(ProjectRuntimeStatus::Unknown.to_string(), "unknown");
    }

    #[test]
    fn test_project_operation_result_serialization() {
        let res = ProjectOperationResult {
            project_id: "proj-1".to_string(),
            operation_type: "start".to_string(),
            status: ProjectRuntimeStatus::Running,
            started_profiles: vec!["prof-1".to_string(), "prof-2".to_string()],
            stopped_profiles: vec![],
            failed_profile: None,
            pending_profiles: vec![],
            unsupported_profiles: vec![],
            message: "Project started successfully.".to_string(),
        };

        let json = serde_json::to_string(&res).unwrap();
        assert!(json.contains("\"projectId\":\"proj-1\""));
        assert!(json.contains("\"operationType\":\"start\""));
        assert!(json.contains("\"status\":\"running\""));
        assert!(json.contains("\"startedProfiles\":[\"prof-1\",\"prof-2\"]"));
    }
}
