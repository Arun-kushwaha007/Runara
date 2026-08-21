import { invoke } from '@tauri-apps/api/core';
import type { SystemInfo, ProcessInfo, PortInfo } from '../types';

export async function getSystemInfo(): Promise<SystemInfo> {
  return invoke<SystemInfo>('get_system_info');
}

export async function getProcesses(): Promise<ProcessInfo[]> {
  return invoke<ProcessInfo[]>('get_processes');
}

export async function getListeningPorts(): Promise<PortInfo[]> {
  return invoke<PortInfo[]>('get_listening_ports');
}

export const processApi = {
  getProcesses,
};

export const portApi = {
  getListeningPorts,
};

export const systemApi = {
  getSystemInfo,
};
