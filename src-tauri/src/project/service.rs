use crate::db::ProjectRepository;
use crate::models::profile::{ProfileRuntimeStatus, ServerProfileView};
use crate::models::project::{
    AddProfileToProjectRequest, CreateProjectRequest, Project, ProjectError, ProjectErrorCode,
    ProjectProfileView, ProjectRuntimeStatus, ProjectView, ReorderProjectProfilesRequest,
    UpdateProjectRequest,
};
use chrono::Utc;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

/// Ephemeral operation record representing active in-flight project operations.
#[derive(Debug, Clone)]
pub struct ProjectOperation {
    pub operation_id: String,
    pub project_id: String,
    pub operation_type: String, // "start" | "stop" | "restart"
    pub current_profile_id: Option<String>,
    pub started_profiles: Vec<String>,
    pub stopped_profiles: Vec<String>,
    pub failed_profile: Option<String>,
    pub pending_profiles: Vec<String>,
    pub started_at_ms: u64,
}

/// Service managing Project lifecycle, validation, memberships, and runtime status derivation.
pub struct ProjectService {
    repository: Arc<dyn ProjectRepository>,
}

impl ProjectService {
    /// Creates a new `ProjectService` backed by a persistent repository.
    pub fn new(repository: Arc<dyn ProjectRepository>) -> Self {
        Self { repository }
    }

    /// Validates project input parameters.
    pub fn validate_project_inputs(name: &str) -> Result<(), ProjectError> {
        if name.trim().is_empty() {
            return Err(ProjectError {
                code: ProjectErrorCode::InvalidProject,
                message: "Project name cannot be empty.".to_string(),
                project_id: None,
            });
        }
        Ok(())
    }

    /// Creates and persists a new Project.
    pub fn create_project(&self, req: CreateProjectRequest) -> Result<Project, ProjectError> {
        Self::validate_project_inputs(&req.name)?;

        let now = Utc::now().to_rfc3339();
        let project = Project {
            id: Uuid::new_v4().to_string(),
            name: req.name.trim().to_string(),
            description: req.description.map(|d| d.trim().to_string()).filter(|d| !d.is_empty()),
            created_at: now.clone(),
            updated_at: now,
        };

        self.repository.create_project(&project).map_err(|e| ProjectError {
            code: ProjectErrorCode::DatabaseError,
            message: format!("Failed to create project: {}", e),
            project_id: None,
        })
    }

    /// Retrieves an individual project by ID.
    pub fn get_project(&self, id: &str) -> Result<Option<Project>, ProjectError> {
        self.repository.get_project_by_id(id).map_err(|e| ProjectError {
            code: ProjectErrorCode::DatabaseError,
            message: format!("Failed to load project {}: {}", id, e),
            project_id: Some(id.to_string()),
        })
    }

    /// Lists all saved projects.
    pub fn list_projects(&self) -> Result<Vec<Project>, ProjectError> {
        self.repository.list_projects().map_err(|e| ProjectError {
            code: ProjectErrorCode::DatabaseError,
            message: format!("Failed to list projects: {}", e),
            project_id: None,
        })
    }

    /// Updates an existing project metadata.
    pub fn update_project(&self, req: UpdateProjectRequest) -> Result<Project, ProjectError> {
        Self::validate_project_inputs(&req.name)?;

        let existing = self.get_project(&req.id)?.ok_or_else(|| ProjectError {
            code: ProjectErrorCode::ProjectNotFound,
            message: format!("Project with ID '{}' does not exist.", req.id),
            project_id: Some(req.id.clone()),
        })?;

        let updated = Project {
            id: req.id,
            name: req.name.trim().to_string(),
            description: req.description.map(|d| d.trim().to_string()).filter(|d| !d.is_empty()),
            created_at: existing.created_at,
            updated_at: Utc::now().to_rfc3339(),
        };

        self.repository.update_project(&updated).map_err(|e| ProjectError {
            code: ProjectErrorCode::DatabaseError,
            message: format!("Failed to update project: {}", e),
            project_id: Some(updated.id.clone()),
        })
    }

    /// Deletes a project. Does NOT delete its underlying server profiles.
    pub fn delete_project(&self, id: &str) -> Result<bool, ProjectError> {
        self.repository.delete_project(id).map_err(|e| ProjectError {
            code: ProjectErrorCode::DatabaseError,
            message: format!("Failed to delete project {}: {}", id, e),
            project_id: Some(id.to_string()),
        })
    }

