import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Profiles from './Profiles';
import { profileApi, unifiedApi, wslApi } from '../lib/commands';
import type { ServerProfileView, StartProfileResult, UnifiedSnapshot, WslDistribution } from '../types';

vi.mock('../lib/commands', () => ({
  profileApi: {
    getProfilesWithStatus: vi.fn(),
    getProfiles: vi.fn(),
    getProfile: vi.fn(),
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
    deleteProfile: vi.fn(),
    startProfile: vi.fn(),
    restartProfile: vi.fn(),
  },
  unifiedApi: {
    getUnifiedSnapshot: vi.fn(),
  },
  controlApi: {
    stopServer: vi.fn(),
    forceStopServer: vi.fn(),
  },
  wslApi: {
    getWslDistributions: vi.fn(),
  },
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
}));

const mockWslDistros: WslDistribution[] = [
  { name: 'Ubuntu', state: 'running', isDefault: true, version: 2 },
];

const mockProfileViews: ServerProfileView[] = [
  {
    profile: {
      id: 'prof-1',
      name: 'Web Client',
      description: 'Vite Frontend',
      environment: { type: 'windows' },
      workingDirectory: 'C:\\Projects\\web-client',
      command: 'npm run dev',
      expectedPort: 3000,
      expectedHost: '127.0.0.1',
      enabled: true,
      createdAt: '2026-08-22T10:00:00Z',
      updatedAt: '2026-08-22T10:00:00Z',
    },
    status: 'running',
    activePid: 18240,
    activePort: 3000,
    errorMessage: null,
    lastStartedAt: '2026-08-22T10:05:00Z',
    dashboardServerId: 'win-18240',
  },
  {
    profile: {
      id: 'prof-2',
      name: 'Backend API',
      description: 'FastAPI Backend',
      environment: { type: 'windows' },
      workingDirectory: 'C:\\Projects\\api-service',
      command: 'python -m uvicorn main:app --port 8000',
      expectedPort: 8000,
      expectedHost: '0.0.0.0',
      enabled: true,
      createdAt: '2026-08-22T10:00:00Z',
      updatedAt: '2026-08-22T10:00:00Z',
    },
    status: 'stopped',
    activePid: null,
    activePort: null,
    errorMessage: null,
    lastStartedAt: null,
    dashboardServerId: null,
  },
];

const mockSnapshot: UnifiedSnapshot = {
  processes: [],
  ports: [],
  identities: [],
  distributions: mockWslDistros,
  diagnostics: [],
};

describe('Profiles Page (Milestone 10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(profileApi.getProfilesWithStatus).mockResolvedValue(mockProfileViews);
    vi.mocked(unifiedApi.getUnifiedSnapshot).mockResolvedValue(mockSnapshot);
    vi.mocked(wslApi.getWslDistributions).mockResolvedValue(mockWslDistros);
  });

  it('renders Server Profiles list with metrics and cards', async () => {
    render(<Profiles />);

    expect(screen.getByText('Server Profiles')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Web Client')).toBeInTheDocument();
      expect(screen.getByText('Backend API')).toBeInTheDocument();
    });

    expect(screen.getByText('New Server Profile')).toBeInTheDocument();
  });

  it('filters profiles by search query', async () => {
    render(<Profiles />);

    await waitFor(() => {
      expect(screen.getByText('Web Client')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search profiles/i);
    fireEvent.change(searchInput, { target: { value: 'Backend' } });

    expect(screen.getByText('Backend API')).toBeInTheDocument();
    expect(screen.queryByText('Web Client')).not.toBeInTheDocument();
  });

  it('starts a stopped profile successfully', async () => {
    const startResult: StartProfileResult = {
      profileId: 'prof-2',
      status: 'running',
      pid: 24500,
      port: 8000,
      message: "Server 'Backend API' started successfully.",
    };
    vi.mocked(profileApi.startProfile).mockResolvedValue(startResult);

    render(<Profiles />);

    await waitFor(() => {
      expect(screen.getByText('Backend API')).toBeInTheDocument();
    });

    const startButtons = screen.getAllByRole('button', { name: /^Start$/i });
    expect(startButtons.length).toBeGreaterThan(0);
    fireEvent.click(startButtons[0]);

    await waitFor(() => {
      expect(profileApi.startProfile).toHaveBeenCalledWith('prof-2');
    });
  });
});
