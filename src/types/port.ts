import type { ProcessInfo } from './process';
import type { ProcessIdentity } from './identity';

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
  identity?: ProcessIdentity | null;
}
