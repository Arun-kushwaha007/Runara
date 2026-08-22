import React from 'react';
import type { DashboardServer } from '../../types';
import { CopyButton } from '../common/CopyButton';
import { getBrowserUrl } from '../../lib/serverUtils';

interface ServerCardProps {
  server: DashboardServer;
  onInspect: (server: DashboardServer) => void;
  onStop?: (server: DashboardServer) => void;
  onOpenBrowser?: (url: string) => void;
  isStopping?: boolean;
}

export const ServerCard: React.FC<ServerCardProps> = ({
  server,
  onInspect,
  onStop,
  onOpenBrowser,
  isStopping = false,
}) => {
  const browserUrl = getBrowserUrl(server.address, server.primaryPort);
  const extraPortsCount = server.allPorts.length - 1;
  const isWsl = server.environment?.type === 'wsl';

  const handleOpenBrowser = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenBrowser) {
      onOpenBrowser(browserUrl);
    } else {
      window.open(browserUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onStop && !isStopping && !isWsl) {
      onStop(server);
    }
  };

  return (
    <div
      onClick={() => onInspect(server)}
      className="group relative bg-zinc-900/60 hover:bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 rounded-xl p-5 transition-all duration-150 flex flex-col justify-between gap-4 cursor-pointer shadow-xs hover:shadow-md"
    >
      {/* Header: Title + Status + Environment */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3
              className="text-base font-bold text-zinc-100 group-hover:text-blue-400 transition-colors truncate tracking-tight"
              title={server.name}
            >
              {server.name}
            </h3>

            {/* Sub-header: Runtime & Package Manager & Environment */}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {server.runtime !== 'Unknown' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-950/60 text-blue-300 border border-blue-800/40">
                  <span>{server.runtime}</span>
                  {server.packageManager !== 'Unknown' && (
                    <>
                      <span className="text-blue-500">•</span>
                      <span className="text-blue-200 font-semibold">{server.packageManager}</span>
                    </>
                  )}
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                  Process
                </span>
              )}

              {/* Environment badge */}
              {isWsl ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-950/60 text-purple-300 border border-purple-800/40">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-purple-400"
                  >
                    <polyline points="4 17 10 11 4 5" />
                    <line x1="12" y1="19" x2="20" y2="19" />
                  </svg>
                  <span>WSL / {server.wslDistro || 'Linux'}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-950/40 text-blue-300/90 border border-blue-800/30">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-blue-400"
                  >
                    <rect width="20" height="14" x="2" y="3" rx="2" />
                    <line x1="8" x2="16" y1="21" y2="21" />
                    <line x1="12" x2="12" y1="17" y2="21" />
                  </svg>
                  <span>Windows</span>
                </span>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <div className="shrink-0">
            {isStopping ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/70 text-amber-300 border border-amber-700/50 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                <span>STOPPING...</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>RUNNING</span>
              </span>
            )}
          </div>
        </div>

        {/* Primary Port & Endpoint Banner */}
        <div className="mt-3.5 flex items-center justify-between bg-zinc-950/60 border border-zinc-800/90 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
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
            <span className="text-xs font-mono font-semibold text-zinc-100">
              localhost:{server.primaryPort}
            </span>
            {extraPortsCount > 0 && (
              <span
                className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700"
                title={`Additional ports: ${server.allPorts.slice(1).join(', ')}`}
              >
                +{extraPortsCount} {extraPortsCount === 1 ? 'port' : 'ports'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleOpenBrowser}
              title={`Open ${browserUrl} in browser`}
              className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-xs font-medium rounded transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Open</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" x2="21" y1="14" y2="3" />
              </svg>
            </button>
            <div onClick={(e) => e.stopPropagation()}>
              <CopyButton
                textToCopy={browserUrl}
                showIconOnly
                title="Copy browser URL to clipboard"
              />
            </div>
          </div>
        </div>

        {/* Process Metadata Details */}
        <div className="mt-3 space-y-1.5 text-xs">
          {/* Working Directory */}
          <div className="flex items-center justify-between text-zinc-400 gap-2">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium shrink-0">
              Workspace
            </span>
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="font-mono text-zinc-300 truncate text-[11px]"
                title={server.workingDirectory ?? 'Unavailable'}
              >
                {server.workingDirectory ?? 'Unavailable'}
              </span>
              {server.workingDirectory && (
                <div onClick={(e) => e.stopPropagation()}>
                  <CopyButton
                    textToCopy={server.workingDirectory}
                    showIconOnly
                    title="Copy working directory path"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Command Line */}
          <div className="flex items-center justify-between text-zinc-400 gap-2">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium shrink-0">
              Cmd
            </span>
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="font-mono text-zinc-300 truncate text-[11px]"
                title={server.commandLine ?? 'Unavailable'}
              >
                {server.commandLine ?? 'Unavailable'}
              </span>
              {server.commandLine && (
                <div onClick={(e) => e.stopPropagation()}>
                  <CopyButton
                    textToCopy={server.commandLine}
                    showIconOnly
                    title="Copy command line"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer: PID + Inspect & Stop Buttons */}
      <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs gap-2">
        <div className="flex items-center gap-2 text-zinc-400 min-w-0">
          <span className="font-mono font-medium text-zinc-300 shrink-0">
            PID {server.pid}
          </span>
          <span className="text-zinc-600 shrink-0">•</span>
          <span className="text-zinc-400 truncate" title={server.processName}>
            {server.processName}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onInspect(server)}
            className="px-2.5 py-1.5 bg-zinc-800 hover:bg-blue-600 hover:text-white text-zinc-200 text-xs font-semibold rounded-lg border border-zinc-700/60 hover:border-blue-500 transition-all cursor-pointer shadow-xs"
          >
            Inspect
          </button>

          {onStop && (
            <button
              type="button"
              disabled={isStopping || isWsl}
              onClick={handleStop}
              title={
                isWsl
                  ? 'WSL process control is read-only in Milestone 6'
                  : isStopping
                  ? 'Server is stopping...'
                  : `Stop ${server.name} (PID ${server.pid})`
              }
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all shadow-xs flex items-center gap-1.5 ${
                isWsl
                  ? 'bg-zinc-800/50 text-zinc-500 border-zinc-800 cursor-not-allowed opacity-60'
                  : 'bg-red-950/40 hover:bg-red-900/70 disabled:opacity-50 disabled:cursor-not-allowed text-red-300 hover:text-red-100 border-red-800/50 hover:border-red-700 cursor-pointer'
              }`}
            >
              {isStopping ? (
                <>
                  <span className="w-3 h-3 border-2 border-red-300 border-t-transparent rounded-full animate-spin"></span>
                  <span>Stopping</span>
                </>
              ) : isWsl ? (
                <span>Read-Only</span>
              ) : (
                <span>Stop</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
