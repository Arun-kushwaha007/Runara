import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { processApi, systemApi } from '../lib/commands';
import type { ProcessInfo, SystemInfo } from '../types';
import { ProcessTable, type SortField, type SortDirection } from '../components/processes/ProcessTable';
import { ProcessDetailsModal } from '../components/processes/ProcessDetailsModal';

const Dashboard: React.FC = () => {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedProcess, setSelectedProcess] = useState<ProcessInfo | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch process list from Rust backend via Tauri IPC
  const fetchProcesses = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    }
    try {
      const data = await processApi.getProcesses();
      setProcesses(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Process discovery failed:', err);
      setError(
        typeof err === 'string'
          ? err
          : 'Unable to inspect Windows processes. Access may be denied or process enumeration failed.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchProcesses();
    systemApi.getSystemInfo().then(setSysInfo).catch(console.error);
  }, [fetchProcesses]);

  // Optional polling (auto-refresh every 3 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchProcesses();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchProcesses]);

  // Handle column header sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter processes client-side based on search query
  const filteredProcesses = useMemo(() => {
    if (!searchQuery.trim()) return processes;
    const q = searchQuery.toLowerCase().trim();

    return processes.filter(p => {
      const matchPid = p.pid.toString().includes(q);
      const matchName = p.name.toLowerCase().includes(q);
      const matchParent = p.parentPid ? p.parentPid.toString().includes(q) : false;
      const matchCmd = p.commandLine ? p.commandLine.toLowerCase().includes(q) : false;
      const matchExe = p.executablePath ? p.executablePath.toLowerCase().includes(q) : false;
      const matchCwd = p.workingDirectory ? p.workingDirectory.toLowerCase().includes(q) : false;

      return matchPid || matchName || matchParent || matchCmd || matchExe || matchCwd;
    });
  }, [processes, searchQuery]);

  // Sort filtered processes
  const sortedProcesses = useMemo(() => {
    return [...filteredProcesses].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
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

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredProcesses, sortField, sortDirection]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Hero Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">Process Discovery</h2>
          <p className="text-zinc-400 text-sm mt-0.5">
            Discover and inspect active Windows processes across your local system.
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
            onClick={() => fetchProcesses(true)}
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
        <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4 flex flex-col justify-between">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Processes</div>
          <div className="mt-2 text-2xl font-bold text-zinc-100 font-mono">
            {loading ? '...' : processes.length.toLocaleString()}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500">
            {searchQuery ? `${filteredProcesses.length} matching search` : 'Windows active processes'}
          </div>
        </div>

        <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4 flex flex-col justify-between">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Operating System</div>
          <div className="mt-2 text-2xl font-bold text-zinc-100">
            {sysInfo ? sysInfo.platform : 'Windows'}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500">Native Windows x86_64</div>
        </div>

        <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4 flex flex-col justify-between">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Discovery Engine</div>
          <div className="mt-2 text-2xl font-bold text-emerald-400 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Rust Native
          </div>
          <div className="mt-2 text-[11px] text-zinc-500">Tauri IPC / sysinfo</div>
        </div>

        <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4 flex flex-col justify-between">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Last Updated</div>
          <div className="mt-2 text-sm font-mono text-zinc-200">
            {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Pending'}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500">
            {autoRefresh ? 'Live Polling Active' : 'Manual refresh mode'}
          </div>
        </div>
      </section>

      {/* Process Discovery Section */}
      <section className="space-y-4">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
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
              placeholder="Search processes by name, PID, command, path, working directory..."
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

          <div className="text-xs text-zinc-400 flex items-center gap-2 self-end sm:self-auto">
            <span>
              Showing <strong className="text-zinc-200">{sortedProcesses.length}</strong> of{' '}
              <strong className="text-zinc-200">{processes.length}</strong> processes
            </span>
          </div>
        </div>

        {/* Dynamic Content Area: Loading, Error, Empty, or Table */}
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
            <p className="text-sm text-zinc-300 font-medium">Loading Windows processes...</p>
            <p className="text-xs text-zinc-500">Querying system process table via Rust native API</p>
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
              <h4 className="text-sm font-semibold text-red-300">Unable to inspect Windows processes</h4>
              <p className="text-xs text-red-400/80 mt-1 max-w-md">{error}</p>
            </div>
            <button
              onClick={() => fetchProcesses(true)}
              className="mt-2 px-4 py-1.5 bg-red-800 hover:bg-red-700 text-red-100 text-xs font-medium rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        ) : processes.length === 0 ? (
          <div className="border border-dashed border-zinc-800 rounded-xl p-16 text-center bg-zinc-900/30">
            <p className="text-sm text-zinc-300 font-medium">No processes detected</p>
            <p className="text-xs text-zinc-500 mt-1">The system returned 0 processes.</p>
          </div>
        ) : (
          <ProcessTable
            processes={sortedProcesses}
            onSelectProcess={setSelectedProcess}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        )}
      </section>

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
