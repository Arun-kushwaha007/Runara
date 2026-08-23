import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';
import { controlApi, identityApi, portApi, systemApi, unifiedApi, profileApi } from '../lib/commands';
import type { ProcessIdentity, PortInfo, SystemInfo, ControlResult, UnifiedSnapshot } from '../types';

// Mock the API commands module
vi.mock('../lib/commands', () => ({
  identityApi: {
    getProcessIdentities: vi.fn(),
    getProcessIdentity: vi.fn(),
  },
  portApi: {
    getListeningPorts: vi.fn(),
  },
  systemApi: {
    getSystemInfo: vi.fn(),
  },
  controlApi: {
    stopServer: vi.fn(),
    forceStopServer: vi.fn(),
  },
  unifiedApi: {
    getUnifiedSnapshot: vi.fn(),
  },
  wslApi: {
    getWslDistributions: vi.fn(),
  },
  profileApi: {
    getProfiles: vi.fn(),
    getProfilesWithStatus: vi.fn(),
    createProfile: vi.fn(),
    findDuplicates: vi.fn(),
  },
}));

// Mock tauri-plugin-opener
vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
}));

const mockSystemInfo: SystemInfo = {
  app: 'Runara',
  version: '0.1.0',
  backend: 'Rust',
  status: 'Ready',
  platform: 'Windows + WSL',
};

