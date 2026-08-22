export interface SystemInfo {
  app: string;
  version: string;
  backend: string;
  status: string;
  platform: string;
}

export type NavPage = 'dashboard' | 'servers' | 'projects' | 'settings';

export * from './process';
export * from './port';
export * from './identity';
export * from './server';
export * from './control';

