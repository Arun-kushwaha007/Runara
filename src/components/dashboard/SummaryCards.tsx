import React from 'react';
import type { WslDistribution } from '../../types';

interface SummaryCardsProps {
  runningServersCount: number;
  listeningPortsCount: number;
  processesCount: number;
  wslDistributions?: WslDistribution[];
  loading: boolean;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  runningServersCount,
  listeningPortsCount,
  processesCount,
  wslDistributions = [],
  loading,
}) => {
  const runningDistros = wslDistributions.filter((d) => d.state === 'running');
  const stoppedDistros = wslDistributions.filter((d) => d.state === 'stopped');

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      {/* 1. Running Servers */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Running Servers
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        </div>
        <div className="mt-2 text-2xl font-bold text-emerald-400 font-mono">
          {loading ? '...' : runningServersCount.toLocaleString()}
        </div>
        <div className="mt-1.5 text-[11px] text-zinc-500">
          Active development servers
        </div>
      </div>

      {/* 2. Listening Ports */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Listening Ports
          </span>
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
            className="text-blue-400"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="2" x2="22" y1="12" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </div>
        <div className="mt-2 text-2xl font-bold text-blue-400 font-mono">
          {loading ? '...' : listeningPortsCount.toLocaleString()}
        </div>
        <div className="mt-1.5 text-[11px] text-zinc-500">
          Discovered TCP sockets
        </div>
      </div>

      {/* 3. Discovered Processes */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Processes
          </span>
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
            className="text-purple-400"
          >
            <rect width="20" height="14" x="2" y="3" rx="2" />
            <line x1="8" x2="16" y1="21" y2="21" />
            <line x1="12" x2="12" y1="17" y2="21" />
          </svg>
        </div>
        <div className="mt-2 text-2xl font-bold text-zinc-100 font-mono">
          {loading ? '...' : processesCount.toLocaleString()}
        </div>
        <div className="mt-1.5 text-[11px] text-zinc-500">
          Enriched across environments
        </div>
      </div>

      {/* 4. WSL Distributions */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            WSL Distros
          </span>
          {runningDistros.length > 0 ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{runningDistros.length} Running</span>
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-800/80 px-1.5 py-0.5 rounded">
              {wslDistributions.length > 0 ? 'Stopped' : 'Unavailable'}
            </span>
          )}
        </div>
        <div className="mt-2 text-2xl font-bold text-purple-400 font-mono">
          {loading ? '...' : wslDistributions.length.toLocaleString()}
        </div>
        <div className="mt-1.5 text-[11px] text-zinc-500 truncate" title={
          wslDistributions.map(d => `${d.name} (${d.state})`).join(', ')
        }>
          {wslDistributions.length > 0
            ? `${runningDistros.length} running, ${stoppedDistros.length} stopped`
            : 'No WSL distributions detected'}
        </div>
      </div>
    </section>
  );
};
