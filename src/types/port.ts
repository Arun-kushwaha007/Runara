import type { ProcessInfo } from './process';

export interface PortInfo {
  port: number;
  pid: number;
  protocol: string;
  address: string;
  state: string;
}

export interface JoinedPortProcess {
  port: PortInfo;
  process: ProcessInfo | null;
}
