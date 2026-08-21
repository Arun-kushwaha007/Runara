import React from 'react';

interface SummaryCardsProps {
  runningServersCount: number;
  listeningPortsCount: number;
  processesCount: number;
  loading: boolean;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  runningServersCount,
  listeningPortsCount,
  processesCount,
  loading,
}) => {
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

      {/* 3. Windows Processes */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Windows Processes
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
          Tracked OS process identities
        </div>
      </div>

      {/* 4. WSL (Coming Soon) */}
      <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-4 flex flex-col justify-between opacity-80">
        <div className="flex items-center justify-between text-zinc-500">
          <span className="text-xs font-semibold uppercase tracking-wider">
            WSL Environment
          </span>
          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
            Milestone 6
          </span>
        </div>
        <div className="mt-2 text-lg font-bold text-zinc-500 flex items-center gap-2">
          <span>Coming Soon</span>
        </div>
        <div className="mt-1.5 text-[11px] text-zinc-500">
          WSL discovery not connected yet
        </div>
      </div>
    </section>
  );
};
