import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { controlApi, identityApi, portApi } from '../lib/commands';
import type {
  ProcessIdentity,
  PortInfo,
  DashboardServer,
  ProcessTarget,
  ProcessControlError,
  ServerSortField,
  ServerSortDirection,
  ServerFilterOptions,
} from '../types';
import { deriveDashboardServers, filterServers, sortServers } from '../lib/serverUtils';
import { ServerList } from '../components/dashboard/ServerList';
import { ServerDetailsModal } from '../components/dashboard/ServerDetailsModal';
import { StopConfirmationModal } from '../components/dashboard/StopConfirmationModal';
import { ServerToolbar } from '../components/dashboard/ServerToolbar';
import { openUrl } from '@tauri-apps/plugin-opener';

const Servers: React.FC = () => {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [identities, setIdentities] = useState<ProcessIdentity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedServer, setSelectedServer] = useState<DashboardServer | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);

  // Process Control State (Milestone 5)
  const [stoppingPids, setStoppingPids] = useState<Set<number>>(new Set());
  const [serverToStop, setServerToStop] = useState<DashboardServer | null>(null);
  const [stopError, setStopError] = useState<ProcessControlError | string | null>(null);
  const [isExecutingStop, setIsExecutingStop] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<{
    type: 'success' | 'warning' | 'info';
    message: string;
  } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!feedbackToast) return;
    const timer = setTimeout(() => {
      setFeedbackToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [feedbackToast]);

  const [filters, setFilters] = useState<ServerFilterOptions>({
    environment: 'all',
    runtime: 'all',
    status: 'all',
  });
  const [sortField, setSortField] = useState<ServerSortField>('port');
  const [sortDirection, setSortDirection] = useState<ServerSortDirection>('asc');

  const refreshServers = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [fetchedPorts, fetchedIdentities] = await Promise.all([
        portApi.getListeningPorts(),
        identityApi.getProcessIdentities(),
      ]);
      setPorts(fetchedPorts);
      setIdentities(fetchedIdentities);
      setError(null);
    } catch (err) {
      console.error('Failed to discover servers:', err);
      setError(
        typeof err === 'string'
          ? err
          : 'Unable to inspect local development servers.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refreshServers();
  }, [refreshServers]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      refreshServers();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshServers]);

  const allServers = useMemo(() => {
    return deriveDashboardServers(ports, identities);
  }, [ports, identities]);

  const availableRuntimes = useMemo(() => {
    const set = new Set(allServers.map((s) => s.runtime).filter((r) => r !== 'Unknown'));
    return Array.from(set);
  }, [allServers]);

  const visibleServers = useMemo(() => {
    const filtered = filterServers(allServers, searchQuery, filters);
    return sortServers(filtered, sortField, sortDirection);
  }, [allServers, searchQuery, filters, sortField, sortDirection]);

  const isFiltered =
    searchQuery.trim() !== '' ||
    filters.environment !== 'all' ||
    filters.runtime !== 'all' ||
    filters.status !== 'all';

  const handleOpenBrowser = async (url: string) => {
    try {
      await openUrl(url);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleRequestStop = useCallback((server: DashboardServer) => {
    setServerToStop(server);
    setStopError(null);
  }, []);

  const handleConfirmStop = useCallback(
    async (force = false) => {
      if (!serverToStop) return;

      const target: ProcessTarget = {
        pid: serverToStop.pid,
        processName: serverToStop.processName,
        executablePath: serverToStop.executablePath,
        workingDirectory: serverToStop.workingDirectory,
        expectedPorts: serverToStop.allPorts,
        force,
      };

      setIsExecutingStop(true);
      setStoppingPids((prev) => new Set(prev).add(target.pid));

      try {
        const result = force
          ? await controlApi.forceStopServer(target)
          : await controlApi.stopServer(target);

        if (result.status === 'stopped') {
          setFeedbackToast({
            type: 'success',
            message: `Server "${serverToStop.name}" (PID ${target.pid}) stopped. Port ${result.releasedPorts.join(', ')} freed.`,
          });
          setServerToStop(null);
          setStopError(null);
          if (selectedServer?.pid === target.pid) {
            setSelectedServer(null);
          }
        } else if (result.status === 'port_owner_changed') {
          setFeedbackToast({
            type: 'warning',
            message: result.message,
          });
          setServerToStop(null);
          setStopError(null);
          if (selectedServer?.pid === target.pid) {
            setSelectedServer(null);
          }
        } else if (result.status === 'port_still_in_use') {
          setFeedbackToast({
            type: 'warning',
            message: result.message,
          });
          setServerToStop(null);
          setStopError(null);
        } else {
          setFeedbackToast({
            type: 'info',
            message: result.message,
          });
          setServerToStop(null);
        }

        await refreshServers();
      } catch (err: unknown) {
        console.error('Stop operation failed:', err);
        setStopError(err as ProcessControlError | string);
      } finally {
        setIsExecutingStop(false);
        setStoppingPids((prev) => {
          const next = new Set(prev);
          next.delete(target.pid);
          return next;
        });
      }
    },
    [serverToStop, selectedServer, refreshServers]
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Feedback Notification Banner */}
      {feedbackToast && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border text-xs animate-in fade-in slide-in-from-top-2 duration-200 ${
            feedbackToast.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-700/50 text-emerald-200'
              : feedbackToast.type === 'warning'
              ? 'bg-amber-950/70 border-amber-700/50 text-amber-200'
              : 'bg-blue-950/70 border-blue-700/50 text-blue-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackToast.type === 'success' ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-emerald-400 shrink-0"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-amber-400 shrink-0"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
            <span className="font-medium leading-relaxed">{feedbackToast.message}</span>
          </div>

          <button
            type="button"
            onClick={() => setFeedbackToast(null)}
            className="text-zinc-400 hover:text-zinc-100 p-1 rounded-md transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">
            Running Development Servers
          </h2>
          <p className="text-zinc-400 text-xs mt-1">
            Dedicated view of all detected active server processes, bound endpoints, and repository workspaces.
          </p>
        </div>
      </div>

      <ServerToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        onFilterChange={setFilters}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={setSortField}
        onToggleSortDirection={() =>
          setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
        }
        availableRuntimes={availableRuntimes}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={setAutoRefresh}
        onRefresh={() => refreshServers(true)}
        loading={loading}
        refreshing={refreshing}
      />

      <ServerList
        servers={visibleServers}
        totalServersCount={allServers.length}
        loading={loading}
        error={error}
        onRetry={() => refreshServers(true)}
        onInspect={setSelectedServer}
        onStop={handleRequestStop}
        onOpenBrowser={handleOpenBrowser}
        onClearFilters={() => {
          setSearchQuery('');
          setFilters({ environment: 'all', runtime: 'all', status: 'all' });
        }}
        isFiltered={isFiltered}
        stoppingServerPids={stoppingPids}
      />

      {selectedServer && (
        <ServerDetailsModal
          server={selectedServer}
          onClose={() => setSelectedServer(null)}
          onOpenBrowser={handleOpenBrowser}
          onStopServer={handleRequestStop}
          isStopping={stoppingPids.has(selectedServer.pid)}
        />
      )}

      {/* Stop Confirmation Modal */}
      {serverToStop && (
        <StopConfirmationModal
          server={serverToStop}
          isStopping={isExecutingStop}
          error={stopError}
          onConfirm={handleConfirmStop}
          onCancel={() => {
            setServerToStop(null);
            setStopError(null);
          }}
          onRefresh={async () => {
            setServerToStop(null);
            setStopError(null);
            await refreshServers(true);
          }}
        />
      )}
    </div>
  );
};

export default Servers;
