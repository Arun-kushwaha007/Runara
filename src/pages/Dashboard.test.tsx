import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';
import { identityApi, portApi, systemApi } from '../lib/commands';
import type { ProcessIdentity, PortInfo, SystemInfo } from '../types';

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

describe('Dashboard Component (Milestone 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(systemApi.getSystemInfo).mockResolvedValue(mockSystemInfo);
    vi.mocked(portApi.getListeningPorts).mockResolvedValue(mockPorts);
    vi.mocked(identityApi.getProcessIdentities).mockResolvedValue(mockIdentities);
  });

  it('renders Dashboard with hero header, metrics cards, and discovered server cards', async () => {
    render(<Dashboard />);

    // Check loading or header
    expect(screen.getByText(/Local Development Control Center/i)).toBeInTheDocument();

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByText('company-frontend')).toBeInTheDocument();
      expect(screen.getByText('api-service')).toBeInTheDocument();
    });

    // Check ports rendered
    expect(screen.getByText(/localhost:3000/i)).toBeInTheDocument();
    expect(screen.getByText(/localhost:8000/i)).toBeInTheDocument();

    // Check runtimes
    expect(screen.getAllByText('Node.js').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Python').length).toBeGreaterThan(0);

    // Check PIDs
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

    // "api-service" (port 8000) should remain, "company-frontend" (port 3000) should be filtered out
    expect(screen.getByText('api-service')).toBeInTheDocument();
    expect(screen.queryByText('company-frontend')).not.toBeInTheDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('company-frontend')).toBeInTheDocument();
  });

  it('opens details modal with process ancestry tree when Inspect is clicked', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('company-frontend')).toBeInTheDocument();
    });

    // Click "Inspect" on the first server card
    const inspectButtons = screen.getAllByRole('button', { name: /Inspect/i });
    fireEvent.click(inspectButtons[0]);

    // Modal should be open with details
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Process Lineage Ancestry/i)).toBeInTheDocument();
    expect(screen.getByText('Code.exe')).toBeInTheDocument();
    expect(screen.getAllByText('npm.cmd').length).toBeGreaterThan(0);
    expect(screen.getByText(/Target Server Process/i)).toBeInTheDocument();

    // Close modal via close button
    const closeBtn = screen.getByRole('button', { name: /Close modal/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('switches between Development Servers, Listening Ports, and Process Identities tabs', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('company-frontend')).toBeInTheDocument();
    });

    // Switch to Listening Ports tab
    const portsTab = screen.getByRole('button', { name: /Listening Ports/i });
    fireEvent.click(portsTab);

    expect(screen.getByPlaceholderText(/Search listening ports by port/i)).toBeInTheDocument();

    // Switch to Process Identities tab
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
