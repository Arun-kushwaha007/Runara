import type { PortInfo } from './port';
import type { ProcessInfo } from './process';
import type { ProcessIdentity } from './identity';

export type EnvironmentType = 'windows' | 'wsl';

export interface WindowsEnvironment {
  type: 'windows';
}

export interface WslEnvironment {
  type: 'wsl';
  distro: string;
}

export type Environment = WindowsEnvironment | WslEnvironment;

export type WslDistroState = 'running' | 'stopped' | 'unknown' | 'error';

export interface WslDistribution {
  name: string;
  state: WslDistroState;
  isDefault: boolean;
  version: number | null;
}

export interface DiscoveryDiagnostic {
  source: string;
  distribution: string | null;
  operation: string;
  error: string;
  timestampMs: number;
}

export interface EnvironmentInfo {
  environment: Environment;
  status: string;
  serverCount: number;
}

export interface UnifiedSnapshot {
  processes: ProcessInfo[];
  ports: PortInfo[];
  identities: ProcessIdentity[];
  distributions: WslDistribution[];
  diagnostics: DiscoveryDiagnostic[];
}
