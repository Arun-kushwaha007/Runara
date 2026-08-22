import type { Environment } from './environment';
import type { RemainingOwnerInfo } from './control';

export type ProfileRuntimeStatus = 'stopped' | 'starting' | 'running' | 'error';

/**
 * Persistent configuration describing how to execute and identify a development server.
 * Stored in SQLite and retains its unique persistent UUID across restarts.
 */
export interface ServerProfile {
  id: string;
  name: string;
  description?: string | null;
  environment: Environment;
  workingDirectory: string;
  command: string;
  expectedPort?: number | null;
  expectedHost?: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProfileRequest {
  name: string;
  description?: string | null;
  environment: Environment;
  workingDirectory: string;
  command: string;
  expectedPort?: number | null;
  expectedHost?: string | null;
}

export interface UpdateProfileRequest {
  id: string;
  name: string;
  description?: string | null;
  environment: Environment;
  workingDirectory: string;
  command: string;
  expectedPort?: number | null;
  expectedHost?: string | null;
  enabled?: boolean | null;
}

/**
 * Presentation view model pairing a persistent ServerProfile with its live derived runtime status.
 */
export interface ServerProfileView {
  profile: ServerProfile;
  status: ProfileRuntimeStatus;
  activePid?: number | null;
  activePort?: number | null;
  errorMessage?: string | null;
  lastStartedAt?: string | null;
  dashboardServerId?: string | null;
}

export interface StartProfileResult {
  profileId: string;
  status: ProfileRuntimeStatus;
  pid?: number | null;
  port?: number | null;
  message: string;
}

export interface StartError {
  code: string;
  message: string;
  profileId?: string | null;
  currentOwner?: RemainingOwnerInfo | null;
}
