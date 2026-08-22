import type { ServerProfile, ProfileRuntimeStatus } from './profile';

export type ProjectRuntimeStatus =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'partial'
  | 'stopping'
  | 'error'
  | 'unknown';

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string | null;
}

export interface UpdateProjectRequest {
  id: string;
  name: string;
  description?: string | null;
}

export interface AddProfileToProjectRequest {
  projectId: string;
  profileId: string;
  orderIndex?: number | null;
}

export interface ReorderProjectProfilesRequest {
  projectId: string;
  profileIds: string[];
}

export interface ProjectProfileView {
  profile: ServerProfile;
  orderIndex: number;
  status: ProfileRuntimeStatus;
  activePid?: number | null;
  activePort?: number | null;
  errorMessage?: string | null;
}

export interface ProjectView {
  project: Project;
  status: ProjectRuntimeStatus;
  profiles: ProjectProfileView[];
  totalServices: number;
  runningServices: number;
  stoppedServices: number;
  diagnosticMessage?: string | null;
}

export interface ProjectOperationResult {
  projectId: string;
  operationType: string;
  status: ProjectRuntimeStatus;
  startedProfiles: string[];
  stoppedProfiles: string[];
  failedProfile?: string | null;
  pendingProfiles: string[];
  unsupportedProfiles: string[];
  message: string;
}

export interface ProjectError {
  code: string;
  message: string;
  projectId?: string | null;
}
