import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Settings from './Settings';
import { systemApi } from '../lib/commands';
import type { SystemDiagnostics, SystemInfo } from '../types';

vi.mock('../lib/commands', () => ({
  systemApi: {
    getDiagnostics: vi.fn(),
    getSystemInfo: vi.fn(),
  },
}));

const mockDiagnostics: SystemDiagnostics = {
  appName: 'DevHub',
  appVersion: '0.1.0',
  backend: 'Rust (Win32 FFI + Native Sockets)',
  platform: 'windows',
  arch: 'x86_64',
  tauriVersion: '2.0',
  wslAvailable: true,
  wslDistributions: [
    { name: 'Ubuntu', state: 'running', isDefault: true, version: 2 },
    { name: 'Debian', state: 'stopped', isDefault: false, version: 2 },
  ],
  databaseStatus: 'Healthy (SQLite WAL Mode)',
  databaseSchemaVersion: 2,
  profileCount: 5,
  projectCount: 2,
  activeProcessesCount: 12,
  listeningPortsCount: 8,
};

const mockSystemInfo: SystemInfo = {
  app: 'DevHub',
  version: '0.1.0',
  backend: 'rust',
  status: 'ok',
  platform: 'windows',
};

describe('Settings & Diagnostics Page (Milestone 10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(systemApi.getDiagnostics).mockResolvedValue(mockDiagnostics);
    vi.mocked(systemApi.getSystemInfo).mockResolvedValue(mockSystemInfo);
  });

  it('renders system diagnostics and host environment data', async () => {
    render(<Settings />);

    expect(screen.getByText('Settings & Diagnostics')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Host Environment/i)).toBeInTheDocument();
      expect(screen.getByText(/SQLite 3 \(Bundled C Engine\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Ubuntu/i)).toBeInTheDocument();
      expect(screen.getByText(/Debian/i)).toBeInTheDocument();
    });

    expect(screen.getByText('DevHub MVP Release (v0.1.0)')).toBeInTheDocument();
  });
});
