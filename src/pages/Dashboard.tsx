import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { controlApi, identityApi, portApi, systemApi, unifiedApi, profileApi } from '../lib/commands';
import type {
  ProcessIdentity,
  PortInfo,
  JoinedPortProcess,
  SystemInfo,
  DashboardServer,
  ServerSortField,
  ServerSortDirection,
  ServerFilterOptions,
  Runtime,
  ProcessTarget,
  ProcessControlError,
  WslDistribution,
  DiscoveryDiagnostic,
  ServerProfile,
  CreateProfileRequest,
} from '../types';
import { deriveDashboardServers, filterServers, sortServers, annotateWithProfiles } from '../lib/serverUtils';
import { SummaryCards } from '../components/dashboard/SummaryCards';
import { ServerToolbar } from '../components/dashboard/ServerToolbar';
import { ServerList } from '../components/dashboard/ServerList';
import { ServerDetailsModal } from '../components/dashboard/ServerDetailsModal';
import { StopConfirmationModal } from '../components/dashboard/StopConfirmationModal';
import { AdoptionFormModal } from '../components/adoption/AdoptionFormModal';
import { PortTable, type PortSortField, type SortDirection as PortSortDirection } from '../components/ports/PortTable';
import { PortDetailsModal } from '../components/ports/PortDetailsModal';
import { ProcessTable, type ProcessSortField, type SortDirection as ProcessSortDirection } from '../components/processes/ProcessTable';
import { ProcessDetailsModal } from '../components/processes/ProcessDetailsModal';
import { openUrl } from '@tauri-apps/plugin-opener';

type DashboardTab = 'servers' | 'ports' | 'processes';

