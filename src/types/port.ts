import type { ProcessInfo } from './process';
import type { ProcessIdentity } from './identity';
import type { Environment } from './environment';

export interface PortInfo {
  port: number;
  pid: number;
  protocol: string;
  address: string;
  state: string;
  environment: Environment;
}

export interface JoinedPortProcess {
  port: PortInfo;
  process: ProcessInfo | null;
  identity?: ProcessIdentity | null;
}

