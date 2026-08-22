import React, { useEffect } from 'react';
import type { DashboardServer } from '../../types';
import { CopyButton } from '../common/CopyButton';
import { ProcessTree } from './ProcessTree';
import { getBrowserUrl } from '../../lib/serverUtils';

interface ServerDetailsModalProps {
  server: DashboardServer;
  onClose: () => void;
  onOpenBrowser?: (url: string) => void;
  onStopServer?: (server: DashboardServer) => void;
  isStopping?: boolean;
}

export const ServerDetailsModal: React.FC<ServerDetailsModalProps> = ({
  server,
  onClose,
  onOpenBrowser,
  onStopServer,
  isStopping = false,
}) => {
  const browserUrl = getBrowserUrl(server.address, server.primaryPort);
  const isWsl = server.environment?.type === 'wsl';

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleOpenBrowser = () => {
    if (onOpenBrowser) {
      onOpenBrowser(browserUrl);
    } else {
      window.open(browserUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between p-6 border-b border-zinc-800 bg-zinc-950/40">
          <div className="min-w-0 flex-1 mr-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2
                id="modal-title"
                className="text-xl font-bold text-zinc-100 tracking-tight truncate"
                title={server.name}
              >
                {server.name}
              </h2>
              {isStopping ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/50">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                  <span>STOPPING...</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>RUNNING</span>
                </span>
              )}
              {isWsl ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-950/80 text-purple-300 border border-purple-700/60">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
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
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                  <span>Windows</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-2 text-xs text-zinc-400">
              <span className="font-mono text-blue-400 font-semibold">
                localhost:{server.primaryPort}
              </span>
              <span>•</span>
              <span>PID {server.pid}</span>
              <span>•</span>
              <span className="font-mono text-zinc-300">{server.processName}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-zinc-400 hover:text-zinc-100 p-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-950/30 border border-blue-800/40 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
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
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-zinc-200">Browser Endpoint</div>
                <div className="text-xs font-mono text-blue-300 truncate">{browserUrl}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleOpenBrowser}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <span>Open in Browser</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
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

              {onStopServer && (
                <button
                  type="button"
                  disabled={isStopping || isWsl}
                  onClick={() => onStopServer(server)}
                  title={
                    isWsl
                      ? 'WSL process control is read-only in Milestone 6'
                      : isStopping
                      ? 'Stopping...'
                      : `Stop ${server.name}`
                  }
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors shadow-xs ${
                    isWsl
                      ? 'bg-zinc-800/50 text-zinc-500 border-zinc-800 cursor-not-allowed opacity-60'
                      : 'bg-red-950/70 hover:bg-red-900 text-red-300 hover:text-white disabled:opacity-50 border-red-800/60 cursor-pointer'
                  }`}
                >
                  {isStopping ? (
                    <>
                      <span className="w-3 h-3 border-2 border-red-300 border-t-transparent rounded-full animate-spin"></span>
                      <span>Stopping...</span>
                    </>
                  ) : isWsl ? (
                    <span>Read-Only</span>
                  ) : (
                    <span>Stop Server</span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Primary Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Runtime & Package Manager */}
            <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 space-y-2">
              <div className="font-semibold text-zinc-400 uppercase text-[11px] tracking-wider">
                Identity & Framework
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Runtime:</span>
                <span className="font-semibold text-zinc-200">{server.runtime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Package Manager:</span>
                <span className="font-semibold text-zinc-200">{server.packageManager}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Environment:</span>
                <span className="font-semibold text-zinc-200">{server.environmentLabel}</span>
              </div>
            </div>

            {/* Ports & Networking */}
            <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 space-y-2">
              <div className="font-semibold text-zinc-400 uppercase text-[11px] tracking-wider">
                Port & Network Binding
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Primary Port:</span>
                <span className="font-mono font-semibold text-blue-400">
                  {server.primaryPort} ({server.protocol.toUpperCase()})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">All Listening Ports:</span>
                <span className="font-mono font-semibold text-zinc-200">
                  {server.allPorts.join(', ')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Bound Interface:</span>
                <span className="font-mono text-zinc-300">{server.address}</span>
              </div>
            </div>
          </div>

          {/* Working Directory Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-400 uppercase text-[11px] tracking-wider">
                Project Workspace Directory
              </span>
              {server.workingDirectory && (
                <CopyButton
                  textToCopy={server.workingDirectory}
                  label="Copy Workspace Path"
                  title="Copy working directory path"
                />
              )}
            </div>
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 font-mono text-xs text-zinc-300 break-all select-all">
              {server.workingDirectory ?? (
                <span className="text-zinc-500 italic">Unavailable (Access Restricted)</span>
              )}
            </div>
          </div>

          {/* Command Line Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-400 uppercase text-[11px] tracking-wider">
                Full Command Line
              </span>
              {server.commandLine && (
                <CopyButton
                  textToCopy={server.commandLine}
                  label="Copy Command"
                  title="Copy full command line"
                />
              )}
            </div>
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 font-mono text-xs text-zinc-300 break-all select-all whitespace-pre-wrap">
              {server.commandLine ?? (
                <span className="text-zinc-500 italic">Unavailable</span>
              )}
            </div>
          </div>

          {/* Executable Path Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-400 uppercase text-[11px] tracking-wider">
                Executable Binary Image
              </span>
              {server.executablePath && (
                <CopyButton
                  textToCopy={server.executablePath}
                  label="Copy Binary Path"
                  title="Copy executable path"
                />
              )}
            </div>
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 font-mono text-xs text-zinc-300 break-all select-all">
              {server.executablePath ?? (
                <span className="text-zinc-500 italic">Unavailable</span>
              )}
            </div>
          </div>

          {/* Process Ancestry Tree */}
          <div className="space-y-2">
            <ProcessTree tree={server.processTree} />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
          <div className="text-[11px] text-zinc-500">
            Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono text-[10px]">ESC</kbd> to close
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg border border-zinc-700/80 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
