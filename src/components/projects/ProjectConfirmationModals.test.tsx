import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectStopConfirmationModal } from './ProjectStopConfirmationModal';
import { ProjectRestartConfirmationModal } from './ProjectRestartConfirmationModal';
import type { ProjectView } from '../../types';

const mockProjectView: ProjectView = {
  project: {
    id: 'proj-1',
    name: 'Multi Service App',
    description: 'E-commerce platform',
    createdAt: '2026-08-23T10:00:00Z',
    updatedAt: '2026-08-23T10:00:00Z',
  },
  status: 'running',
  totalServices: 3,
  runningServices: 2,
  stoppedServices: 1,
  profiles: [
    {
      profile: {
        id: 'p1',
        name: 'Backend API',
        description: null,
        environment: { type: 'windows' },
        workingDirectory: 'C:\\app\\backend',
        command: 'python main.py',
        expectedPort: 8000,
        expectedHost: '127.0.0.1',
        enabled: true,
        createdAt: '2026-08-23T10:00:00Z',
        updatedAt: '2026-08-23T10:00:00Z',
      },
      orderIndex: 0,
      status: 'running',
      activePid: 1001,
      activePort: 8000,
      errorMessage: null,
    },
    {
      profile: {
        id: 'p2',
        name: 'Frontend Client',
        description: null,
        environment: { type: 'windows' },
        workingDirectory: 'C:\\app\\frontend',
        command: 'npm run dev',
        expectedPort: 3000,
        expectedHost: '127.0.0.1',
        enabled: true,
        createdAt: '2026-08-23T10:00:00Z',
        updatedAt: '2026-08-23T10:00:00Z',
      },
      orderIndex: 1,
      status: 'running',
      activePid: 1002,
      activePort: 3000,
      errorMessage: null,
    },
    {
      profile: {
        id: 'p3',
        name: 'Worker Queue',
        description: null,
        environment: { type: 'wsl', distro: 'Ubuntu' },
        workingDirectory: '/home/dev/worker',
        command: 'python worker.py',
        expectedPort: null,
        expectedHost: null,
        enabled: true,
        createdAt: '2026-08-23T10:00:00Z',
        updatedAt: '2026-08-23T10:00:00Z',
      },
      orderIndex: 2,
      status: 'stopped',
      activePid: null,
      activePort: null,
      errorMessage: null,
    },
  ],
};

describe('ProjectStopConfirmationModal', () => {
  it('renders reverse teardown sequence for running services and triggers onConfirm', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ProjectStopConfirmationModal
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        projectView={mockProjectView}
      />
    );

    expect(screen.getByText('Stop All Services?')).toBeInTheDocument();
    expect(screen.getByText('Multi Service App')).toBeInTheDocument();
    expect(screen.getByText(/Reverse Teardown Sequence/i)).toBeInTheDocument();

    // Verify reverse order: Frontend Client (idx 1 in config) comes before Backend API (idx 0 in config)
    const serviceNames = screen.getAllByText(/Frontend Client|Backend API/);
    expect(serviceNames[0]).toHaveTextContent('Frontend Client');
    expect(serviceNames[1]).toHaveTextContent('Backend API');

    // Stopped Worker Queue should not be in reverse teardown list
    expect(screen.queryByText('Worker Queue')).not.toBeInTheDocument();

    const stopButton = screen.getByRole('button', { name: /^Stop All Services$/i });
    fireEvent.click(stopButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    const cancelButton = screen.getByRole('button', { name: /^Cancel$/i });
    fireEvent.click(cancelButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ProjectRestartConfirmationModal', () => {
  it('renders restart workflow summary and triggers onConfirm', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ProjectRestartConfirmationModal
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        projectView={mockProjectView}
      />
    );

    expect(screen.getByText('Restart Project?')).toBeInTheDocument();
    expect(screen.getAllByText('Multi Service App').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Startup Sequence Order/i)).toBeInTheDocument();

    // Forward order list contains all 3 member profiles
    expect(screen.getByText('Backend API')).toBeInTheDocument();
    expect(screen.getByText('Frontend Client')).toBeInTheDocument();
    expect(screen.getByText('Worker Queue')).toBeInTheDocument();

    const restartBtn = screen.getByRole('button', { name: /^Restart Project$/i });
    fireEvent.click(restartBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    const cancelBtn = screen.getByRole('button', { name: /^Cancel$/i });
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
