import { invoke } from '@tauri-apps/api/core';
import type { SystemInfo } from '../types';

export async function getSystemInfo(): Promise<SystemInfo> {
  return invoke<SystemInfo>('get_system_info');
}
