import { invoke } from '@tauri-apps/api/core';
import type {
  SystemInfo,
  SystemDiagnostics,
  ProcessInfo,
  PortInfo,
  ProcessIdentity,
  ProcessTarget,
  ControlResult,
  WslDistribution,
  UnifiedSnapshot,
  ServerProfile,
  ServerProfileView,
  CreateProfileRequest,
  UpdateProfileRequest,
  StartProfileResult,
  Environment,
  DuplicateProfileResult,
  Project,
  ProjectView,
  CreateProjectRequest,
  UpdateProjectRequest,
  AddProfileToProjectRequest,
  ReorderProjectProfilesRequest,
  ProjectOperationResult,
  DirectoryListing,
  PathValidationResult,
} from '../types';

export async function getSystemInfo(): Promise<SystemInfo> {
  return invoke<SystemInfo>('get_system_info');
}

export async function getDiagnostics(): Promise<SystemDiagnostics> {
  return invoke<SystemDiagnostics>('get_diagnostics');
}

export async function getProcesses(): Promise<ProcessInfo[]> {
  return invoke<ProcessInfo[]>('get_processes');
}

export async function getListeningPorts(): Promise<PortInfo[]> {
  return invoke<PortInfo[]>('get_listening_ports');
}

export async function getProcessIdentities(): Promise<ProcessIdentity[]> {
  return invoke<ProcessIdentity[]>('get_process_identities');
}

export async function getProcessIdentity(pid: number): Promise<ProcessIdentity | null> {
  return invoke<ProcessIdentity | null>('get_process_identity', { pid });
}

export async function stopServer(target: ProcessTarget): Promise<ControlResult> {
  return invoke<ControlResult>('stop_server', { target });
}

export async function forceStopServer(target: ProcessTarget): Promise<ControlResult> {
  return invoke<ControlResult>('force_stop_server', { target });
}

export async function getWslDistributions(): Promise<WslDistribution[]> {
  return invoke<WslDistribution[]>('get_wsl_distributions');
}

export async function getUnifiedSnapshot(): Promise<UnifiedSnapshot> {
  return invoke<UnifiedSnapshot>('get_unified_snapshot');
}

export async function getServerProfiles(): Promise<ServerProfile[]> {
  return invoke<ServerProfile[]>('get_server_profiles');
}

export async function getServerProfile(id: string): Promise<ServerProfile | null> {
  return invoke<ServerProfile | null>('get_server_profile', { id });
}

export async function createServerProfile(request: CreateProfileRequest): Promise<ServerProfile> {
  return invoke<ServerProfile>('create_server_profile', { request });
}

export async function updateServerProfile(request: UpdateProfileRequest): Promise<ServerProfile> {
  return invoke<ServerProfile>('update_server_profile', { request });
}

export async function deleteServerProfile(id: string): Promise<boolean> {
  return invoke<boolean>('delete_server_profile', { id });
}

export async function getServerProfilesWithStatus(): Promise<ServerProfileView[]> {
  return invoke<ServerProfileView[]>('get_server_profiles_with_status');
}

export async function startServerProfile(id: string): Promise<StartProfileResult> {
  return invoke<StartProfileResult>('start_server_profile', { id });
}

export async function restartServerProfile(id: string): Promise<StartProfileResult> {
  return invoke<StartProfileResult>('restart_server_profile', { id });
}

/**
 * Finds saved profiles that would be potential duplicates of the proposed adoption.
 * Advisory only — does not prevent profile creation.
 */
export async function findDuplicateServerProfiles(
  environment: Environment,
  workingDirectory: string,
  command: string,
  expectedPort?: number | null
): Promise<DuplicateProfileResult> {
  const duplicates = await invoke<ServerProfile[]>('find_duplicate_server_profiles', {
    environment,
    workingDirectory,
    command,
    expectedPort: expectedPort ?? null,
  });
  return { hasDuplicates: duplicates.length > 0, duplicates };
}

// Project API commands
export async function getProjects(): Promise<Project[]> {
  return invoke<Project[]>('get_projects');
}

export async function getProject(id: string): Promise<Project | null> {
  return invoke<Project | null>('get_project', { id });
}

