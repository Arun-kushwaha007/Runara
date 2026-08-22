import React from 'react';
import type { DashboardServer, ProcessControlError } from '../../types';

interface StopConfirmationModalProps {
  server: DashboardServer;
  isStopping: boolean;
  error: ProcessControlError | string | null;
  onConfirm: (force?: boolean) => void;
  onCancel: () => void;
  onRefresh: () => void;
}

export const StopConfirmationModal: React.FC<StopConfirmationModalProps> = ({
  server,
  isStopping,
  error,
  onConfirm,
  onCancel,
  onRefresh,
}) => {
  const descendantCount =
    server.processTree.filter((node) => !node.isTarget && node.depth > 0).length;

  const errorMessage =
    typeof error === 'string'
      ? error
      : error
      ? error.message
      : null;

  const isStale =
    typeof error === 'object' &&
    error !== null &&
    (error.code === 'PROCESS_IDENTITY_CHANGED' || error.code === 'ALREADY_STOPPED');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stop-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={!isStopping ? onCancel : undefined}
    >
      <div
        className="relative w-full max-w-lg bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start gap-3.5 p-5 border-b border-zinc-800 bg-zinc-950/60">
          <div className="w-10 h-10 rounded-xl bg-red-950/70 border border-red-800/60 text-red-400 flex items-center justify-center shrink-0">
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
              <rect width="6" height="6" x="9" y="9" rx="1" />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <h2 id="stop-modal-title" className="text-lg font-bold text-zinc-100 tracking-tight">
              Stop Development Server?
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Verify the target server process before terminating execution.
            </p>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Target Metadata Card */}
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 space-y-3">
            {/* Server Name & Port */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-zinc-100">{server.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono font-bold text-blue-400">
                    localhost:{server.primaryPort}
                  </span>
                  {server.allPorts.length > 1 && (
                    <span className="text-[10px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">
                      +{server.allPorts.length - 1} extra ports
                    </span>
                  )}
                </div>
              </div>

              {server.runtime !== 'Unknown' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-950/70 text-blue-300 border border-blue-800/40">
                  {server.runtime}
                </span>
              )}
            </div>

            {/* PID & Process image */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/80">
              <div>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                  Process ID (PID)
                </span>
                <div className="font-mono text-zinc-200 font-bold mt-0.5">{server.pid}</div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                  Executable Image
                </span>
                <div className="font-mono text-zinc-200 truncate mt-0.5" title={server.processName}>
                  {server.processName}
                </div>
              </div>
            </div>

            {/* Working Directory */}
            {server.workingDirectory && (
              <div className="pt-2 border-t border-zinc-800/80">
                <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                  Project Workspace
                </span>
                <div
                  className="font-mono text-zinc-300 truncate mt-0.5 text-[11px]"
                  title={server.workingDirectory}
                >
                  {server.workingDirectory}
                </div>
              </div>
            )}
          </div>

          {/* Safety Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-300">
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
              className="shrink-0 mt-0.5 text-amber-400"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div className="space-y-1">
              <div className="font-semibold text-amber-200">Pre-Termination Safety Guard</div>
              <p className="text-[11px] text-amber-300/90 leading-relaxed">
                DevHub will verify that PID {server.pid} matches &apos;{server.processName}&apos;
                before terminating. Only the target process and its verified descendants will be
                stopped. Ancestors (terminals and VS Code) remain untouched.
              </p>
              {descendantCount > 0 && (
                <p className="text-[11px] text-amber-400 font-medium">
                  Notice: This process tree contains {descendantCount} child{' '}
                  {descendantCount === 1 ? 'worker' : 'workers'} which will also be stopped.
                </p>
              )}
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-red-200">
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
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <span>Termination Issue</span>
              </div>
              <p className="text-[11px] text-red-300 leading-relaxed">{errorMessage}</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={isStopping}
            onClick={onCancel}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 text-xs font-semibold rounded-lg border border-zinc-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {isStale ? (
              <button
                type="button"
                onClick={onRefresh}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                Refresh Server List
              </button>
            ) : errorMessage ? (
              <>
                <button
                  type="button"
                  onClick={onRefresh}
                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-lg border border-zinc-700 transition-colors cursor-pointer"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  disabled={isStopping}
                  onClick={() => onConfirm(true)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                >
                  {isStopping && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  )}
                  <span>Force Stop</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={isStopping}
                onClick={() => onConfirm(false)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-2"
              >
                {isStopping && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                )}
                <span>{isStopping ? 'Stopping Server...' : 'Stop Server'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
