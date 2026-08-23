import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Projects from './Projects';
import { projectApi, profileApi, controlApi } from '../lib/commands';
import type { ProjectView, ServerProfile, ProjectOperationResult } from '../types';

vi.mock('../lib/commands', () => ({
  projectApi: {
    getProjects: vi.fn(),
    getProject: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    addProfileToProject: vi.fn(),
    removeProfileFromProject: vi.fn(),
    reorderProjectProfiles: vi.fn(),
    getProjectForProfile: vi.fn(),
    getProjectViews: vi.fn(),
    startProject: vi.fn(),
    stopProject: vi.fn(),
    restartProject: vi.fn(),
  },
  profileApi: {
    getProfiles: vi.fn(),
    startProfile: vi.fn(),
    updateProfile: vi.fn(),
  },
  controlApi: {
    stopServer: vi.fn(),
  },
}));

const mockProfiles: ServerProfile[] = [
  {
    id: 'prof-1',
    name: 'Frontend App',
    description: 'React client',
    environment: { type: 'windows' },
    workingDirectory: 'C:\\Projects\\frontend',
    command: 'npm run dev',
    expectedPort: 3000,
    expectedHost: '127.0.0.1',
    enabled: true,
    createdAt: '2026-08-22T10:00:00Z',
    updatedAt: '2026-08-22T10:00:00Z',
  },
  {
    id: 'prof-2',
    name: 'Backend API',
    description: 'FastAPI service',
    environment: { type: 'windows' },
    workingDirectory: 'C:\\Projects\\backend',
    command: 'python main.py',
    expectedPort: 5000,
    expectedHost: '0.0.0.0',
    enabled: true,
    createdAt: '2026-08-22T10:00:00Z',
    updatedAt: '2026-08-22T10:00:00Z',
  },
  {
    id: 'prof-3',
    name: 'WSL Worker',
    description: 'Background worker',
    environment: { type: 'wsl', distro: 'Fedora' },
    workingDirectory: '/home/dev/worker',
    command: 'npm run worker',
    expectedPort: null,
    expectedHost: null,
    enabled: true,
    createdAt: '2026-08-22T10:00:00Z',
    updatedAt: '2026-08-22T10:00:00Z',
  },
];

const mockProjectViews: ProjectView[] = [
  {
    project: {
      id: 'proj-1',
      name: 'Company Platform',
      description: 'Core developer services',
      createdAt: '2026-08-22T10:00:00Z',
      updatedAt: '2026-08-22T10:00:00Z',
    },
    status: 'running',
    totalServices: 2,
    runningServices: 2,
    stoppedServices: 0,
    profiles: [
      {
        profile: mockProfiles[1], // Backend API
        orderIndex: 0,
        status: 'running',
        activePid: 19200,
        activePort: 5000,
        errorMessage: null,
      },
      {
        profile: mockProfiles[0], // Frontend App
        orderIndex: 1,
        status: 'running',
        activePid: 18240,
        activePort: 3000,
        errorMessage: null,
      },
    ],
  },
  {
    project: {
      id: 'proj-2',
      name: 'Mixed Project',
      description: 'Windows + WSL services',
      createdAt: '2026-08-22T10:00:00Z',
      updatedAt: '2026-08-22T10:00:00Z',
    },
    status: 'partial',
    totalServices: 2,
    runningServices: 1,
    stoppedServices: 1,
    profiles: [
      {
        profile: mockProfiles[0], // Frontend App
        orderIndex: 0,
        status: 'running',
        activePid: 18240,
        activePort: 3000,
        errorMessage: null,
      },
      {
        profile: mockProfiles[2], // WSL Worker
        orderIndex: 1,
        status: 'stopped',
        activePid: null,
        activePort: null,
        errorMessage: null,
      },
    ],
  },
];

