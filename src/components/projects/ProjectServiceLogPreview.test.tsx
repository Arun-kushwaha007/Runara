import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectServiceLogPreview } from './ProjectServiceLogPreview';
import { logApi } from '../../lib/commands';
import type { LogSessionView, LogUpdateEvent } from '../../types';

vi.mock('../../lib/commands', () => ({
  logApi: {
    getServiceLogs: vi.fn(),
    clearServiceLogs: vi.fn(),
    subscribeToServiceLogs: vi.fn(),
  },
}));

describe('ProjectServiceLogPreview Component', () => {
  const profileId = 'prof-api-1';
  const profileName = 'FastAPI Gateway';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders log preview lines for an active Runara-started service', async () => {
    const mockSession: LogSessionView = {
      sessionId: 'sess-1',
      profileId,
      status: 'running',
      source: 'runara',
      isLiveAvailable: true,
      unavailableReason: null,
      startedAt: '2026-08-25T12:00:00Z',
      totalLines: 3,
      entries: [
        { id: '1', timestamp: '12:00:01', stream: 'stdout', text: 'Application starting...' },
        { id: '2', timestamp: '12:00:02', stream: 'stdout', text: 'Uvicorn running on http://127.0.0.1:8000' },
        { id: '3', timestamp: '12:00:03', stream: 'stderr', text: 'Warning: running with debug enabled' },
      ],
    };

    vi.mocked(logApi.getServiceLogs).mockResolvedValue(mockSession);
    vi.mocked(logApi.subscribeToServiceLogs).mockResolvedValue(() => {});

    const onOpenLogs = vi.fn();
    render(
      <ProjectServiceLogPreview
        profileId={profileId}
        profileName={profileName}
        status="running"
        onOpenLogs={onOpenLogs}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Uvicorn running on http://127.0.0.1:8000')).toBeInTheDocument();
    });

    expect(screen.getByText('Warning: running with debug enabled')).toBeInTheDocument();
    expect(screen.getByText('[err]')).toBeInTheDocument();
    expect(screen.getByText('Live Output')).toBeInTheDocument();

    const openBtn = screen.getByRole('button', { name: `Open logs for ${profileName}` });
    fireEvent.click(openBtn);
    expect(onOpenLogs).toHaveBeenCalledTimes(1);
  });

  it('renders clear diagnostic message when service is an externally adopted process', async () => {
    const mockSession: LogSessionView = {
      sessionId: '',
      profileId,
      status: 'running',
      source: 'external',
      isLiveAvailable: false,
      unavailableReason: 'Live log output unavailable. Runara did not start this service.',
      startedAt: '2026-08-25T12:00:00Z',
      totalLines: 0,
      entries: [],
    };

    vi.mocked(logApi.getServiceLogs).mockResolvedValue(mockSession);
    vi.mocked(logApi.subscribeToServiceLogs).mockResolvedValue(() => {});

    render(
      <ProjectServiceLogPreview
        profileId={profileId}
        profileName={profileName}
        status="running"
        onOpenLogs={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText('Live log output unavailable. Runara did not start this service.')
      ).toBeInTheDocument();
    });

    expect(screen.getByText('External process')).toBeInTheDocument();
  });

  it('updates live stream when event listener receives new entries', async () => {
    let capturedCallback: ((event: LogUpdateEvent) => void) | undefined;
    vi.mocked(logApi.subscribeToServiceLogs).mockImplementation(async (cb) => {
      capturedCallback = cb;
      return () => {};
    });

    const initialSession: LogSessionView = {
      sessionId: 'sess-dynamic',
      profileId,
      status: 'running',
      source: 'runara',
      isLiveAvailable: true,
      unavailableReason: null,
      startedAt: '2026-08-25T12:00:00Z',
      totalLines: 1,
      entries: [
        { id: '1', timestamp: '12:00:00', stream: 'stdout', text: 'Initializing...' },
      ],
    };

    vi.mocked(logApi.getServiceLogs).mockResolvedValue(initialSession);

    render(
      <ProjectServiceLogPreview
        profileId={profileId}
        profileName={profileName}
        status="running"
        onOpenLogs={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Initializing...')).toBeInTheDocument();
    });

    expect(capturedCallback).toBeDefined();

    // Fire simulated event with new log lines
    capturedCallback!({
      profileId,
      sessionId: 'sess-dynamic',
      status: 'running',
      newEntries: [
        { id: '2', timestamp: '12:00:05', stream: 'stdout', text: 'Database migration complete.' },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('Database migration complete.')).toBeInTheDocument();
    });
  });
});