const mockPorts: PortInfo[] = [
  {
    port: 3000,
    pid: 18240,
    protocol: 'tcp',
    address: '127.0.0.1',
    state: 'listening',
    environment: { type: 'windows' },
  },
  {
    port: 3001,
    pid: 18240,
    protocol: 'tcp',
    address: '127.0.0.1',
    state: 'listening',
    environment: { type: 'windows' },
  },
  {
    port: 8000,
    pid: 22096,
    protocol: 'tcp',
    address: '0.0.0.0',
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
];

const mockIdentities: ProcessIdentity[] = [
  {
    process: {
      pid: 18240,
      parentPid: 17820,
      name: 'node.exe',
      executablePath: 'C:\\Program Files\\nodejs\\node.exe',
      commandLine: 'npm run dev',
      workingDirectory: 'C:\\Projects\\company-frontend',
      status: 'running',
      environment: { type: 'windows' },
    },
    runtime: 'Node.js',
    packageManager: 'npm',
    parent: {
      pid: 17820,
      name: 'npm.cmd',
      commandLine: 'npm run dev',
    },
    processTree: [
      { pid: 16300, name: 'Code.exe', commandLine: null, isTarget: false, depth: 0 },
      { pid: 17120, name: 'powershell.exe', commandLine: null, isTarget: false, depth: 1 },
      { pid: 17820, name: 'npm.cmd', commandLine: 'npm run dev', isTarget: false, depth: 2 },
      { pid: 18240, name: 'node.exe', commandLine: 'npm run dev', isTarget: true, depth: 3 },
    ],
    listeningPorts: [3000, 3001],
    environment: { type: 'windows' },
  },
  {
    process: {
      pid: 22096,
      parentPid: 21000,
      name: 'python.exe',
      executablePath: 'C:\\Python311\\python.exe',
      commandLine: 'python -m uvicorn main:app --port 8000',
      workingDirectory: 'C:\\Projects\\api-service',
      status: 'running',
      environment: { type: 'windows' },
    },
    runtime: 'Python',
    packageManager: 'Unknown',
    parent: {
      pid: 21000,
      name: 'cmd.exe',
      commandLine: null,
    },
    processTree: [
      { pid: 21000, name: 'cmd.exe', commandLine: null, isTarget: false, depth: 0 },
      { pid: 22096, name: 'python.exe', commandLine: 'python -m uvicorn main:app', isTarget: true, depth: 1 },
    ],
    listeningPorts: [8000],
    environment: { type: 'windows' },
  },
  {
    process: {
      pid: 421,
      parentPid: 300,
      name: 'node',
      executablePath: '/usr/bin/node',
      commandLine: 'node index.js',
      workingDirectory: '/home/dev/wsl-express',
      status: 'running',
      environment: { type: 'wsl', distro: 'Ubuntu' },
    },
    runtime: 'Node.js',
    packageManager: 'npm',
    parent: {
      pid: 300,
      name: 'bash',
      commandLine: '-bash',
    },
    processTree: [
      { pid: 300, name: 'bash', commandLine: '-bash', isTarget: false, depth: 0 },
      { pid: 421, name: 'node', commandLine: 'node index.js', isTarget: true, depth: 1 },
    ],
    listeningPorts: [5000],
    environment: { type: 'wsl', distro: 'Ubuntu' },
  },
];

const mockSnapshot: UnifiedSnapshot = {
  processes: mockIdentities.map((id) => id.process),
  ports: mockPorts,
  identities: mockIdentities,
  distributions: [
    { name: 'Ubuntu', state: 'running', isDefault: true, version: 2 },
    { name: 'FedoraLinux-44', state: 'stopped', isDefault: false, version: 2 },
  ],
  diagnostics: [],
};

describe('Dashboard Component (Milestones 4, 5, & 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(systemApi.getSystemInfo).mockResolvedValue(mockSystemInfo);
    vi.mocked(unifiedApi.getUnifiedSnapshot).mockResolvedValue(mockSnapshot);
    vi.mocked(portApi.getListeningPorts).mockResolvedValue(mockPorts);
    vi.mocked(identityApi.getProcessIdentities).mockResolvedValue(mockIdentities);
    vi.mocked(profileApi.getProfiles).mockResolvedValue([]);
  });

  it('renders Dashboard with hero header, metrics cards, and discovered server cards across Windows and WSL', async () => {
    render(<Dashboard />);

    expect(screen.getByText(/Local Development Control Center/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('company-frontend')).toBeInTheDocument();
      expect(screen.getByText('api-service')).toBeInTheDocument();
      expect(screen.getByText('wsl-express')).toBeInTheDocument();
    });

    expect(screen.getByText(/localhost:3000/i)).toBeInTheDocument();
    expect(screen.getByText(/localhost:8000/i)).toBeInTheDocument();
    expect(screen.getByText(/localhost:5000/i)).toBeInTheDocument();
    expect(screen.getAllByText('Node.js').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Python').length).toBeGreaterThan(0);
    expect(screen.getByText(/PID 18240/i)).toBeInTheDocument();
    expect(screen.getByText(/PID 22096/i)).toBeInTheDocument();
    expect(screen.getByText(/PID 421/i)).toBeInTheDocument();
    expect(screen.getByText(/WSL \/ Ubuntu/i)).toBeInTheDocument();
  });

  it('filters server list dynamically when user enters a search query', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('company-frontend')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search servers by name/i);
    fireEvent.change(searchInput, { target: { value: '8000' } });

    expect(screen.getByText('api-service')).toBeInTheDocument();
    expect(screen.queryByText('company-frontend')).not.toBeInTheDocument();
    expect(screen.queryByText('wsl-express')).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'ubuntu' } });
    expect(screen.getByText('wsl-express')).toBeInTheDocument();
    expect(screen.queryByText('company-frontend')).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('company-frontend')).toBeInTheDocument();
  });

  it('opens details modal with process ancestry tree when Inspect is clicked', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('company-frontend')).toBeInTheDocument();
    });

    const inspectButtons = screen.getAllByRole('button', { name: /Inspect/i });
    fireEvent.click(inspectButtons[0]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Process Lineage Ancestry/i)).toBeInTheDocument();
    expect(screen.getByText('Code.exe')).toBeInTheDocument();
    expect(screen.getAllByText('npm.cmd').length).toBeGreaterThan(0);
    expect(screen.getByText(/Target Server Process/i)).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Close modal/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens stop confirmation modal for Windows server when Stop is clicked', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('company-frontend')).toBeInTheDocument();
    });

    const stopButtons = screen.getAllByRole('button', { name: /Stop/i });
    fireEvent.click(stopButtons[0]);

    // Modal should be open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Stop Development Server\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Pre-Termination Safety Guard/i)).toBeInTheDocument();
    expect(screen.getAllByText(/C:\\Projects\\company-frontend/i).length).toBeGreaterThan(0);

    // Cancel closes dialog
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByText(/Stop Development Server\?/i)).not.toBeInTheDocument();
  });

  it('executes stop server flow and displays success notification banner', async () => {
    const mockResult: ControlResult = {
      status: 'stopped',
      pid: 18240,
      releasedPorts: [3000, 3001],
      remainingChildren: [],
      remainingOwner: null,
      message: 'Server was safely stopped.',
    };
    vi.mocked(controlApi.stopServer).mockResolvedValue(mockResult);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('company-frontend')).toBeInTheDocument();
    });

    const stopButtons = screen.getAllByRole('button', { name: /Stop/i });
    fireEvent.click(stopButtons[0]);

    const confirmStopBtn = screen.getByRole('button', { name: /^Stop Server$/i });
    fireEvent.click(confirmStopBtn);

    await waitFor(() => {
      expect(controlApi.stopServer).toHaveBeenCalledWith(
        expect.objectContaining({
          pid: 18240,
          processName: 'node.exe',
          executablePath: 'C:\\Program Files\\nodejs\\node.exe',
          workingDirectory: 'C:\\Projects\\company-frontend',
          expectedPorts: [3000, 3001],
          force: false,
          environment: { type: 'windows' },
        })
      );
      expect(screen.getByText(/Server "company-frontend" \(PID 18240\) stopped/i)).toBeInTheDocument();
    });
  });

  it('displays structured error when process identity changes prior to termination', async () => {
    vi.mocked(controlApi.stopServer).mockRejectedValue({
      code: 'PROCESS_IDENTITY_CHANGED',
      message: 'Process identity changed for PID 18240. Expected node.exe, found python.exe.',
      pid: 18240,
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('company-frontend')).toBeInTheDocument();
    });

    const stopButtons = screen.getAllByRole('button', { name: /Stop/i });
    fireEvent.click(stopButtons[0]);

    const confirmStopBtn = screen.getByRole('button', { name: /^Stop Server$/i });
    fireEvent.click(confirmStopBtn);

    await waitFor(() => {
      expect(screen.getByText(/Process identity changed for PID 18240/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Refresh Server List/i })).toBeInTheDocument();
    });
  });

  it('switches between Development Servers, Listening Ports, and Process Identities tabs', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('company-frontend')).toBeInTheDocument();
    });

    const portsTab = screen.getByRole('button', { name: /Listening Ports/i });
    fireEvent.click(portsTab);
    expect(screen.getByPlaceholderText(/Search listening ports by port/i)).toBeInTheDocument();

    const processesTab = screen.getByRole('button', { name: /Process Identities/i });
    fireEvent.click(processesTab);
    expect(screen.getByPlaceholderText(/Search processes by name/i)).toBeInTheDocument();
  });

  it('renders empty state when no servers are detected', async () => {
    vi.mocked(unifiedApi.getUnifiedSnapshot).mockResolvedValue({
      processes: [],
      ports: [],
      identities: [],
      distributions: [],
      diagnostics: [],
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/No running development servers found/i)).toBeInTheDocument();
    });
  });

  it('renders error state with retry button when backend discovery fails', async () => {
    vi.mocked(unifiedApi.getUnifiedSnapshot).mockRejectedValue('Access to TCP table was denied');
    vi.mocked(portApi.getListeningPorts).mockRejectedValue('Access to TCP table was denied');

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Unable to inspect local development servers/i)).toBeInTheDocument();
      expect(screen.getByText(/Access to TCP table was denied/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry Discovery/i })).toBeInTheDocument();
    });
  });

  it('renders Unmanaged badges and opens AdoptionFormModal when Adopt is clicked', async () => {
    vi.mocked(profileApi.findDuplicates).mockResolvedValue({ hasDuplicates: false, duplicates: [] });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('company-frontend')).toBeInTheDocument();
    });

    // When no profiles match, servers should show "Unmanaged" badge and "Adopt" button
    const unmanagedBadges = screen.getAllByText('Unmanaged');
    expect(unmanagedBadges.length).toBeGreaterThan(0);

    const adoptButtons = screen.getAllByRole('button', { name: /Adopt/i });
    expect(adoptButtons.length).toBeGreaterThan(0);

    // Click the first Adopt button
    fireEvent.click(adoptButtons[0]);

    // Adoption modal should open
    await waitFor(() => {
      expect(screen.getByText('Adopt Running Server')).toBeInTheDocument();
      expect(screen.getByDisplayValue('company-frontend')).toBeInTheDocument();
      expect(screen.getByDisplayValue('npm run dev')).toBeInTheDocument();
    });
  });

  it('supports stopping WSL servers from Dashboard in Milestone 11', async () => {
    vi.mocked(controlApi.stopServer).mockResolvedValue({
      status: 'stopped',
      pid: 421,
      releasedPorts: [5000],
      remainingChildren: [],
      remainingOwner: null,
      message: "Server 'wsl-microservice' (PID 421) in WSL / Ubuntu was safely stopped.",
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('wsl-express')).toBeInTheDocument();
    });

    // Find all Stop buttons and click the WSL one (port 5000 is index 1)
    const stopButtons = screen.getAllByRole('button', { name: /^Stop$/i });
    expect(stopButtons.length).toBeGreaterThan(1);

    fireEvent.click(stopButtons[1]);

    // Confirmation modal should open
    await waitFor(() => {
      expect(screen.getByText(/Stop Development Server\?/i)).toBeInTheDocument();
    });

    // Confirm Stop
    const confirmButton = screen.getByRole('button', { name: /^Stop Server$/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(controlApi.stopServer).toHaveBeenCalledWith(
        expect.objectContaining({
          pid: 421,
          environment: { type: 'wsl', distro: 'Ubuntu' },
        })
      );
    });
  });
});
