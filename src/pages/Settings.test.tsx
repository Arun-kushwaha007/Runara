import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Settings from './Settings';
import { ThemeProvider } from '../context/ThemeContext';
import { systemApi } from '../lib/commands';
import type { SystemDiagnostics, SystemInfo } from '../types';

vi.mock('../lib/commands', () => ({
  systemApi: {
    getDiagnostics: vi.fn(),
    getSystemInfo: vi.fn(),
  },
}));

const mockDiagnostics: SystemDiagnostics = {
  appName: 'Runara',
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
  app: 'Runara',
  version: '0.1.0',
  backend: 'rust',
  status: 'ok',
  platform: 'windows',
};

const renderWithTheme = () => {
  return render(
    <ThemeProvider>
      <Settings />
    </ThemeProvider>
  );
};

describe('Settings & Appearance Page (Milestones 10 & 14)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(systemApi.getDiagnostics).mockResolvedValue(mockDiagnostics);
    vi.mocked(systemApi.getSystemInfo).mockResolvedValue(mockSystemInfo);

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList));
  });

  it('renders system diagnostics, host environment data, and appearance settings', async () => {
    renderWithTheme();

    expect(screen.getByText('Settings & Diagnostics')).toBeInTheDocument();
    expect(screen.getByText('Appearance & Theme')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Host Environment/i)).toBeInTheDocument();
      expect(screen.getByText(/SQLite 3 \(Bundled C Engine\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Ubuntu/i)).toBeInTheDocument();
      expect(screen.getByText(/Debian/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Runara MVP Release (v0.1.0)')).toBeInTheDocument();
  });

  it('allows user to switch between Dark, Light, and System theme preferences', async () => {
    const user = userEvent.setup();
    renderWithTheme();

    // Verify Theme Selector Options
    const darkRadio = screen.getByRole('radio', { name: /Dark Mode/i });
    const lightRadio = screen.getByRole('radio', { name: /Light Mode/i });
    const systemRadio = screen.getByRole('radio', { name: /System Sync/i });

    expect(darkRadio).toBeInTheDocument();
    expect(lightRadio).toBeInTheDocument();
    expect(systemRadio).toBeInTheDocument();

    // Default should be dark
    expect(darkRadio).toHaveAttribute('aria-checked', 'true');

    // Switch to Light
    await user.click(lightRadio);
    expect(lightRadio).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    // Switch to System
    await user.click(systemRadio);
    expect(systemRadio).toHaveAttribute('aria-checked', 'true');

    // Click Reset Defaults
    const resetButton = screen.getByRole('button', { name: /Reset Defaults/i });
    await user.click(resetButton);
    expect(darkRadio).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('renders live Theme Preview box displaying active semantic tokens', () => {
    renderWithTheme();

    expect(screen.getByText('Theme Preview:')).toBeInTheDocument();
    expect(screen.getByText('Runara Control Center')).toBeInTheDocument();
    expect(screen.getByText('company-api')).toBeInTheDocument();
    expect(screen.getByText(':5000')).toBeInTheDocument();
    expect(screen.getByText('PID 14920')).toBeInTheDocument();
  });
});
