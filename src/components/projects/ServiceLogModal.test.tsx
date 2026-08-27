import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ServiceLogModal } from './ServiceLogModal';
import { logApi } from '../../lib/commands';
import type { LogSessionView, ServerProfile } from '../../types';

vi.mock('../../lib/commands', () => ({
  logApi: {
    getServiceLogs: vi.fn(),
    clearServiceLogs: vi.fn(),
    subscribeToServiceLogs: vi.fn(),
  },
}));

describe('ServiceLogModal Component', () => {
  const mockProfile: ServerProfile = {
    id: 'prof-node-1',
    name: 'Node Backend',
    description: 'Express server',
    environment: { type: 'windows' },
    workingDirectory: 'C:\\Projects\\node-backend',
    command: 'node server.js',
    expectedPort: 4000,
    expectedHost: '127.0.0.1',
    enabled: true,
    createdAt: '2026-08-25T10:00:00Z',
    updatedAt: '2026-08-25T10:00:00Z',
  };

  const mockSession: LogSessionView = {
    sessionId: 'sess-node-1',
    profileId: 'prof-node-1',
    status: 'running',
    source: 'runara',
    isLiveAvailable: true,
    unavailableReason: null,
    startedAt: '2026-08-25T10:00:00Z',
    totalLines: 3,
    entries: [
      { id: '1', timestamp: '10:00:01', stream: 'stdout', text: 'Express server listening on port 4000' },
      { id: '2', timestamp: '10:00:02', stream: 'stdout', text: 'Connected to Redis cache' },
      { id: '3', timestamp: '10:00:03', stream: 'stderr', text: 'DeprecationWarning: Buffer() is deprecated' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(logApi.getServiceLogs).mockResolvedValue(mockSession);
    vi.mocked(logApi.subscribeToServiceLogs).mockResolvedValue(() => {});
    vi.mocked(logApi.clearServiceLogs).mockResolvedValue(true);
  });

  it('renders modal with metadata, line numbers, and stream badges', async () => {
    const onClose = vi.fn();
    render(
      <ServiceLogModal
        isOpen={true}
        onClose={onClose}
        profile={mockProfile}
        status="running"
        activePort={4000}
        activePid={1234}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Express server listening on port 4000')).toBeInTheDocument();
    });

    expect(screen.getByText('Node Backend')).toBeInTheDocument();
    expect(screen.getByText('PID 1234')).toBeInTheDocument();
    expect(screen.getByText(':4000')).toBeInTheDocument();
    expect(screen.getByText('DeprecationWarning: Buffer() is deprecated')).toBeInTheDocument();
    expect(screen.getAllByText('stderr').length).toBeGreaterThanOrEqual(1);

    // Close button
    const closeBtn = screen.getByRole('button', { name: 'Close logs modal' });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('filters entries by search query', async () => {
    render(
      <ServiceLogModal
        isOpen={true}
        onClose={vi.fn()}
        profile={mockProfile}
        status="running"
        activePort={4000}
        activePid={1234}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Express server listening on port 4000')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search logs...');
    fireEvent.change(searchInput, { target: { value: 'Redis' } });

    expect(screen.getByText('Connected to Redis cache')).toBeInTheDocument();
    expect(screen.queryByText('Express server listening on port 4000')).not.toBeInTheDocument();
    expect(screen.getByText('1 match')).toBeInTheDocument();
  });

  it('filters entries by stream pill (stdout / stderr)', async () => {
    render(
      <ServiceLogModal
        isOpen={true}
        onClose={vi.fn()}
        profile={mockProfile}
        status="running"
        activePort={4000}
        activePid={1234}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Express server listening on port 4000')).toBeInTheDocument();
    });

    const stderrFilterBtn = screen.getByRole('button', { name: 'stderr' });
    fireEvent.click(stderrFilterBtn);

    expect(screen.getByText('DeprecationWarning: Buffer() is deprecated')).toBeInTheDocument();
    expect(screen.queryByText('Express server listening on port 4000')).not.toBeInTheDocument();
  });

  it('clears log buffer when Clear button is clicked', async () => {
    render(
      <ServiceLogModal
        isOpen={true}
        onClose={vi.fn()}
        profile={mockProfile}
        status="running"
        activePort={4000}
        activePid={1234}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Express server listening on port 4000')).toBeInTheDocument();
    });

    const clearBtn = screen.getByRole('button', { name: 'Clear output display buffer' });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(logApi.clearServiceLogs).toHaveBeenCalledWith('prof-node-1');
      expect(screen.getByText('No output captured for this session yet.')).toBeInTheDocument();
    });
  });

  it('copies log entries to clipboard', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <ServiceLogModal
        isOpen={true}
        onClose={vi.fn()}
        profile={mockProfile}
        status="running"
        activePort={4000}
        activePid={1234}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Express server listening on port 4000')).toBeInTheDocument();
    });

    const copyBtn = screen.getByRole('button', { name: 'Copy logs to clipboard' });
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining('[10:00:01] [STDOUT] Express server listening on port 4000')
    );
  });
});