describe('Projects Page & Orchestration (Milestone 13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectApi.getProjectViews).mockResolvedValue(mockProjectViews);
    vi.mocked(profileApi.getProfiles).mockResolvedValue(mockProfiles);
  });

  it('renders project list with summary metrics and cards', async () => {
    render(<Projects />);

    expect(screen.getByText('Project Groups')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Company Platform')).toBeInTheDocument();
      expect(screen.getByText('Mixed Project')).toBeInTheDocument();
    });

    // Verify summary cards
    expect(screen.getByText('Total Projects')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('Partial')).toBeInTheDocument();
  });

  it('filters project cards by search query', async () => {
    render(<Projects />);

    await waitFor(() => {
      expect(screen.getByText('Company Platform')).toBeInTheDocument();
      expect(screen.getByText('Mixed Project')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search projects or services/i);
    fireEvent.change(searchInput, { target: { value: 'WSL' } });

    expect(screen.getByText('Mixed Project')).toBeInTheDocument();
    expect(screen.queryByText('Company Platform')).not.toBeInTheDocument();
  });

  it('opens Create Project modal with multi-service picker and creates project with member services', async () => {
    vi.mocked(projectApi.createProject).mockResolvedValue({
      id: 'proj-new',
      name: 'New Platform',
      description: 'Microservices suite',
      createdAt: '2026-08-22T12:00:00Z',
      updatedAt: '2026-08-22T12:00:00Z',
    });
    vi.mocked(projectApi.addProfileToProject).mockResolvedValue();

    render(<Projects />);

    await waitFor(() => {
      expect(screen.getByText('Company Platform')).toBeInTheDocument();
    });

    const newProjBtn = screen.getByRole('button', { name: /New Project/i });
    fireEvent.click(newProjBtn);

    expect(screen.getByText('Create New Project')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/e\.g\. Company Platform/i);
    const descInput = screen.getByPlaceholderText(/Brief description/i);

    fireEvent.change(nameInput, { target: { value: 'New Platform' } });
    fireEvent.change(descInput, { target: { value: 'Microservices suite' } });

    // Open available profiles picker inside creation form
    const addServiceBtn = screen.getByRole('button', { name: /Add Service/i });
    fireEvent.click(addServiceBtn);

    // Pick Backend API (+ Add)
    const addButtons = screen.getAllByRole('button', { name: /\+ Add/i });
    fireEvent.click(addButtons[1]); // Backend API

    const submitBtn = screen.getByRole('button', { name: /^Create Project$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(projectApi.createProject).toHaveBeenCalledWith({
        name: 'New Platform',
        description: 'Microservices suite',
      });
      expect(projectApi.addProfileToProject).toHaveBeenCalledWith({
        projectId: 'proj-new',
        profileId: 'prof-2',
        orderIndex: 0,
      });
    });
  });

  it('opens Project Details modal, shows service controls, and allows reordering services', async () => {
    vi.mocked(projectApi.reorderProjectProfiles).mockResolvedValue();

    render(<Projects />);

    await waitFor(() => {
      expect(screen.getByText('Company Platform')).toBeInTheDocument();
    });

    const detailsButtons = screen.getAllByRole('button', { name: /^Open Details$/i });
    fireEvent.click(detailsButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Services & Execution Sequence/i)).toBeInTheDocument();
    });

    // Reorder: Move second service UP
    const moveUpButtons = screen.getAllByTitle('Move up in startup order');
    // First element is disabled, second is enabled
    fireEvent.click(moveUpButtons[1]);

    await waitFor(() => {
      expect(projectApi.reorderProjectProfiles).toHaveBeenCalledWith({
        projectId: 'proj-1',
        profileIds: ['prof-1', 'prof-2'],
      });
    });
  });

  it('executes start project and shows operation progress modal', async () => {
    const startResult: ProjectOperationResult = {
      projectId: 'proj-2',
      operationType: 'start',
      status: 'running',
      startedProfiles: ['WSL Worker'],
      stoppedProfiles: [],
      failedProfile: null,
      pendingProfiles: [],
      unsupportedProfiles: [],
      message: "All 2 services in 'Mixed Project' started successfully.",
    };
    vi.mocked(projectApi.startProject).mockResolvedValue(startResult);

    render(<Projects />);

    await waitFor(() => {
      expect(screen.getByText('Company Platform')).toBeInTheDocument();
      expect(screen.getByText('Mixed Project')).toBeInTheDocument();
    });

    // Click Start All on Mixed Project
    const startButtons = screen.getAllByRole('button', { name: /^Start All$/i });
    fireEvent.click(startButtons[0]);

    await waitFor(() => {
      expect(projectApi.startProject).toHaveBeenCalledWith('proj-2');
      expect(screen.getByText(/Execution Sequence Breakdown/i)).toBeInTheDocument();
      expect(screen.getByText(/All 2 services in 'Mixed Project' started successfully/i)).toBeInTheDocument();
    });
  });

  it('opens Stop Confirmation modal with reverse order preview and stops all services', async () => {
    const stopResult: ProjectOperationResult = {
      projectId: 'proj-1',
      operationType: 'stop',
      status: 'stopped',
      startedProfiles: [],
      stoppedProfiles: ['Frontend App', 'Backend API'],
      failedProfile: null,
      pendingProfiles: [],
      unsupportedProfiles: [],
      message: "Project 'Company Platform' stopped.",
    };
    vi.mocked(projectApi.stopProject).mockResolvedValue(stopResult);

    render(<Projects />);

    await waitFor(() => {
      expect(screen.getByText('Company Platform')).toBeInTheDocument();
    });

    // Click Stop All on Company Platform (proj-1)
    const stopButtons = screen.getAllByRole('button', { name: /^Stop All$/i });
    fireEvent.click(stopButtons[0]);

    // Confirmation modal should appear with reverse sequence breakdown
    await waitFor(() => {
      expect(screen.getByText('Stop All Services?')).toBeInTheDocument();
      expect(screen.getByText(/Reverse Teardown Sequence/i)).toBeInTheDocument();
    });

    // Confirm stop
    const confirmStopBtn = screen.getByRole('button', { name: /^Stop All Services$/i });
    fireEvent.click(confirmStopBtn);

    await waitFor(() => {
      expect(projectApi.stopProject).toHaveBeenCalledWith('proj-1');
      expect(screen.getByText(/Execution Sequence Breakdown/i)).toBeInTheDocument();
    });
  });

  it('opens Restart Confirmation modal and restarts project', async () => {
    const restartResult: ProjectOperationResult = {
      projectId: 'proj-2',
      operationType: 'restart',
      status: 'running',
      startedProfiles: ['Frontend App', 'WSL Worker'],
      stoppedProfiles: ['Frontend App'],
      failedProfile: null,
      pendingProfiles: [],
      unsupportedProfiles: [],
      message: "Project 'Mixed Project' restarted successfully.",
    };
    vi.mocked(projectApi.restartProject).mockResolvedValue(restartResult);

    render(<Projects />);

    await waitFor(() => {
      expect(screen.getByText('Mixed Project')).toBeInTheDocument();
    });

    // Click restart button
    const restartButtons = screen.getAllByRole('button', { name: /^Restart$/i });
    fireEvent.click(restartButtons[0]);

    // Confirmation modal should appear
    await waitFor(() => {
      expect(screen.getByText('Restart Project?')).toBeInTheDocument();
      expect(screen.getByText(/Startup Sequence Order/i)).toBeInTheDocument();
    });

    // Confirm restart
    const confirmRestartBtn = screen.getByRole('button', { name: /^Restart Project$/i });
    fireEvent.click(confirmRestartBtn);

    await waitFor(() => {
      expect(projectApi.restartProject).toHaveBeenCalledWith('proj-1');
    });
  });

  it('allows individual service control from within ProjectDetailsModal', async () => {
    vi.mocked(controlApi.stopServer).mockResolvedValue({
      status: 'stopped',
      pid: 19200,
      releasedPorts: [5000],
      remainingChildren: [],
      remainingOwner: null,
      message: 'Server stopped successfully',
    });

    render(<Projects />);

    await waitFor(() => {
      expect(screen.getByText('Company Platform')).toBeInTheDocument();
    });

    const detailsButtons = screen.getAllByRole('button', { name: /^Open Details$/i });
    fireEvent.click(detailsButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Services & Execution Sequence/i)).toBeInTheDocument();
    });

    // In Company Platform, both services are running, so they have "Stop" buttons
    const serviceStopBtns = screen.getAllByRole('button', { name: /^Stop$/i });
    expect(serviceStopBtns.length).toBe(2);

    fireEvent.click(serviceStopBtns[0]); // Stop Backend API

    await waitFor(() => {
      expect(controlApi.stopServer).toHaveBeenCalledWith(
        expect.objectContaining({
          pid: 19200,
          processName: 'Backend API',
        })
      );
    });
  });

  it('opens Delete Project modal with safety explanation and deletes project', async () => {
    vi.mocked(projectApi.deleteProject).mockResolvedValue(true);

    render(<Projects />);

    await waitFor(() => {
      expect(screen.getByText('Company Platform')).toBeInTheDocument();
    });

    // Open details modal first
    const detailsButtons = screen.getAllByRole('button', { name: /^Open Details$/i });
    fireEvent.click(detailsButtons[0]);

    await waitFor(() => {
      expect(screen.getByTitle('Delete project')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTitle('Delete project');
    fireEvent.click(deleteBtn);

    expect(screen.getByText('Delete Project?')).toBeInTheDocument();
    expect(screen.getByText(/This only removes the project grouping/i)).toBeInTheDocument();

    const confirmDeleteBtn = screen.getAllByRole('button', { name: /^Delete Project$/i });
    fireEvent.click(confirmDeleteBtn[confirmDeleteBtn.length - 1]);

    await waitFor(() => {
      expect(projectApi.deleteProject).toHaveBeenCalledWith('proj-1');
    });
  });
});