const STANDARD_RUNTIMES: Runtime[] = [
  'Node.js',
  'Python',
  'Rust',
  '.NET',
  'Java',
  'Go',
  'Unknown',
];

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('servers');
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [identities, setIdentities] = useState<ProcessIdentity[]>([]);
  const [profiles, setProfiles] = useState<ServerProfile[]>([]);
  const [wslDistros, setWslDistros] = useState<WslDistribution[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiscoveryDiagnostic[]>([]);
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dismissedDiagnostics, setDismissedDiagnostics] = useState<boolean>(false);

  // Server Filters & Sorting
  const [filters, setFilters] = useState<ServerFilterOptions>({
    environment: 'all',
    runtime: 'all',
    status: 'all',
    managedStatus: 'all',
  });
  const [sortField, setSortField] = useState<ServerSortField>('port');
  const [sortDirection, setSortDirection] = useState<ServerSortDirection>('asc');

  // Port sorting state (for advanced Ports tab)
  const [portSortField, setPortSortField] = useState<PortSortField>('port');
  const [portSortDirection, setPortSortDirection] = useState<PortSortDirection>('asc');

  // Process sorting state (for advanced Processes tab)
  const [processSortField, setProcessSortField] = useState<ProcessSortField>('name');
  const [processSortDirection, setProcessSortDirection] = useState<ProcessSortDirection>('asc');

  // Modal selections
  const [selectedServer, setSelectedServer] = useState<DashboardServer | null>(null);
  const [selectedPortItem, setSelectedPortItem] = useState<JoinedPortProcess | null>(null);
  const [selectedIdentity, setSelectedIdentity] = useState<ProcessIdentity | null>(null);

  // Server Adoption State (Milestone 8)
  const [serverToAdopt, setServerToAdopt] = useState<DashboardServer | null>(null);
  const [isSavingAdoption, setIsSavingAdoption] = useState<boolean>(false);

  // Auto-refresh & timestamp
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Process Control State (Milestone 5)
  const [stoppingPids, setStoppingPids] = useState<Set<number>>(new Set());
  const [serverToStop, setServerToStop] = useState<DashboardServer | null>(null);
  const [stopError, setStopError] = useState<ProcessControlError | string | null>(null);
  const [isExecutingStop, setIsExecutingStop] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<{
    type: 'success' | 'warning' | 'info';
    message: string;
  } | null>(null);

  // Auto-dismiss toast after 6 seconds
  useEffect(() => {
    if (!feedbackToast) return;
    const timer = setTimeout(() => {
      setFeedbackToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [feedbackToast]);

  // Fetch unified snapshot across Windows and WSL distributions + Server Profiles
  const refreshAll = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    }
    try {
      // Fetch saved profiles in parallel with discovery snapshot
      const fetchProfilesPromise = profileApi.getProfiles().catch((profileErr) => {
        console.warn('Failed to load server profiles for association:', profileErr);
        return [] as ServerProfile[];
      });

      // Try unified discovery endpoint
      try {
        const [snapshot, loadedProfiles] = await Promise.all([
          unifiedApi.getUnifiedSnapshot(),
          fetchProfilesPromise,
        ]);
        setPorts(snapshot.ports);
        setIdentities(snapshot.identities);
        setWslDistros(snapshot.distributions);
        setDiagnostics(snapshot.diagnostics);
        setProfiles(loadedProfiles);
      } catch (unifiedErr) {
        console.warn('Unified snapshot failed, falling back to legacy port & identity API:', unifiedErr);
        const [fetchedPorts, fetchedIdentities, loadedProfiles] = await Promise.all([
          portApi.getListeningPorts(),
          identityApi.getProcessIdentities(),
          fetchProfilesPromise,
        ]);
        setPorts(fetchedPorts);
        setIdentities(fetchedIdentities);
        setProfiles(loadedProfiles);
      }

      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('System discovery failed:', err);
      setError(
        typeof err === 'string'
          ? err
          : 'Unable to inspect local development servers. Access may be restricted.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Request Stop Confirmation
  const handleRequestStop = useCallback((server: DashboardServer) => {
    if (server.environment?.type === 'wsl') {
      setFeedbackToast({
        type: 'info',
        message: 'WSL process control is read-only in Milestone 6. Direct termination of Linux processes is restricted.',
      });
      return;
    }
    setServerToStop(server);
    setStopError(null);
  }, []);

  // Execute Stop Server Flow
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
        environment: serverToStop.environment,
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

        // Trigger immediate background discovery refresh
        await refreshAll();
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
    [serverToStop, selectedServer, refreshAll]
  );

  // Initial load
  useEffect(() => {
    refreshAll();
    systemApi.getSystemInfo().then(setSysInfo).catch(console.error);
  }, [refreshAll]);

  // Auto-refresh polling (every 3 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      refreshAll();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshAll]);

  // Derive DashboardServer views in O(P + S) time and annotate with profile associations
  const allServers = useMemo(() => {
    const rawServers = deriveDashboardServers(ports, identities);
    return annotateWithProfiles(rawServers, profiles);
  }, [ports, identities, profiles]);

  // Extract available runtimes for dynamic filter dropdown
  const availableRuntimes = useMemo<Runtime[]>(() => {
    const detected = new Set<Runtime>();
    for (const server of allServers) {
      if (server.runtime !== 'Unknown') {
        detected.add(server.runtime);
      }
    }
    for (const r of STANDARD_RUNTIMES) {
      detected.add(r);
    }
    return Array.from(detected);
  }, [allServers]);

  // Client-side filtering
  const filteredServers = useMemo(() => {
    return filterServers(allServers, searchQuery, filters);
  }, [allServers, searchQuery, filters]);

  // Client-side sorting
  const visibleServers = useMemo(() => {
    return sortServers(filteredServers, sortField, sortDirection);
  }, [filteredServers, sortField, sortDirection]);

  // Check if filtering is active
  const isFiltered = useMemo(() => {
    return (
      searchQuery.trim().length > 0 ||
      filters.environment !== 'all' ||
      filters.runtime !== 'all' ||
      filters.status !== 'all' ||
      (Boolean(filters.managedStatus) && filters.managedStatus !== 'all')
    );
  }, [searchQuery, filters]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setFilters({ environment: 'all', runtime: 'all', status: 'all', managedStatus: 'all' });
  };

  const handleToggleSortDirection = () => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  // Adopt server flow (Milestone 8)
  const handleAdoptServer = useCallback((server: DashboardServer) => {
    setServerToAdopt(server);
  }, []);

  const handleSaveAdoption = async (req: CreateProfileRequest) => {
    setIsSavingAdoption(true);
    try {
      await profileApi.createProfile(req);
      setServerToAdopt(null);
      setFeedbackToast({
        type: 'success',
        message: `Server adopted as profile "${req.name}" successfully.`,
      });
      await refreshAll();
    } catch (err) {
      console.error('Failed to adopt server:', err);
      throw err;
    } finally {
      setIsSavingAdoption(false);
    }
  };

  const handleOpenBrowser = async (url: string) => {
    try {
      await openUrl(url);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Efficient Process Identity Map for Ports Tab
  const identityMap = useMemo(() => {
    const map = new Map<string, ProcessIdentity>();
    for (const id of identities) {
      const key = id.environment?.type === 'wsl'
        ? `wsl:${id.environment.distro}:${id.process.pid}`
        : `win:${id.process.pid}`;
      map.set(key, id);
    }
    return map;
  }, [identities]);

  // Efficient Port -> Process Identity Join for Ports Tab
  const joinedEndpoints = useMemo<JoinedPortProcess[]>(() => {
    return ports.map((port) => {
      const key = port.environment?.type === 'wsl'
        ? `wsl:${port.environment.distro}:${port.pid}`
        : `win:${port.pid}`;
      const id = identityMap.get(key);
      return {
        port,
        process: id ? id.process : null,
        identity: id ?? null,
      };
    });
  }, [ports, identityMap]);

  // Filter & sort for raw ports tab
  const sortedEndpoints = useMemo(() => {
    let list = joinedEndpoints;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(({ port, process, identity }) => {
        return (
          port.port.toString().includes(q) ||
          port.pid.toString().includes(q) ||
          port.address.toLowerCase().includes(q) ||
          port.protocol.toLowerCase().includes(q) ||
          (process ? process.name.toLowerCase().includes(q) : false) ||
          (process?.commandLine ? process.commandLine.toLowerCase().includes(q) : false) ||
          (process?.workingDirectory ? process.workingDirectory.toLowerCase().includes(q) : false) ||
          (identity?.runtime ? identity.runtime.toLowerCase().includes(q) : false)
        );
      });
    }

    return [...list].sort((a, b) => {
      let comparison = 0;
      switch (portSortField) {
        case 'port':
          comparison = a.port.port - b.port.port;
          break;
        case 'pid':
          comparison = a.port.pid - b.port.pid;
          break;
        case 'address':
          comparison = a.port.address.localeCompare(b.port.address);
          break;
        case 'protocol':
          comparison = a.port.protocol.localeCompare(b.port.protocol);
          break;
        case 'process': {
          const nameA = a.process?.name ?? '';
          const nameB = b.process?.name ?? '';
          comparison = nameA.localeCompare(nameB);
          break;
        }
        case 'runtime': {
          const runA = a.identity?.runtime ?? '';
          const runB = b.identity?.runtime ?? '';
          comparison = runA.localeCompare(runB);
          break;
        }
        case 'command': {
          const cmdA = a.process?.commandLine ?? '';
          const cmdB = b.process?.commandLine ?? '';
          comparison = cmdA.localeCompare(cmdB);
          break;
        }
      }
      return portSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [joinedEndpoints, searchQuery, portSortField, portSortDirection]);

  // Filter & sort for raw processes tab
  const sortedIdentities = useMemo(() => {
    let list = identities;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((id) => {
        const p = id.process;
        return (
          p.pid.toString().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          id.runtime.toLowerCase().includes(q) ||
          id.packageManager.toLowerCase().includes(q) ||
          (p.commandLine ? p.commandLine.toLowerCase().includes(q) : false) ||
          (p.workingDirectory ? p.workingDirectory.toLowerCase().includes(q) : false) ||
          id.listeningPorts.some((port) => port.toString().includes(q))
        );
      });
    }

    return [...list].sort((a, b) => {
      let comparison = 0;
      switch (processSortField) {
        case 'pid':
          comparison = a.process.pid - b.process.pid;
          break;
        case 'name':
          comparison = a.process.name.localeCompare(b.process.name, undefined, { sensitivity: 'base' });
          break;
        case 'runtime':
          comparison = a.runtime.localeCompare(b.runtime);
          break;
        case 'packageManager':
          comparison = a.packageManager.localeCompare(b.packageManager);
          break;
        case 'ports': {
          const portA = a.listeningPorts[0] ?? 0;
          const portB = b.listeningPorts[0] ?? 0;
          comparison = portA - portB;
          break;
        }
        case 'commandLine': {
          const cmdA = a.process.commandLine ?? '';
          const cmdB = b.process.commandLine ?? '';
          comparison = cmdA.localeCompare(cmdB);
          break;
        }
      }
      return processSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [identities, searchQuery, processSortField, processSortDirection]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Feedback Toast / Notification Banner */}
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

      {/* WSL Diagnostics Alert Banner (Graceful Degradation) */}
      {diagnostics.length > 0 && !dismissedDiagnostics && (
        <div className="flex items-center justify-between p-4 rounded-xl border border-amber-800/60 bg-amber-950/40 text-amber-200 text-xs">
          <div className="flex items-center gap-2.5">
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
            <div>
              <span className="font-semibold">WSL Telemetry Notice:</span>{' '}
              <span>
                {diagnostics.map((d) => `${d.distribution ?? d.source} (${d.operation}): ${d.error}`).join('; ')}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissedDiagnostics(true)}
            className="text-amber-400 hover:text-amber-100 px-2 py-1 rounded hover:bg-amber-900/40 transition-colors shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Dashboard Hero Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">
              Local Development Control Center
            </h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-950/80 text-blue-300 border border-blue-800/50">
              {sysInfo ? sysInfo.platform : 'Windows + WSL'}
            </span>
          </div>
          <p className="text-zinc-400 text-xs mt-1">
            Unified discovery, port ownership, process ancestry, and server inspection across Windows and WSL distributions.
          </p>
        </div>

        {/* Status & Last Updated */}
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <div className="text-right">
            <div className="text-[11px] text-zinc-500 font-medium">Last updated</div>
            <div className="font-mono text-zinc-300">
              {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Pending'}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <SummaryCards
        runningServersCount={allServers.length}
        listeningPortsCount={ports.length}
        processesCount={identities.length}
        wslDistributions={wslDistros}
        loading={loading}
      />

      {/* Main View Tabs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            {/* 1. Development Servers Tab (Primary View) */}
            <button
              type="button"
              onClick={() => setActiveTab('servers')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'servers'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
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
                <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
                <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
                <line x1="6" x2="6.01" y1="6" y2="6" />
                <line x1="6" x2="6.01" y1="18" y2="18" />
              </svg>
              <span>Development Servers ({allServers.length})</span>
            </button>

            {/* 2. Raw Listening Ports Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('ports')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'ports'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
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
                <circle cx="12" cy="12" r="10" />
                <line x1="2" x2="22" y1="12" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>Listening Ports ({ports.length})</span>
            </button>

            {/* 3. Raw Process Identities Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('processes')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'processes'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
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
                <rect width="7" height="9" x="3" y="3" rx="1" />
                <rect width="7" height="5" x="14" y="3" rx="1" />
                <rect width="7" height="9" x="14" y="12" rx="1" />
                <rect width="7" height="5" x="3" y="16" rx="1" />
              </svg>
              <span>Process Identities ({identities.length})</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Development Servers View */}
        {activeTab === 'servers' && (
          <div className="space-y-4">
            <ServerToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filters={filters}
              onFilterChange={setFilters}
              sortField={sortField}
              sortDirection={sortDirection}
              onSortChange={setSortField}
              onToggleSortDirection={handleToggleSortDirection}
              availableRuntimes={availableRuntimes}
              wslDistributions={wslDistros}
              autoRefresh={autoRefresh}
              onToggleAutoRefresh={setAutoRefresh}
              onRefresh={() => refreshAll(true)}
              loading={loading}
              refreshing={refreshing}
            />

            <ServerList
              servers={visibleServers}
              totalServersCount={allServers.length}
              loading={loading}
              error={error}
              onRetry={() => refreshAll(true)}
              onInspect={setSelectedServer}
              onStop={handleRequestStop}
              onAdopt={handleAdoptServer}
              onOpenBrowser={handleOpenBrowser}
              onClearFilters={handleClearFilters}
              isFiltered={isFiltered}
              stoppingServerPids={stoppingPids}
            />
          </div>
        )}

        {/* Tab 2: Raw Listening Ports View */}
        {activeTab === 'ports' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search listening ports by port, PID, process, runtime, command..."
                className="w-full max-w-md bg-zinc-900 border border-zinc-700/60 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <PortTable
              items={sortedEndpoints}
              onSelectItem={setSelectedPortItem}
              sortField={portSortField}
              sortDirection={portSortDirection}
              onSort={(field) => {
                if (portSortField === field) {
                  setPortSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                } else {
                  setPortSortField(field);
                  setPortSortDirection('asc');
                }
              }}
            />
          </div>
        )}

        {/* Tab 3: Raw Process Identities View */}
        {activeTab === 'processes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search processes by name, PID, runtime, package manager, command..."
                className="w-full max-w-md bg-zinc-900 border border-zinc-700/60 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <ProcessTable
              identities={sortedIdentities}
              onSelectIdentity={setSelectedIdentity}
              sortField={processSortField}
              sortDirection={processSortDirection}
              onSort={(field) => {
                if (processSortField === field) {
                  setProcessSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                } else {
                  setProcessSortField(field);
                  setProcessSortDirection('asc');
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Selected Server Details Modal */}
      {selectedServer && (
        <ServerDetailsModal
          server={selectedServer}
          onClose={() => setSelectedServer(null)}
          onOpenBrowser={handleOpenBrowser}
          onStopServer={handleRequestStop}
          onAdopt={handleAdoptServer}
          isStopping={stoppingPids.has(selectedServer.pid)}
        />
      )}

      {/* Server Adoption Modal (Milestone 8) */}
      {serverToAdopt && (
        <AdoptionFormModal
          server={serverToAdopt}
          isSaving={isSavingAdoption}
          onSave={handleSaveAdoption}
          onClose={() => setServerToAdopt(null)}
        />
      )}

      {/* Stop Server Confirmation Modal (Milestone 5) */}
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
            await refreshAll(true);
          }}
        />
      )}

      {/* Port Modal for raw ports tab */}
      {selectedPortItem && (
        <PortDetailsModal
          item={selectedPortItem}
          onClose={() => setSelectedPortItem(null)}
        />
      )}

      {/* Process Modal for raw processes tab */}
      {selectedIdentity && (
        <ProcessDetailsModal
          identity={selectedIdentity}
          onClose={() => setSelectedIdentity(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
