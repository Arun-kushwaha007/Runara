import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Projects from './Projects';
import { projectApi, profileApi } from '../lib/commands';
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

describe('Projects Page & Orchestration (Milestone 9)', () => {
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
    expect(screen.getByText('2')).toBeInTheDocument(); // total count
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

  it('opens Create Project modal, validates, and creates a project', async () => {
    vi.mocked(projectApi.createProject).mockResolvedValue({
      id: 'proj-new',
      name: 'New Platform',
      description: 'Microservices suite',
      createdAt: '2026-08-22T12:00:00Z',
      updatedAt: '2026-08-22T12:00:00Z',
    });

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

    const submitBtn = screen.getByRole('button', { name: /^Create Project$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(projectApi.createProject).toHaveBeenCalledWith({
        name: 'New Platform',
        description: 'Microservices suite',
      });
    });
  });

  it('opens Project Details modal and allows reordering services', async () => {
    vi.mocked(projectApi.reorderProjectProfiles).mockResolvedValue();

    render(<Projects />);

    await waitFor(() => {
      expect(screen.getByText('Company Platform')).toBeInTheDocument();
    });

    const inspectButtons = screen.getAllByRole('button', { name: /^Inspect$/i });
    fireEvent.click(inspectButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Execution Order & Configured Services/i)).toBeInTheDocument();
    });

    // Reorder: Move second service (Frontend App) UP
    const moveUpButtons = screen.getAllByTitle('Move up in start order');
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
      startedProfiles: ['Frontend App', 'WSL Worker'],
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

    // Click Start on Mixed Project (which is in partial state)
    const startButtons = screen.getAllByRole('button', { name: /^Start$/i });
    fireEvent.click(startButtons[0]);

    await waitFor(() => {
      expect(projectApi.startProject).toHaveBeenCalledWith('proj-2');
      expect(screen.getByText(/Execution Sequence Breakdown/i)).toBeInTheDocument();
      expect(screen.getByText(/All 2 services in 'Mixed Project' started successfully/i)).toBeInTheDocument();
    });
  });

  it('handles fail-fast project startup and displays failure breakdown in progress modal', async () => {
    const failResult: ProjectOperationResult = {
      projectId: 'proj-2',
      operationType: 'start',
      status: 'error',
      startedProfiles: ['Frontend App'],
      stoppedProfiles: [],
      failedProfile: 'WSL Worker',
      pendingProfiles: [],
      unsupportedProfiles: [],
      message: "Project start halted because 'WSL Worker' failed: PROCESS_EXITED",
    };
    vi.mocked(projectApi.startProject).mockResolvedValue(failResult);

    render(<Projects />);

    await waitFor(() => {
      expect(screen.getByText('Company Platform')).toBeInTheDocument();
      expect(screen.getByText('Mixed Project')).toBeInTheDocument();
    });

    const startButtons = screen.getAllByRole('button', { name: /^Start$/i });
    fireEvent.click(startButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Project start halted because 'WSL Worker' failed/i)).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });
  });

  it('opens Delete Project modal with safety explanation', async () => {
    vi.mocked(projectApi.deleteProject).mockResolvedValue(true);

    render(<Projects />);

    await waitFor(() => {
      expect(screen.getByText('Company Platform')).toBeInTheDocument();
    });

    // Open details modal first
    const inspectButtons = screen.getAllByRole('button', { name: /^Inspect$/i });
    fireEvent.click(inspectButtons[0]);

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
