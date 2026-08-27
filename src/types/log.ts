export type LogStream = 'stdout' | 'stderr';

export type LogSource = 'runara' | 'external';

export type LogSessionStatus = 'running' | 'stopped' | 'error';

export interface LogEntry {
  id: string;
  timestamp: string;
  stream: LogStream;
  text: string;
}

export interface LogSessionView {
  sessionId: string;
  profileId: string;
  status: LogSessionStatus;
  source: LogSource;
  isLiveAvailable: boolean;
  unavailableReason?: string | null;
  startedAt: string;
  totalLines: number;
  entries: LogEntry[];
}

export interface LogUpdateEvent {
  profileId: string;
  sessionId: string;
  status: LogSessionStatus;
  newEntries: LogEntry[];
}