export async function createProject(request: CreateProjectRequest): Promise<Project> {
  return invoke<Project>('create_project', { request });
}

export async function updateProject(request: UpdateProjectRequest): Promise<Project> {
  return invoke<Project>('update_project', { request });
}

export async function deleteProject(id: string): Promise<boolean> {
  return invoke<boolean>('delete_project', { id });
}

export async function addProfileToProject(request: AddProfileToProjectRequest): Promise<void> {
  return invoke<void>('add_profile_to_project', { request });
}

export async function removeProfileFromProject(projectId: string, profileId: string): Promise<boolean> {
  return invoke<boolean>('remove_profile_from_project', { projectId, profileId });
}

export async function reorderProjectProfiles(request: ReorderProjectProfilesRequest): Promise<void> {
  return invoke<void>('reorder_project_profiles', { request });
}

export async function getProjectForProfile(profileId: string): Promise<Project | null> {
  return invoke<Project | null>('get_project_for_profile', { profileId });
}

export async function getProjectViews(): Promise<ProjectView[]> {
  return invoke<ProjectView[]>('get_project_views');
}

export async function startProject(id: string): Promise<ProjectOperationResult> {
  return invoke<ProjectOperationResult>('start_project', { id });
}

export async function stopProject(id: string): Promise<ProjectOperationResult> {
  return invoke<ProjectOperationResult>('stop_project', { id });
}

export async function restartProject(id: string): Promise<ProjectOperationResult> {
  return invoke<ProjectOperationResult>('restart_project', { id });
}

// Filesystem & Folder Picker API commands
export async function pickFolder(defaultPath?: string): Promise<string | null> {
  return invoke<string | null>('pick_folder', { defaultPath: defaultPath || null });
}

export async function listWslDirectories(distro: string, path?: string): Promise<DirectoryListing> {
  return invoke<DirectoryListing>('list_wsl_directories', { distro, path: path || null });
}

export async function validateDirectory(
  environment: Environment,
  path: string
): Promise<PathValidationResult> {
  return invoke<PathValidationResult>('validate_directory', { environment, path });
}

export const processApi = {
  getProcesses,
};

export const portApi = {
  getListeningPorts,
};

export const identityApi = {
  getProcessIdentities,
  getProcessIdentity,
};

export const controlApi = {
  stopServer,
  forceStopServer,
};

export const systemApi = {
  getSystemInfo,
  getDiagnostics,
};

export const wslApi = {
  getWslDistributions,
};

export const unifiedApi = {
  getUnifiedSnapshot,
};

export const profileApi = {
  getProfiles: getServerProfiles,
  getProfile: getServerProfile,
  createProfile: createServerProfile,
  updateProfile: updateServerProfile,
  deleteProfile: deleteServerProfile,
  getProfilesWithStatus: getServerProfilesWithStatus,
  startProfile: startServerProfile,
  restartProfile: restartServerProfile,
  findDuplicates: findDuplicateServerProfiles,
};

export const projectApi = {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  addProfileToProject,
  removeProfileFromProject,
  reorderProjectProfiles,
  getProjectForProfile,
  getProjectViews,
  startProject,
  stopProject,
  restartProject,
};

// Log API commands & Events
export async function getServiceLogs(profileId: string): Promise<import('../types').LogSessionView> {
  return invoke<import('../types').LogSessionView>('get_service_logs', { profileId });
}

export async function clearServiceLogs(profileId: string): Promise<boolean> {
  return invoke<boolean>('clear_service_logs', { profileId });
}

export async function subscribeToServiceLogs(
  callback: (event: import('../types').LogUpdateEvent) => void
): Promise<() => void> {
  try {
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen<import('../types').LogUpdateEvent>('service-log-updated', (e) => {
      callback(e.payload);
    });
    return unlisten;
  } catch {
    // Graceful degradation when running in mock/test browser environment without Tauri core
    return () => {};
  }
}

export const logApi = {
  getServiceLogs,
  clearServiceLogs,
  subscribeToServiceLogs,
};

export const filesystemApi = {
  pickFolder,
  listWslDirectories,
  browseWslDirectory: listWslDirectories,
  validateDirectory,
};




