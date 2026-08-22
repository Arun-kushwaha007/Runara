import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Servers from './Servers';
import { profileApi, unifiedApi, wslApi } from '../lib/commands';
import type {
  ServerProfileView,
  StartProfileResult,
  StartError,
  UnifiedSnapshot,
  WslDistribution,
} from '../types';

// Mock command APIs
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
  { name: 'Fedora', state: 'stopped', isDefault: false, version: 2 },
];

const mockProfileViews: ServerProfileView[] = [
  {
    profile: {
      id: 'prof-1',
      name: 'Company Frontend',
      description: 'Main React application',
      environment: { type: 'windows' },
      workingDirectory: 'C:\\Projects\\company-frontend',
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
      name: 'Python API Server',
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
  {
    profile: {
      id: 'prof-3',
      name: 'WSL Microservice',
      description: 'Express microservice running in Ubuntu',
      environment: { type: 'wsl', distro: 'Ubuntu' },
      workingDirectory: '/home/dev/microservice',
      command: 'npm start',
      expectedPort: 5000,
      expectedHost: '0.0.0.0',
      enabled: true,
      createdAt: '2026-08-22T10:00:00Z',
      updatedAt: '2026-08-22T10:00:00Z',
    },
    status: 'running',
    activePid: 421,
    activePort: 5000,
    errorMessage: null,
    lastStartedAt: '2026-08-22T10:00:00Z',
    dashboardServerId: 'wsl-Ubuntu-421',
  },
];


const mockSnapshot: UnifiedSnapshot = {
  processes: [
    {
      pid: 18240,
      parentPid: 17820,
      name: 'node.exe',
      executablePath: 'C:\\Program Files\\nodejs\\node.exe',
      commandLine: 'npm run dev',
      workingDirectory: 'C:\\Projects\\company-frontend',
      status: 'running',
      environment: { type: 'windows' },
    },
    {
      pid: 421,
      parentPid: 300,
      name: 'node',
      executablePath: '/usr/bin/node',
      commandLine: 'npm start',
      workingDirectory: '/home/dev/microservice',
      status: 'running',
      environment: { type: 'wsl', distro: 'Ubuntu' },
    },
  ],
  ports: [
    {
      port: 3000,
      pid: 18240,
      protocol: 'tcp',
      address: '127.0.0.1',
      state: 'listening',
      environment: { type: 'windows' },
    },
    {
      port: 5000,
      pid: 421,
      protocol: 'tcp',
      address: '0.0.0.0',
      state: 'listening',
      environment: { type: 'wsl', distro: 'Ubuntu' },
    },
  ],
  identities: [],
  distributions: mockWslDistros,
  diagnostics: [],
};

describe('Servers & Profiles Management (Milestone 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(profileApi.getProfilesWithStatus).mockResolvedValue(mockProfileViews);
    vi.mocked(unifiedApi.getUnifiedSnapshot).mockResolvedValue(mockSnapshot);
    vi.mocked(wslApi.getWslDistributions).mockResolvedValue(mockWslDistros);
  });

  it('renders Server Profiles list with correct environment badges and status indicators', async () => {
    render(<Servers />);

    expect(screen.getByText(/Development Server Management/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Company Frontend')).toBeInTheDocument();
      expect(screen.getByText('Python API Server')).toBeInTheDocument();
      expect(screen.getByText('WSL Microservice')).toBeInTheDocument();
    });

    // Verify badges
    expect(screen.getAllByText('Windows').length).toBeGreaterThan(0);
    expect(screen.getByText('WSL / Ubuntu')).toBeInTheDocument();
    expect(screen.getAllByText('Running').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Stopped')).toBeInTheDocument();
    expect(screen.getByText(':3000')).toBeInTheDocument();
    expect(screen.getByText(':8000')).toBeInTheDocument();
    expect(screen.getByText(':5000')).toBeInTheDocument();
  });

  it('filters profile cards by search query', async () => {
    render(<Servers />);

    await waitFor(() => {
      expect(screen.getByText('Company Frontend')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search servers/i);
    fireEvent.change(searchInput, { target: { value: '8000' } });

    expect(screen.getByText('Python API Server')).toBeInTheDocument();
    expect(screen.queryByText('Company Frontend')).not.toBeInTheDocument();
    expect(screen.queryByText('WSL Microservice')).not.toBeInTheDocument();
  });

  it('executes profile start sequence successfully', async () => {
    const startResult: StartProfileResult = {
      profileId: 'prof-2',
      status: 'running',
      pid: 24500,
      port: 8000,
      message: "Server 'Python API Server' started successfully and is listening on port 8000.",
    };
    vi.mocked(profileApi.startProfile).mockResolvedValue(startResult);

    render(<Servers />);

    await waitFor(() => {
      expect(screen.getByText('Python API Server')).toBeInTheDocument();
    });

    const startButtons = screen.getAllByRole('button', { name: /^Start$/i });
    expect(startButtons.length).toBeGreaterThan(0);
    fireEvent.click(startButtons[0]);

    await waitFor(() => {
      expect(profileApi.startProfile).toHaveBeenCalledWith('prof-2');
      expect(screen.getByText(/started successfully and is listening on port 8000/i)).toBeInTheDocument();
    });
  });

  it('displays Port Conflict Modal when starting a profile on an occupied port without killing owner', async () => {
    const conflictError: StartError = {
      code: 'PORT_ALREADY_IN_USE',
      message: 'Port 8000 is already in use by python.exe (PID 9999). Stop the existing process before starting this profile.',
      profileId: 'prof-2',
      currentOwner: {
        pid: 9999,
        processName: 'python.exe',
        port: 8000,
      },
    };
    vi.mocked(profileApi.startProfile).mockRejectedValue(conflictError);


    render(<Servers />);

    await waitFor(() => {
      expect(screen.getByText('Python API Server')).toBeInTheDocument();
    });

    const startButtons = screen.getAllByRole('button', { name: /^Start$/i });
    fireEvent.click(startButtons[0]);

    await waitFor(() => {
      expect(profileApi.startProfile).toHaveBeenCalledWith('prof-2');
    });

    await waitFor(() => {
      expect(screen.getByText(/Port Conflict Detected/i)).toBeInTheDocument();
      expect(screen.getByText(/The expected port is already occupied by another process/i)).toBeInTheDocument();
      expect(screen.getAllByText(/9999/).length).toBeGreaterThan(0);
    });



    // Close conflict modal
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(screen.queryByText(/Port Conflict Detected/i)).not.toBeInTheDocument();
  });

  it('opens Create Profile modal, validates input, and creates profile', async () => {
    vi.mocked(profileApi.createProfile).mockResolvedValue({
      id: 'prof-new',
      name: 'New Node App',
      description: 'Sample App',
      environment: { type: 'windows' },
      workingDirectory: 'C:\\Projects\\new-app',
      command: 'npm start',
      expectedPort: 4000,
      expectedHost: 'localhost',
      enabled: true,
      createdAt: '2026-08-22T12:00:00Z',
      updatedAt: '2026-08-22T12:00:00Z',
    });


    render(<Servers />);

    await waitFor(() => {
      expect(screen.getByText('Company Frontend')).toBeInTheDocument();
    });

    const addProfileBtn = screen.getByRole('button', { name: /Add Server Profile/i });
    fireEvent.click(addProfileBtn);

    expect(screen.getByText(/Create Server Profile/i)).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/e\.g\. Company Frontend/i);
    const cwdInput = screen.getByPlaceholderText(/C:\\Projects\\my-project/i);
    const cmdInput = screen.getByPlaceholderText(/npm run dev/i);
    const portInput = screen.getByLabelText(/Expected Port/i);

    fireEvent.change(nameInput, { target: { value: 'New Node App' } });
    fireEvent.change(cwdInput, { target: { value: 'C:\\Projects\\new-app' } });
    fireEvent.change(cmdInput, { target: { value: 'npm start' } });
    fireEvent.change(portInput, { target: { value: '4000' } });


    const submitBtn = screen.getByRole('button', { name: /Create Profile/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(profileApi.createProfile).toHaveBeenCalledWith({
        name: 'New Node App',
        description: null,
        environment: { type: 'windows' },
        workingDirectory: 'C:\\Projects\\new-app',
        command: 'npm start',
        expectedPort: 4000,
        expectedHost: null,
      });
      expect(screen.getByText(/created successfully/i)).toBeInTheDocument();
    });
  });

  it('shows warning in Delete Modal when deleting a running profile without terminating process', async () => {
    vi.mocked(profileApi.deleteProfile).mockResolvedValue(true);

    render(<Servers />);

    await waitFor(() => {
      expect(screen.getByText('Company Frontend')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle(/Delete Profile/i);
    fireEvent.click(deleteButtons[0]);

    // Modal should show running warning
    expect(screen.getByText(/Delete Server Profile\?/i)).toBeInTheDocument();
    expect(screen.getByText(/This profile is currently running\./i)).toBeInTheDocument();
    expect(screen.getByText(/remove the saved configuration from SQLite/i)).toBeInTheDocument();

    const deleteModalButtons = screen.getAllByRole('button', { name: /^Delete Profile$/i });
    fireEvent.click(deleteModalButtons[deleteModalButtons.length - 1]);

    await waitFor(() => {
      expect(profileApi.deleteProfile).toHaveBeenCalledWith('prof-1');
      expect(screen.getByText(/Profile "Company Frontend" deleted/i)).toBeInTheDocument();
    });
  });



  it('supports WSL stop & restart controls in Milestone 11', async () => {
    render(<Servers />);

    await waitFor(() => {
      expect(screen.getByText('WSL Microservice')).toBeInTheDocument();
    });

    // WSL Running profile should show enabled Stop and Restart action buttons
    const stopButtons = screen.getAllByRole('button', { name: /^Stop$/i });
    expect(stopButtons.length).toBeGreaterThan(0);

    const restartButtons = screen.getAllByRole('button', { name: /^Restart$/i });
    expect(restartButtons.length).toBeGreaterThan(0);
  });
});
