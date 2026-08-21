import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { processApi, portApi, systemApi } from '../lib/commands';
import type { ProcessInfo, PortInfo, JoinedPortProcess, SystemInfo } from '../types';
import { PortTable, type PortSortField, type SortDirection as PortSortDirection } from '../components/ports/PortTable';
import { PortDetailsModal } from '../components/ports/PortDetailsModal';
import { ProcessTable, type SortField as ProcessSortField, type SortDirection as ProcessSortDirection } from '../components/processes/ProcessTable';
import { ProcessDetailsModal } from '../components/processes/ProcessDetailsModal';

type ActiveView = 'ports' | 'processes';

const Dashboard: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>('ports');
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Port sorting state
  const [portSortField, setPortSortField] = useState<PortSortField>('port');
  const [portSortDirection, setPortSortDirection] = useState<PortSortDirection>('asc');
  
  // Process sorting state
  const [processSortField, setProcessSortField] = useState<ProcessSortField>('name');
  const [processSortDirection, setProcessSortDirection] = useState<ProcessSortDirection>('asc');

  // Selected item modals
  const [selectedPortItem, setSelectedPortItem] = useState<JoinedPortProcess | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<ProcessInfo | null>(null);

  // Auto-refresh & timestamp
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch listening ports and processes concurrently
  const refreshAll = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    }
    try {
      const [fetchedPorts, fetchedProcesses] = await Promise.all([
        portApi.getListeningPorts(),
        processApi.getProcesses(),
      ]);

      setPorts(fetchedPorts);
      setProcesses(fetchedProcesses);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('System discovery failed:', err);
      setError(
        typeof err === 'string'
          ? err
          : 'Unable to inspect Windows ports or processes. Access may be restricted.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  // Efficient O(P) Process Map construction
  const processMap = useMemo(() => {
    const map = new Map<number, ProcessInfo>();
    for (const proc of processes) {
      map.set(proc.pid, proc);
    }
    return map;
  }, [processes]);

  // Efficient O(S) Port -> Process Join
  const joinedEndpoints = useMemo<JoinedPortProcess[]>(() => {
    return ports.map((port) => ({
      port,
      process: processMap.get(port.pid) ?? null,
    }));
  }, [ports, processMap]);

  // Handle Port Sort
  const handlePortSort = (field: PortSortField) => {
    if (portSortField === field) {
      setPortSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setPortSortField(field);
      setPortSortDirection('asc');
    }
  };

  // Handle Process Sort
  const handleProcessSort = (field: ProcessSortField) => {
    if (processSortField === field) {
      setProcessSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setProcessSortField(field);
      setProcessSortDirection('asc');
    }
  };

  // Filter Port Endpoints client-side
  const filteredEndpoints = useMemo(() => {
    if (!searchQuery.trim()) return joinedEndpoints;
    const q = searchQuery.toLowerCase().trim();

    return joinedEndpoints.filter(({ port, process }) => {
      const matchPort = port.port.toString().includes(q);
      const matchPid = port.pid.toString().includes(q);
      const matchAddress = port.address.toLowerCase().includes(q);
      const matchProtocol = port.protocol.toLowerCase().includes(q);
      const matchName = process ? process.name.toLowerCase().includes(q) : false;
      const matchCmd = process?.commandLine ? process.commandLine.toLowerCase().includes(q) : false;
      const matchCwd = process?.workingDirectory ? process.workingDirectory.toLowerCase().includes(q) : false;

      return matchPort || matchPid || matchAddress || matchProtocol || matchName || matchCmd || matchCwd;
    });
  }, [joinedEndpoints, searchQuery]);

  // Sort Port Endpoints
  const sortedEndpoints = useMemo(() => {
    return [...filteredEndpoints].sort((a, b) => {
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
        case 'command': {
          const cmdA = a.process?.commandLine ?? '';
          const cmdB = b.process?.commandLine ?? '';
          comparison = cmdA.localeCompare(cmdB);
          break;
        }
      }

      return portSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredEndpoints, portSortField, portSortDirection]);

  // Filter Processes client-side
  const filteredProcesses = useMemo(() => {
    if (!searchQuery.trim()) return processes;
    const q = searchQuery.toLowerCase().trim();

    return processes.filter((p) => {
      const matchPid = p.pid.toString().includes(q);
      const matchName = p.name.toLowerCase().includes(q);
      const matchParent = p.parentPid ? p.parentPid.toString().includes(q) : false;
      const matchCmd = p.commandLine ? p.commandLine.toLowerCase().includes(q) : false;
      const matchExe = p.executablePath ? p.executablePath.toLowerCase().includes(q) : false;
      const matchCwd = p.workingDirectory ? p.workingDirectory.toLowerCase().includes(q) : false;

      return matchPid || matchName || matchParent || matchCmd || matchExe || matchCwd;
    });
  }, [processes, searchQuery]);

  // Sort Processes
  const sortedProcesses = useMemo(() => {
    return [...filteredProcesses].sort((a, b) => {
      let comparison = 0;

      switch (processSortField) {
        case 'pid':
          comparison = a.pid - b.pid;
          break;
        case 'parentPid':
          comparison = (a.parentPid ?? 0) - (b.parentPid ?? 0);
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          break;
        case 'commandLine': {
          const cmdA = a.commandLine ?? '';
          const cmdB = b.commandLine ?? '';
          comparison = cmdA.localeCompare(cmdB);
          break;
        }
      }

      return processSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredProcesses, processSortField, processSortDirection]);

  // Unique owning processes for ports
  const uniquePortPids = useMemo(() => {
    const pids = new Set<number>();
    for (const p of ports) {
      pids.add(p.pid);
    }
    return pids.size;
  }, [ports]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Hero Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">System Discovery</h2>
          <p className="text-zinc-400 text-sm mt-0.5">
            Discover active Windows listening TCP ports and running processes with PID mapping.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto Refresh Toggle */}
          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer bg-zinc-800/40 border border-zinc-700/50 px-3 py-2 rounded-lg hover:bg-zinc-800/70 transition-colors select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded bg-zinc-900 border-zinc-700 text-blue-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>Auto-refresh (3s)</span>
          </label>

          {/* Refresh Button */}
          <button
            onClick={() => refreshAll(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors shadow-xs"
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
              className={refreshing ? 'animate-spin' : ''}
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Listening Ports */}
        <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4 flex flex-col justify-between">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Listening TCP Ports</div>
          <div className="mt-2 text-2xl font-bold text-blue-400 font-mono">
            {loading ? '...' : ports.length.toLocaleString()}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500">
            {searchQuery && activeView === 'ports'
              ? `${filteredEndpoints.length} matching search`
              : `Across ${uniquePortPids} distinct processes`}
          </div>
        </div>

        {/* Total Windows Processes */}
        <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4 flex flex-col justify-between">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Processes</div>
          <div className="mt-2 text-2xl font-bold text-zinc-100 font-mono">
            {loading ? '...' : processes.length.toLocaleString()}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500">
            {searchQuery && activeView === 'processes'
              ? `${filteredProcesses.length} matching search`
              : 'Windows active processes'}
          </div>
        </div>

        {/* Discovery Engine */}
        <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4 flex flex-col justify-between">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Discovery Engine</div>
          <div className="mt-2 text-2xl font-bold text-emerald-400 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Rust Native
          </div>
          <div className="mt-2 text-[11px] text-zinc-500">
            {sysInfo ? sysInfo.platform : 'Windows'} • IP Helper + sysinfo
          </div>
        </div>

        {/* Last Updated */}
        <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4 flex flex-col justify-between">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Last Updated</div>
          <div className="mt-2 text-sm font-mono text-zinc-200">
            {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Pending'}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500">
            {autoRefresh ? 'Live Polling Active (3s)' : 'Manual refresh mode'}
          </div>
        </div>
      </section>

      {/* View Switcher Tabs & Search Toolbar */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveView('ports')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeView === 'ports'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
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
              <span>Listening Ports ({ports.length})</span>
            </button>

            <button
              onClick={() => setActiveView('processes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeView === 'processes'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
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
              <span>All Processes ({processes.length})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeView === 'ports'
                  ? 'Search by port (e.g. 3000), PID, process, address, command...'
                  : 'Search by name, PID, command, path, working directory...'
              }
              className="w-full bg-zinc-800/50 border border-zinc-700/60 rounded-lg pl-9 pr-8 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-400 hover:text-zinc-200"
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
            )}
          </div>
        </div>

        {/* Dynamic Content Area: Loading, Error, Empty, or Active Table */}
        {loading ? (
          <div className="border border-zinc-800 rounded-xl p-16 text-center bg-zinc-900/30 flex flex-col items-center justify-center gap-3">
            <svg
              className="animate-spin h-7 w-7 text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <p className="text-sm text-zinc-300 font-medium">Discovering Windows ports and processes...</p>
            <p className="text-xs text-zinc-500">Querying Win32 IP Helper and process subsystems via Rust</p>
          </div>
        ) : error ? (
          <div className="border border-red-900/60 bg-red-950/20 rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-900/40 text-red-400 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-red-300">System discovery failed</h4>
              <p className="text-xs text-red-400/80 mt-1 max-w-md">{error}</p>
            </div>
            <button
              onClick={() => refreshAll(true)}
              className="mt-2 px-4 py-1.5 bg-red-800 hover:bg-red-700 text-red-100 text-xs font-medium rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        ) : activeView === 'ports' ? (
          <PortTable
            items={sortedEndpoints}
            onSelectItem={setSelectedPortItem}
            sortField={portSortField}
            sortDirection={portSortDirection}
            onSort={handlePortSort}
          />
        ) : (
          <ProcessTable
            processes={sortedProcesses}
            onSelectProcess={setSelectedProcess}
            sortField={processSortField}
            sortDirection={processSortDirection}
            onSort={handleProcessSort}
          />
        )}
      </section>

      {/* Port Details Modal */}
      {selectedPortItem && (
        <PortDetailsModal
          item={selectedPortItem}
          onClose={() => setSelectedPortItem(null)}
        />
      )}

      {/* Process Details Modal */}
      {selectedProcess && (
        <ProcessDetailsModal
          process={selectedProcess}
          onClose={() => setSelectedProcess(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
