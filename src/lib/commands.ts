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


