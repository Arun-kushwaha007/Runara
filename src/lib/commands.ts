import { invoke } from '@tauri-apps/api/core';
import type { SystemInfo, ProcessInfo } from '../types';

export async function getSystemInfo(): Promise<SystemInfo> {
  return invoke<SystemInfo>('get_system_info');
}

export async function getProcesses(): Promise<ProcessInfo[]> {
  return invoke<ProcessInfo[]>('get_processes');
}

export const processApi = {
  getProcesses,
};

export const systemApi = {
  getSystemInfo,
};
