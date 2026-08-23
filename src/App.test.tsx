import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { systemApi, profileApi, projectApi, unifiedApi } from './lib/commands';

vi.mock('./lib/commands', () => ({
  systemApi: {
    getSystemInfo: vi.fn(),
    getDiagnostics: vi.fn(),
  },
  profileApi: {
    getProfilesWithStatus: vi.fn(),
    getProfiles: vi.fn(),
  },
  projectApi: {
    getProjectViews: vi.fn(),
    getProjects: vi.fn(),
  },
  unifiedApi: {
    getUnifiedSnapshot: vi.fn(),
  },
  wslApi: {
    getWslDistributions: vi.fn(),
  },
  controlApi: {
    stopServer: vi.fn(),
    forceStopServer: vi.fn(),
  },
  portsApi: {
    getListeningPorts: vi.fn(),
  },
  processesApi: {
    getProcesses: vi.fn(),
  },
}));

describe('App Root Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially while checking backend health', () => {
    vi.mocked(systemApi.getSystemInfo).mockReturnValue(new Promise(() => {}));

    render(<App />);

    expect(screen.getByText('Initializing Runara')).toBeInTheDocument();
    expect(
      screen.getByText(/Loading local SQLite database, establishing IPC bridges/i)
    ).toBeInTheDocument();
  });

  it('renders dashboard after successful initialization', async () => {
    vi.mocked(systemApi.getSystemInfo).mockResolvedValue({
      app: 'Runara',
      version: '0.1.0',
      backend: 'rust',
      status: 'ok',
      platform: 'windows',
    });
    vi.mocked(unifiedApi.getUnifiedSnapshot).mockResolvedValue({
      processes: [],
      ports: [],
      identities: [],
      distributions: [],
      diagnostics: [],
    });
    vi.mocked(profileApi.getProfilesWithStatus).mockResolvedValue([]);
    vi.mocked(projectApi.getProjectViews).mockResolvedValue([]);

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByText('Initializing Runara')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Local Development Control Center')).toBeInTheDocument();
  });

  it('renders fatal error screen with Retry and Exit buttons when initialization fails', async () => {
    vi.mocked(systemApi.getSystemInfo).mockRejectedValue(
      new Error('Failed to open SQLite database: disk I/O error')
    );

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByText('Runara could not initialize local storage')
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText('Unable to safely load your profiles and projects.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Failed to open SQLite database: disk I\/O error/)
    ).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /^Retry$/i });
    const exitButton = screen.getByRole('button', { name: /^Exit$/i });

    expect(retryButton).toBeInTheDocument();
    expect(exitButton).toBeInTheDocument();
  });

  it('retries initialization when Retry button is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(systemApi.getSystemInfo)
      .mockRejectedValueOnce(new Error('Temporary lock failure'))
      .mockResolvedValueOnce({
        app: 'Runara',
        version: '0.1.0',
        backend: 'rust',
        status: 'ok',
        platform: 'windows',
      });
    vi.mocked(unifiedApi.getUnifiedSnapshot).mockResolvedValue({
      processes: [],
      ports: [],
      identities: [],
      distributions: [],
      diagnostics: [],
    });
    vi.mocked(profileApi.getProfilesWithStatus).mockResolvedValue([]);
    vi.mocked(projectApi.getProjectViews).mockResolvedValue([]);

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByText('Runara could not initialize local storage')
      ).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: /^Retry$/i });
    await user.click(retryButton);

    await waitFor(() => {
      expect(
        screen.queryByText('Runara could not initialize local storage')
      ).not.toBeInTheDocument();
      expect(screen.getByText('Local Development Control Center')).toBeInTheDocument();
    });
  });
});
