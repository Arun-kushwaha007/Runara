import { invoke } from '@tauri-apps/api/core';
import type {
  SystemInfo,
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
} from '../types';

export async function getSystemInfo(): Promise<SystemInfo> {
  return invoke<SystemInfo>('get_system_info');
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



