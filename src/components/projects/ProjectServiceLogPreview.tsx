import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { LogSessionView, LogUpdateEvent, ProfileRuntimeStatus } from '../../types';
import { logApi } from '../../lib/commands';

interface ProjectServiceLogPreviewProps {
  profileId: string;
  profileName: string;
  status: ProfileRuntimeStatus;
  onOpenLogs: () => void;
}

export const ProjectServiceLogPreview: React.FC<ProjectServiceLogPreviewProps> = ({
  profileId,
  profileName,
  status,
  onOpenLogs,
}) => {
  const [sessionView, setSessionView] = useState<LogSessionView | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    try {
      const view = await logApi.getServiceLogs(profileId);
      setSessionView(view);
    } catch {
      // Graceful fallback if backend unavailable
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession, status]);

  // Subscribe to live log updates
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let isMounted = true;

    const setupListener = async () => {
      unlisten = await logApi.subscribeToServiceLogs((event: LogUpdateEvent) => {
        if (!isMounted || event.profileId !== profileId) return;

        setSessionView((prev) => {
          if (!prev || prev.sessionId !== event.sessionId) {
            // New session started or initial snapshot
            return {
              sessionId: event.sessionId,
              profileId: event.profileId,
              status: event.status,
              source: 'runara',
              isLiveAvailable: true,
              unavailableReason: null,
              startedAt: new Date().toISOString(),
              totalLines: event.newEntries.length,
              entries: event.newEntries,
            };
          }

          // Append new entries and slice to last 20 entries for preview efficiency
          const merged = [...prev.entries, ...event.newEntries];
          const bounded = merged.length > 20 ? merged.slice(merged.length - 20) : merged;

          return {
            ...prev,
            status: event.status,
            totalLines: prev.totalLines + event.newEntries.length,
            entries: bounded,
          };
        });
      });
    };

    setupListener();

    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, [profileId]);

  // Recent 4 lines to preview
  const previewLines = useMemo(() => {
    if (!sessionView || sessionView.entries.length === 0) return [];
    return sessionView.entries.slice(-4);
  }, [sessionView]);

  const isLive = sessionView?.isLiveAvailable && status === 'running';

  return (
    <div
      data-testid={`log-preview-${profileId}`}
      className="mt-2.5 bg-app-surface/60 border border-app-border rounded-lg p-2.5 text-xs text-app-fg"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-app-muted-fg">
            {status === 'running'
              ? 'Live Output'
              : status === 'starting'
              ? 'Starting Output'
              : status === 'error'
              ? 'Last Error Output'
              : 'Recent Output'}
          </span>
          {isLive && (
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
          )}
          {sessionView?.source === 'external' && (
            <span className="text-[9px] px-1 py-0.2 rounded bg-app-muted text-app-muted-fg font-mono border border-app-border">
              External process
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenLogs}
          aria-label={`Open logs for ${profileName}`}
          className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 flex items-center gap-1 cursor-pointer transition-colors"
        >
          <span>Open Logs</span>
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="py-2 text-center text-app-muted-fg font-mono text-[11px]">
          Loading output...
        </div>
      ) : !sessionView?.isLiveAvailable ? (
        <div className="py-1 text-app-muted-fg text-[11px] italic">
          {sessionView?.unavailableReason || 'No log output available for this service.'}
        </div>
      ) : previewLines.length === 0 ? (
        <div className="py-1 text-app-muted-fg text-[11px] italic font-mono">
          No output captured for this session yet.
        </div>
      ) : (
        <div className="font-mono text-[11px] space-y-0.5 bg-app-bg/90 p-2 rounded border border-app-border max-h-24 overflow-hidden">
          {previewLines.map((entry) => (
            <div key={entry.id} className="truncate flex items-start gap-2 leading-relaxed">
              <span className="text-app-muted-fg/70 select-none shrink-0 text-[10px]">
                {entry.timestamp}
              </span>
              {entry.stream === 'stderr' && (
                <span className="text-amber-600 dark:text-amber-400 font-semibold select-none shrink-0 text-[10px]">
                  [err]
                </span>
              )}
              <span
                className={`truncate ${
                  entry.stream === 'stderr'
                    ? 'text-amber-600 dark:text-amber-300'
                    : 'text-app-fg'
                }`}
              >
                {entry.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
