import type { Runtime, PackageManager, ProcessParentInfo, ProcessTreeNode } from './identity';
import type { Environment } from './environment';

export type ServerStatus = 'running' | 'unknown' | 'error';

/**
 * Derived view model representing an active local development server endpoint.
 * Combines PortInfo, ProcessInfo, and ProcessIdentity into a polished,
 * developer-facing presentation entity across Windows and WSL environments.
 */
export interface DashboardServer {
  /** Unique composite snapshot identifier (e.g. "win-18240-3000" or "wsl-Ubuntu-421-5000") */
  id: string;
  /** Inferred developer-friendly project or server name (e.g. "company-frontend") */
  name: string;
  /** Server operational status */
  status: ServerStatus;
  /** Primary listening TCP port */
  primaryPort: number;
  /** All listening TCP ports bound by this process */
  allPorts: number[];
  /** Primary bound network address (e.g. "127.0.0.1" or "0.0.0.0") */
  address: string;
  /** Transport layer protocol (e.g. "tcp") */
  protocol: string;
  /** Operating system Process Identifier */
  pid: number;
  /** Executable binary name (e.g. "node.exe", "python.exe", "node") */
  processName: string;
  /** Full executable binary path on disk */
  executablePath: string | null;
  /** Full command line string that launched the process */
  commandLine: string | null;
  /** Working directory (project root) */
  workingDirectory: string | null;
  /** Detected software runtime interpreter */
  runtime: Runtime;
  /** Detected package manager or build tool */
  packageManager: PackageManager;
  /** Direct parent process information */
  parent: ProcessParentInfo | null;
  /** Complete reconstructed process ancestry tree (environment-isolated) */
  processTree: ProcessTreeNode[];
  /** Execution environment (Windows or WSL) */
  environment: Environment;
  /** Formatted display label (e.g. "Windows", "WSL / Ubuntu", "WSL / Fedora") */
  environmentLabel: string;
  /** Optional distribution name for WSL environments */
  wslDistro?: string | null;
}

export type ServerSortField = 'port' | 'pid' | 'name' | 'runtime' | 'environment';

export type ServerSortDirection = 'asc' | 'desc';

export interface ServerFilterOptions {
  environment: string; // 'all' | 'windows' | 'wsl' | 'wsl:<distro>'
  runtime: string; // 'all' | 'Node.js' | 'Python' | etc.
  status: string; // 'all' | 'running' | 'unknown'
}

