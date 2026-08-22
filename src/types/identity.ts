import type { ProcessInfo } from './process';
import type { Environment } from './environment';

export type Runtime =
  | 'Node.js'
  | 'Python'
  | 'Java'
  | '.NET'
  | 'Go'
  | 'Rust'
  | 'Unknown';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'Unknown';

export interface ProcessParentInfo {
  pid: number;
  name: string;
  commandLine?: string | null;
}

export interface ProcessTreeNode {
  pid: number;
  name: string;
  commandLine?: string | null;
  isTarget: boolean;
  depth: number;
}

export interface ProcessIdentity {
  process: ProcessInfo;
  runtime: Runtime;
  packageManager: PackageManager;
  parent?: ProcessParentInfo | null;
  processTree: ProcessTreeNode[];
  listeningPorts: number[];
  environment: Environment;
}

