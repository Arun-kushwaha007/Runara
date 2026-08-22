use crate::discovery::{UnifiedDiscovery, UnifiedDiscoveryService};
use crate::models::project::{
    AddProfileToProjectRequest, CreateProjectRequest, Project, ProjectError,
    ProjectOperationResult, ProjectView, ReorderProjectProfilesRequest, UpdateProjectRequest,
};
use crate::profile::{ServerProfileService, ServerStartService};
use crate::project::{ProjectOrchestrator, ProjectService};
use std::sync::Arc;
use tauri::State;

/// Retrieves all saved Projects without enriched runtime view.
#[tauri::command]
pub fn get_projects(
    project_service: State<'_, Arc<ProjectService>>,
) -> Result<Vec<Project>, ProjectError> {
    project_service.list_projects()
}

/// Retrieves an individual Project by UUID.
#[tauri::command]
pub fn get_project(
    id: String,
    project_service: State<'_, Arc<ProjectService>>,
) -> Result<Option<Project>, ProjectError> {
    project_service.get_project(&id)
}

/// Creates a new Project.
#[tauri::command]
pub fn create_project(
    request: CreateProjectRequest,
    project_service: State<'_, Arc<ProjectService>>,
) -> Result<Project, ProjectError> {
    project_service.create_project(request)
}

/// Updates an existing Project.
#[tauri::command]
pub fn update_project(
    request: UpdateProjectRequest,
    project_service: State<'_, Arc<ProjectService>>,
) -> Result<Project, ProjectError> {
    project_service.update_project(request)
}

/// Deletes a Project by UUID (preserves underlying server profiles).
#[tauri::command]
pub fn delete_project(
    id: String,
    project_service: State<'_, Arc<ProjectService>>,
) -> Result<bool, ProjectError> {
    project_service.delete_project(&id)
}

/// Adds a ServerProfile to a Project.
#[tauri::command]
pub fn add_profile_to_project(
    request: AddProfileToProjectRequest,
    project_service: State<'_, Arc<ProjectService>>,
) -> Result<(), ProjectError> {
    project_service.add_profile_to_project(request)
}

/// Removes a ServerProfile from a Project.
#[tauri::command]
pub fn remove_profile_from_project(
    project_id: String,
    profile_id: String,
    project_service: State<'_, Arc<ProjectService>>,
) -> Result<bool, ProjectError> {
    project_service.remove_profile_from_project(&project_id, &profile_id)
}

/// Reorders profiles in a Project.
#[tauri::command]
pub fn reorder_project_profiles(
    request: ReorderProjectProfilesRequest,
    project_service: State<'_, Arc<ProjectService>>,
) -> Result<(), ProjectError> {
    project_service.reorder_project_profiles(request)
}

/// Retrieves the Project that a specific ServerProfile belongs to (if any).
#[tauri::command]
pub fn get_project_for_profile(
    profile_id: String,
    project_service: State<'_, Arc<ProjectService>>,
) -> Result<Option<Project>, ProjectError> {
    project_service.get_project_for_profile(&profile_id)
}

/// Retrieves all Projects enriched with live child profile states and aggregated health.
#[tauri::command]
pub fn get_project_views(
    project_service: State<'_, Arc<ProjectService>>,
    profile_service: State<'_, Arc<ServerProfileService>>,
    start_service: State<'_, Arc<ServerStartService>>,
    discovery_service: State<'_, Arc<UnifiedDiscoveryService>>,
    orchestrator: State<'_, Arc<ProjectOrchestrator>>,
) -> Result<Vec<ProjectView>, ProjectError> {
    let projects = project_service.list_projects()?;
    let profiles = profile_service.list_profiles().map_err(|e| ProjectError {
        code: crate::models::project::ProjectErrorCode::DatabaseError,
        message: e.message,
        project_id: None,
    })?;

    let snapshot = discovery_service.discover_all().unwrap_or_default();
    let active_start_states = start_service.get_active_start_states();
    let profile_views = profile_service.derive_profile_views(
        &profiles,
        &snapshot.processes,
        &snapshot.ports,
        &active_start_states,
    );

    let active_ops = orchestrator.get_active_operations();

    project_service.derive_project_views(&projects, &profile_views, &active_ops)
}

/// Starts all member profiles of a Project in configured sequential order.
#[tauri::command]
pub fn start_project(
    id: String,
    orchestrator: State<'_, Arc<ProjectOrchestrator>>,
) -> Result<ProjectOperationResult, ProjectError> {
    orchestrator.start_project(&id)
}

/// Stops all running member services of a Project.
#[tauri::command]
pub fn stop_project(
    id: String,
    orchestrator: State<'_, Arc<ProjectOrchestrator>>,
) -> Result<ProjectOperationResult, ProjectError> {
    orchestrator.stop_project(&id)
}

/// Restarts a Project (Windows only).
#[tauri::command]
pub fn restart_project(
    id: String,
    orchestrator: State<'_, Arc<ProjectOrchestrator>>,
) -> Result<ProjectOperationResult, ProjectError> {
    orchestrator.restart_project(&id)
}
