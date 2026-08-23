export interface SystemInfo {
  app: string;
  version: string;
  backend: string;
  status: string;
  platform: string;
}

export interface SystemDiagnostics {
  appName: string;
  appVersion: string;
  backend: string;
  platform: string;
  arch: string;
  tauriVersion: string;
  wslAvailable: boolean;
  wslDistributions: import('./environment').WslDistribution[];
  databaseStatus: string;
  databaseSchemaVersion: number;
  profileCount: number;
  projectCount: number;
  activeProcessesCount: number;
  listeningPortsCount: number;
}

export type NavPage = 'dashboard' | 'servers' | 'profiles' | 'projects' | 'settings';

export * from './environment';
export * from './process';
export * from './port';
export * from './identity';
export * from './server';
export * from './control';
export * from './profile';
export * from './adoption';
export * from './project';
export * from './filesystem';
export * from './theme';

