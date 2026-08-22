import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';
import { controlApi, identityApi, portApi, systemApi } from '../lib/commands';
import type { ProcessIdentity, PortInfo, SystemInfo, ControlResult } from '../types';

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
}));

// Mock tauri-plugin-opener
vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
}));

const mockSystemInfo: SystemInfo = {
  app: 'DevHub',
  version: '0.1.0',
  backend: 'Rust',
  status: 'Ready',
  platform: 'Windows',
};

const mockPorts: PortInfo[] = [
  {
    port: 3000,
    pid: 18240,
    protocol: 'tcp',
    address: '127.0.0.1',
    state: 'listening',
  },
  {
    port: 3001,
    pid: 18240,
    protocol: 'tcp',
    address: '127.0.0.1',
    state: 'listening',
  },
  {
    port: 8000,
    pid: 22096,
    protocol: 'tcp',
    address: '0.0.0.0',
    state: 'listening',
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
  },
];

describe('Dashboard Component (Milestones 4 & 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(systemApi.getSystemInfo).mockResolvedValue(mockSystemInfo);
    vi.mocked(portApi.getListeningPorts).mockResolvedValue(mockPorts);
    vi.mocked(identityApi.getProcessIdentities).mockResolvedValue(mockIdentities);
  });

  it('renders Dashboard with hero header, metrics cards, and discovered server cards', async () => {
    render(<Dashboard />);

    expect(screen.getByText(/Local Development Control Center/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('company-frontend')).toBeInTheDocument();
      expect(screen.getByText('api-service')).toBeInTheDocument();
    });

    expect(screen.getByText(/localhost:3000/i)).toBeInTheDocument();
    expect(screen.getByText(/localhost:8000/i)).toBeInTheDocument();
    expect(screen.getAllByText('Node.js').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Python').length).toBeGreaterThan(0);
    expect(screen.getByText(/PID 18240/i)).toBeInTheDocument();
    expect(screen.getByText(/PID 22096/i)).toBeInTheDocument();
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

  it('opens stop confirmation modal with target details when Stop is clicked', async () => {
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
      expect(controlApi.stopServer).toHaveBeenCalledWith({
        pid: 18240,
        processName: 'node.exe',
        executablePath: 'C:\\Program Files\\nodejs\\node.exe',
        workingDirectory: 'C:\\Projects\\company-frontend',
        expectedPorts: [3000, 3001],
        force: false,
      });
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
    vi.mocked(portApi.getListeningPorts).mockResolvedValue([]);
    vi.mocked(identityApi.getProcessIdentities).mockResolvedValue([]);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/No running development servers found/i)).toBeInTheDocument();
    });
  });

  it('renders error state with retry button when backend discovery fails', async () => {
    vi.mocked(portApi.getListeningPorts).mockRejectedValue('Access to Windows TCP table was denied');

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Unable to inspect local development servers/i)).toBeInTheDocument();
      expect(screen.getByText(/Access to Windows TCP table was denied/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry Discovery/i })).toBeInTheDocument();
    });
  });
});

