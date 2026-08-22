import type { Environment } from './environment';

export type ProcessStatus = 'running' | 'unavailable' | 'accessrestricted' | 'unknown';

export interface ProcessInfo {
  pid: number;
  parentPid?: number | null;
  name: string;
  executablePath?: string | null;
  commandLine?: string | null;
  workingDirectory?: string | null;
  status: ProcessStatus;
  environment: Environment;
}