    /// Adds a profile to a project.
    pub fn add_profile_to_project(&self, req: AddProfileToProjectRequest) -> Result<(), ProjectError> {
        self.get_project(&req.project_id)?.ok_or_else(|| ProjectError {
            code: ProjectErrorCode::ProjectNotFound,
            message: format!("Project with ID '{}' does not exist.", req.project_id),
            project_id: Some(req.project_id.clone()),
        })?;

        self.repository
            .add_profile_to_project(&req.project_id, &req.profile_id, req.order_index)
            .map_err(|e| ProjectError {
                code: ProjectErrorCode::DatabaseError,
                message: format!("Failed to add profile to project: {}", e),
                project_id: Some(req.project_id),
            })
    }

    /// Removes a profile from a project without deleting the profile.
    pub fn remove_profile_from_project(
        &self,
        project_id: &str,
        profile_id: &str,
    ) -> Result<bool, ProjectError> {
        self.repository
            .remove_profile_from_project(project_id, profile_id)
            .map_err(|e| ProjectError {
                code: ProjectErrorCode::DatabaseError,
                message: format!("Failed to remove profile from project: {}", e),
                project_id: Some(project_id.to_string()),
            })
    }

    /// Reorders member profiles within a project.
    pub fn reorder_project_profiles(
        &self,
        req: ReorderProjectProfilesRequest,
    ) -> Result<(), ProjectError> {
        self.get_project(&req.project_id)?.ok_or_else(|| ProjectError {
            code: ProjectErrorCode::ProjectNotFound,
            message: format!("Project with ID '{}' does not exist.", req.project_id),
            project_id: Some(req.project_id.clone()),
        })?;

        self.repository
            .reorder_project_profiles(&req.project_id, &req.profile_ids)
            .map_err(|e| ProjectError {
                code: ProjectErrorCode::DatabaseError,
                message: format!("Failed to reorder profiles in project: {}", e),
                project_id: Some(req.project_id),
            })
    }

    /// Gets the Project that a specific profile belongs to.
    pub fn get_project_for_profile(&self, profile_id: &str) -> Result<Option<Project>, ProjectError> {
        self.repository
            .get_project_for_profile(profile_id)
            .map_err(|e| ProjectError {
                code: ProjectErrorCode::DatabaseError,
                message: format!("Failed to find project for profile {}: {}", profile_id, e),
                project_id: None,
            })
    }

    /// Deterministically calculates project runtime status from child profile statuses
    /// and any active project-level operation.
    pub fn calculate_project_status(
        child_statuses: &[ProfileRuntimeStatus],
        active_operation_type: Option<&str>,
    ) -> ProjectRuntimeStatus {
        // Precedence 1: Active in-flight operation
        if let Some(op_type) = active_operation_type {
            match op_type {
                "start" | "restart" => return ProjectRuntimeStatus::Starting,
                "stop" => return ProjectRuntimeStatus::Stopping,
                _ => {}
            }
        }

        // Precedence 2: Empty project
        if child_statuses.is_empty() {
            return ProjectRuntimeStatus::Stopped;
        }

        let mut has_error = false;
        let mut has_running = false;
        let mut has_stopped = false;
        let mut has_starting = false;

        for status in child_statuses {
            match status {
                ProfileRuntimeStatus::Error => has_error = true,
                ProfileRuntimeStatus::Running => has_running = true,
                ProfileRuntimeStatus::Stopped => has_stopped = true,
                ProfileRuntimeStatus::Starting => has_starting = true,
            }
        }

        // Precedence 3: Any child in Starting state
        if has_starting {
            return ProjectRuntimeStatus::Starting;
        }

        // Precedence 4: Any child in Error state
        if has_error {
            return ProjectRuntimeStatus::Error;
        }

        // Precedence 5: All Running
        if has_running && !has_stopped {
            return ProjectRuntimeStatus::Running;
        }

        // Precedence 6: All Stopped
        if has_stopped && !has_running {
            return ProjectRuntimeStatus::Stopped;
        }

        // Precedence 7: Mixed Running and Stopped
        if has_running && has_stopped {
            return ProjectRuntimeStatus::Partial;
        }

        ProjectRuntimeStatus::Unknown
    }

