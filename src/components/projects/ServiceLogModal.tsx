import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { LogEntry, LogSessionView, LogStream, LogUpdateEvent, ServerProfile, ProfileRuntimeStatus } from '../../types';
import { logApi } from '../../lib/commands';

interface ServiceLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ServerProfile | null;
  status: ProfileRuntimeStatus;
  activePort?: number | null;
  activePid?: number | null;
}

export const ServiceLogModal: React.FC<ServiceLogModalProps> = ({
  isOpen,
  onClose,
  profile,
  status,
  activePort,
  activePid,
}) => {
  const [sessionView, setSessionView] = useState<LogSessionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [streamFilter, setStreamFilter] = useState<'all' | LogStream>('all');
  const [copied, setCopied] = useState(false);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollActiveRef = useRef(true);

  const profileId = profile?.id;

  const fetchSession = useCallback(async () => {
    if (!profileId) return;
    try {
      setLoading(true);
      const view = await logApi.getServiceLogs(profileId);
      setSessionView(view);
    } catch {
      // Graceful error handling
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (isOpen && profileId) {
      fetchSession();
      setIsPaused(false);
      setIsUserScrolledUp(false);
      isAutoScrollActiveRef.current = true;
    }
  }, [isOpen, profileId, fetchSession]);

  // Subscribe to live log streaming events
  useEffect(() => {
    if (!isOpen || !profileId) return;

    let unlisten: (() => void) | undefined;
    let isMounted = true;

    const setupListener = async () => {
      unlisten = await logApi.subscribeToServiceLogs((event: LogUpdateEvent) => {
        if (!isMounted || event.profileId !== profileId) return;

        setSessionView((prev) => {
          if (!prev || prev.sessionId !== event.sessionId) {
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

          const merged = [...prev.entries, ...event.newEntries];
          const bounded = merged.length > 5000 ? merged.slice(merged.length - 5000) : merged;

          return {
            ...prev,
            status: event.status,
            totalLines: bounded.length,
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
  }, [isOpen, profileId]);

  // Keep isAutoScrollActiveRef in sync
  useEffect(() => {
    isAutoScrollActiveRef.current = !isPaused && !isUserScrolledUp;
  }, [isPaused, isUserScrolledUp]);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (isAutoScrollActiveRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [sessionView?.entries]);

  // Handle scroll events to detect if user manually scrolled up
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    // User is at bottom if distance to bottom is within 30px
    const isAtBottom = scrollHeight - scrollTop - clientHeight <= 30;
    setIsUserScrolledUp(!isAtBottom);
  };

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      setIsUserScrolledUp(false);
      setIsPaused(false);
    }
  };

  // Keyboard navigation: Escape closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    if (!sessionView) return [];
    return sessionView.entries.filter((entry) => {
      if (streamFilter !== 'all' && entry.stream !== streamFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        return entry.text.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [sessionView, streamFilter, searchQuery]);

  const handleClear = async () => {
    if (!profileId) return;
    try {
      await logApi.clearServiceLogs(profileId);
      setSessionView((prev) => (prev ? { ...prev, entries: [], totalLines: 0 } : null));
    } catch {
      // Error handling
    }
  };

  const handleCopy = async () => {
    if (filteredEntries.length === 0) return;
    const textToCopy = filteredEntries
      .map((e) => `[${e.timestamp}] [${e.stream.toUpperCase()}] ${e.text}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  if (!isOpen || !profile) return null;

  const isLive = sessionView?.isLiveAvailable && status === 'running';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Log Viewer - ${profile.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150 text-app-fg"
    >
      <div className="bg-app-surface border border-app-border rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col h-[85vh] text-app-fg">
        {/* Header */}
        <div className="px-6 py-4 border-b border-app-border flex items-start justify-between gap-4 bg-app-surface">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-lg font-bold text-app-fg tracking-tight">{profile.name}</h3>
              <span className="text-xs px-2 py-0.5 rounded bg-app-muted text-app-muted-fg font-mono border border-app-border">
                {profile.environment.type === 'wsl'
                  ? `WSL:${profile.environment.distro}`
                  : 'Windows'}
              </span>
              {(activePort || profile.expectedPort) && (
                <span className="text-xs font-mono text-app-muted-fg bg-app-muted px-2 py-0.5 rounded border border-app-border">
                  :{activePort || profile.expectedPort}
                </span>
              )}
              {activePid && (
                <span className="text-xs font-mono text-app-muted-fg">
                  PID {activePid}
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  status === 'running'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : status === 'starting'
                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                    : status === 'error'
                    ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
                    : 'bg-app-muted text-app-muted-fg border border-app-border'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    status === 'running'
                      ? 'bg-emerald-500 animate-pulse'
                      : status === 'starting'
                      ? 'bg-blue-500 animate-pulse'
                      : status === 'error'
                      ? 'bg-red-500'
                      : 'bg-app-muted-fg'
                  }`}
                />
                {status}
              </span>
              {sessionView?.source === 'external' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-app-muted text-app-muted-fg font-mono border border-app-border">
                  External process
                </span>
              )}
            </div>

            <div className="mt-1 text-xs text-app-muted-fg font-mono truncate max-w-xl">
              {profile.workingDirectory} &bull; {profile.command}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close logs modal"
              className="p-1.5 text-app-muted-fg hover:text-app-fg bg-app-muted hover:bg-app-surface-hover rounded-xl border border-app-border transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-2.5 bg-app-bg border-b border-app-border flex items-center justify-between gap-3 flex-wrap text-xs">
          {/* Stream Filter Pills & Search */}
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="flex items-center bg-app-surface border border-app-border rounded-lg p-0.5">
              {(['all', 'stdout', 'stderr'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStreamFilter(filter)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium capitalize transition-colors cursor-pointer ${
                    streamFilter === filter
                      ? 'bg-app-muted text-app-fg font-semibold shadow-xs'
                      : 'text-app-muted-fg hover:text-app-fg'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative flex-1 max-w-xs">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs..."
                className="w-full bg-app-surface border border-app-border rounded-lg pl-7 pr-3 py-1 text-xs text-app-fg placeholder:text-app-muted-fg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
              <svg
                className="w-3.5 h-3.5 text-app-muted-fg absolute left-2 top-2"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1.5 text-app-muted-fg hover:text-app-fg"
                  aria-label="Clear search query"
                >
                  &times;
                </button>
              )}
            </div>

            {searchQuery && (
              <span className="text-[11px] text-app-muted-fg font-mono">
                {filteredEntries.length} {filteredEntries.length === 1 ? 'match' : 'matches'}
              </span>
            )}
          </div>

          {/* Action Buttons: Pause/Resume, Clear, Copy */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPaused((prev) => !prev)}
              aria-label={isPaused ? 'Resume live autoscroll' : 'Pause live autoscroll'}
              className={`px-3 py-1 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                isPaused
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                  : 'bg-app-surface text-app-fg border-app-border hover:bg-app-surface-hover'
              }`}
            >
              {isPaused ? (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                  <span>Pause</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleClear}
              disabled={!sessionView || sessionView.entries.length === 0}
              aria-label="Clear output display buffer"
              className="px-3 py-1 rounded-lg border border-app-border bg-app-surface text-app-fg hover:bg-app-surface-hover disabled:opacity-40 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5 text-app-muted-fg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
              <span>Clear</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              disabled={filteredEntries.length === 0}
              aria-label="Copy logs to clipboard"
              className="px-3 py-1 rounded-lg border border-app-border bg-app-surface text-app-fg hover:bg-app-surface-hover disabled:opacity-40 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-app-muted-fg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Log Viewer Container */}
        <div className="relative flex-1 bg-app-bg overflow-hidden flex flex-col">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            data-testid="log-terminal-viewport"
            className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed select-text space-y-1"
          >
            {loading ? (
              <div className="flex items-center justify-center h-full text-app-muted-fg">
                <svg className="animate-spin h-5 w-5 mr-2 text-indigo-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Loading log stream...
              </div>
            ) : !sessionView?.isLiveAvailable ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 text-app-muted-fg">
                <div className="h-12 w-12 rounded-2xl bg-app-surface border border-app-border flex items-center justify-center text-app-muted-fg mb-3">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 17l6-6-6-6M12 19h8" />
                  </svg>
                </div>
                <h4 className="text-sm font-semibold text-app-fg mb-1">Live Output Unavailable</h4>
                <p className="text-xs max-w-md leading-relaxed">
                  {sessionView?.unavailableReason ||
                    'Runara was not attached when this service started. Start the service via Runara to capture live output.'}
                </p>
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 text-app-muted-fg">
                <p className="text-xs">
                  {searchQuery ? 'No log lines matching search query.' : 'No output captured for this session yet.'}
                </p>
              </div>
            ) : (
              filteredEntries.map((entry, index) => {
                const isStderr = entry.stream === 'stderr';
                return (
                  <div
                    key={entry.id}
                    className={`flex items-start gap-3 hover:bg-app-surface/50 px-2 py-0.5 rounded transition-colors group ${
                      isStderr ? 'text-amber-600 dark:text-amber-300' : 'text-app-fg'
                    }`}
                  >
                    <span className="text-app-muted-fg/40 select-none text-[10px] w-8 text-right shrink-0 font-mono">
                      {index + 1}
                    </span>
                    <span className="text-app-muted-fg/70 select-none text-[11px] shrink-0 font-mono">
                      {entry.timestamp}
                    </span>
                    {isStderr && (
                      <span className="text-[10px] font-bold uppercase select-none px-1 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                        stderr
                      </span>
                    )}
                    <span className="break-all whitespace-pre-wrap flex-1">{entry.text}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Sticky Resume Autoscroll pill when user scrolls up */}
          {isUserScrolledUp && (
            <div className="absolute bottom-4 right-6 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <button
                type="button"
                onClick={scrollToBottom}
                aria-label="Scroll to newest log entries"
                className="px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 14l-7 7-7-7" />
                </svg>
                <span>Jump to latest</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="px-6 py-3 border-t border-app-border bg-app-surface/90 flex items-center justify-between text-xs text-app-muted-fg">
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span>
              Lines retained: <strong className="text-app-fg">{sessionView?.totalLines || 0}</strong> / 5,000
            </span>
            {isLive && (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live streaming active
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-app-fg bg-app-muted hover:bg-app-surface-hover border border-app-border rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
