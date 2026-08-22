import type { Environment } from './environment';

/**
 * Target process information payload sent to backend for process control operations.
 * Encapsulates multiple identity signals to enable fresh pre-termination verification.
 */
export interface ProcessTarget {
  /** Target operating system Process Identifier */
  pid: number;
  /** Expected process image name (e.g. "node.exe", "python.exe") */
  processName: string;
  /** Expected executable binary path on disk */
  executablePath?: string | null;
  /** Expected working directory / project root path */
  workingDirectory?: string | null;
  /** Expected listening TCP ports bound by this process */
  expectedPorts: number[];
  /** Whether to execute immediate force termination */
  force?: boolean;
  /** Target execution environment (Windows or WSL) */
  environment?: Environment | null;
}

/**
 * Lifecycle status returned following a process control attempt.
 */
export type ControlStatus =
  | 'stopped'
  | 'port_still_in_use'
  | 'port_owner_changed'
  | 'already_stopped'
  | 'error';

/**
 * Diagnostic information when an expected port remains bound following process termination.
 */
export interface RemainingOwnerInfo {
  pid: number;
  processName: string;
  port: number;
}

/**
 * Structured outcome of a process control operation.
 */
export interface ControlResult {
  /** Final lifecycle status */
  status: ControlStatus;
  /** Target PID operated on */
  pid: number;
  /** List of ports confirmed released */
  releasedPorts: number[];
  /** Descendant PIDs that could not be terminated (if any) */
  remainingChildren: number[];
  /** Information on any remaining or new port owner */
  remainingOwner: RemainingOwnerInfo | null;
  /** Diagnostic human-readable message */
  message: string;
}

/**
 * Structured error codes from the backend process control service.
 */
export type ProcessControlErrorCode =
  | 'PROCESS_NOT_FOUND'
  | 'PROCESS_IDENTITY_CHANGED'
  | 'PROCESS_ACCESS_DENIED'
  | 'PROCESS_TERMINATION_FAILED'
  | 'DESCENDANT_TERMINATION_FAILED'
  | 'TIMEOUT'
  | 'PORT_STILL_IN_USE'
  | 'PORT_OWNER_CHANGED'
  | 'INVALID_TARGET'
  | 'ALREADY_STOPPED'
  | 'UNSAFE_TARGET'
  | 'UNKNOWN_ERROR';

/**
 * Structured domain error payload returned when a control operation fails.
 */
export interface ProcessControlError {
  code: ProcessControlErrorCode;
  message: string;
  pid?: number | null;
}