    /// Derives rich presentation view models for all projects by joining persistent
    /// project-profile relationships with live `ServerProfileView` runtime snapshots.
    pub fn derive_project_views(
        &self,
        projects: &[Project],
        profile_views: &[ServerProfileView],
        active_operations: &HashMap<String, ProjectOperation>,
    ) -> Result<Vec<ProjectView>, ProjectError> {
        // Map profile_id -> ServerProfileView
        let view_map: HashMap<&str, &ServerProfileView> = profile_views
            .iter()
            .map(|pv| (pv.profile.id.as_str(), pv))
            .collect();

        let mut project_views = Vec::with_capacity(projects.len());

        for project in projects {
            let member_tuples = self
                .repository
                .get_project_profiles(&project.id)
                .map_err(|e| ProjectError {
                    code: ProjectErrorCode::DatabaseError,
                    message: format!("Failed to get project profiles for '{}': {}", project.id, e),
                    project_id: Some(project.id.clone()),
                })?;

            let mut project_profile_views = Vec::with_capacity(member_tuples.len());
            let mut child_statuses = Vec::with_capacity(member_tuples.len());
            let mut running_count = 0;
            let mut stopped_count = 0;

            for (profile, order_idx) in member_tuples {
                let (status, pid, port, err) = match view_map.get(profile.id.as_str()) {
                    Some(pv) => {
                        if pv.status == ProfileRuntimeStatus::Running {
                            running_count += 1;
                        } else if pv.status == ProfileRuntimeStatus::Stopped {
                            stopped_count += 1;
                        }
                        (
                            pv.status.clone(),
                            pv.active_pid,
                            pv.active_port,
                            pv.error_message.clone(),
                        )
                    }
                    None => {
                        stopped_count += 1;
                        (ProfileRuntimeStatus::Stopped, None, None, None)
                    }
                };

                child_statuses.push(status.clone());
                project_profile_views.push(ProjectProfileView {
                    profile,
                    order_index: order_idx,
                    status,
                    active_pid: pid,
                    active_port: port,
                    error_message: err,
                });
            }

            let active_op_type = active_operations
                .get(&project.id)
                .map(|op| op.operation_type.as_str());

            let status = Self::calculate_project_status(&child_statuses, active_op_type);

            project_views.push(ProjectView {
                project: project.clone(),
                status,
                total_services: project_profile_views.len(),
                running_services: running_count,
                stopped_services: stopped_count,
                profiles: project_profile_views,
                diagnostic_message: None,
            });
        }

        Ok(project_views)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::repository::SqliteServerProfileRepository;
    use crate::db::MigrationRunner;
    use crate::models::environment::Environment;
    use crate::models::profile::ServerProfile;
    use rusqlite::Connection;
    use std::sync::Mutex;

    fn setup_test_project_service() -> (ProjectService, Arc<SqliteServerProfileRepository>) {
        let mut conn = Connection::open_in_memory().unwrap();
        MigrationRunner::run_migrations(&mut conn).unwrap();
        let repo = Arc::new(SqliteServerProfileRepository::new(Arc::new(Mutex::new(conn))));
        let service = ProjectService::new(repo.clone());
        (service, repo)
    }

    #[test]
    fn test_project_validation_rules() {
        let (service, _) = setup_test_project_service();

        let req_empty = CreateProjectRequest {
            name: "   ".to_string(),
            description: None,
        };
        let err = service.create_project(req_empty).unwrap_err();
        assert_eq!(err.code, ProjectErrorCode::InvalidProject);
    }

    #[test]
    fn test_calculate_project_status_precedence() {
        // All stopped
        assert_eq!(
            ProjectService::calculate_project_status(
                &[ProfileRuntimeStatus::Stopped, ProfileRuntimeStatus::Stopped],
                None
            ),
            ProjectRuntimeStatus::Stopped
        );

        // All running
        assert_eq!(
            ProjectService::calculate_project_status(
                &[ProfileRuntimeStatus::Running, ProfileRuntimeStatus::Running],
                None
            ),
            ProjectRuntimeStatus::Running
        );

        // Partial
        assert_eq!(
            ProjectService::calculate_project_status(
                &[ProfileRuntimeStatus::Running, ProfileRuntimeStatus::Stopped],
                None
            ),
            ProjectRuntimeStatus::Partial
        );

        // Error takes precedence over running + stopped
        assert_eq!(
            ProjectService::calculate_project_status(
                &[
                    ProfileRuntimeStatus::Running,
                    ProfileRuntimeStatus::Error,
                    ProfileRuntimeStatus::Stopped
                ],
                None
            ),
            ProjectRuntimeStatus::Error
        );

        // Active start operation takes highest precedence
        assert_eq!(
            ProjectService::calculate_project_status(
                &[ProfileRuntimeStatus::Stopped, ProfileRuntimeStatus::Stopped],
                Some("start")
            ),
            ProjectRuntimeStatus::Starting
        );

        // Active stop operation takes highest precedence
        assert_eq!(
            ProjectService::calculate_project_status(
                &[ProfileRuntimeStatus::Running, ProfileRuntimeStatus::Running],
                Some("stop")
            ),
            ProjectRuntimeStatus::Stopping
        );

        // Empty profiles -> Stopped
        assert_eq!(
            ProjectService::calculate_project_status(&[], None),
            ProjectRuntimeStatus::Stopped
        );
    }

    #[test]
    fn test_project_service_views_assembly() {
        let (service, repo) = setup_test_project_service();

        // Create project
        let project = service
            .create_project(CreateProjectRequest {
                name: "Company Microservices".to_string(),
                description: Some("Core API + UI".to_string()),
            })
            .unwrap();

        // Create profiles in repo
        let p1 = ServerProfile {
            id: "prof-frontend".to_string(),
            name: "Frontend".to_string(),
            description: None,
            environment: Environment::windows(),
            working_directory: "C:\\frontend".to_string(),
            command: "npm run dev".to_string(),
            expected_port: Some(3000),
            expected_host: None,
            enabled: true,
            created_at: "2026-08-22T20:00:00Z".to_string(),
            updated_at: "2026-08-22T20:00:00Z".to_string(),
        };
        let p2 = ServerProfile {
            id: "prof-backend".to_string(),
            name: "Backend".to_string(),
            description: None,
            environment: Environment::wsl("Fedora"),
            working_directory: "/home/api".to_string(),
            command: "cargo run".to_string(),
            expected_port: Some(5000),
            expected_host: None,
            enabled: true,
            created_at: "2026-08-22T20:00:00Z".to_string(),
            updated_at: "2026-08-22T20:00:00Z".to_string(),
        };
        use crate::db::ServerProfileRepository;
        repo.create(&p1).unwrap();
        repo.create(&p2).unwrap();

        // Add to project
        service
            .add_profile_to_project(AddProfileToProjectRequest {
                project_id: project.id.clone(),
                profile_id: "prof-backend".to_string(),
                order_index: None,
            })
            .unwrap();
        service
            .add_profile_to_project(AddProfileToProjectRequest {
                project_id: project.id.clone(),
                profile_id: "prof-frontend".to_string(),
                order_index: None,
            })
            .unwrap();

        // Mock profile views (Backend running on port 5000, Frontend stopped)
        let profile_views = vec![
            ServerProfileView {
                profile: p2.clone(),
                status: ProfileRuntimeStatus::Running,
                active_pid: Some(421),
                active_port: Some(5000),
                error_message: None,
                last_started_at: None,
                dashboard_server_id: Some("wsl-Fedora-421-5000".to_string()),
            },
            ServerProfileView {
                profile: p1.clone(),
                status: ProfileRuntimeStatus::Stopped,
                active_pid: None,
                active_port: None,
                error_message: None,
                last_started_at: None,
                dashboard_server_id: None,
            },
        ];

        let project_views = service
            .derive_project_views(&[project], &profile_views, &HashMap::new())
            .unwrap();

        assert_eq!(project_views.len(), 1);
        let pv = &project_views[0];
        assert_eq!(pv.project.name, "Company Microservices");
        assert_eq!(pv.status, ProjectRuntimeStatus::Partial);
        assert_eq!(pv.total_services, 2);
        assert_eq!(pv.running_services, 1);
        assert_eq!(pv.stopped_services, 1);
        assert_eq!(pv.profiles.len(), 2);
        assert_eq!(pv.profiles[0].profile.id, "prof-backend");
        assert_eq!(pv.profiles[0].status, ProfileRuntimeStatus::Running);
        assert_eq!(pv.profiles[1].profile.id, "prof-frontend");
        assert_eq!(pv.profiles[1].status, ProfileRuntimeStatus::Stopped);
    }
}
