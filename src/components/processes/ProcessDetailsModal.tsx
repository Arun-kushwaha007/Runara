import React, { useState } from 'react';
import type { ProcessInfo } from '../../types';

interface ProcessDetailsModalProps {
  process: ProcessInfo | null;
  onClose: () => void;
}

export const ProcessDetailsModal: React.FC<ProcessDetailsModalProps> = ({
  process,
  onClose,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!process) return null;

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getStatusBadge = () => {
    switch (process.status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Running
          </span>
        );
      case 'accessrestricted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Access Restricted
          </span>
        );
      case 'unavailable':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
            Unavailable
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-700/50 text-zinc-300">
            {process.status}
          </span>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      <div
        className="bg-zinc-900 border border-zinc-700/70 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-zinc-800 text-zinc-300">
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
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M7 7h10" />
                <path d="M7 12h10" />
                <path d="M7 17h10" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-zinc-100 truncate flex items-center gap-2">
                {process.name}
              </h3>
              <p className="text-xs text-zinc-400">PID: {process.pid}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge()}
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
              title="Close (Esc)"
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
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Top Grid: PID & Parent PID */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-3">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Process ID</div>
              <div className="text-lg font-mono font-semibold text-zinc-100 mt-0.5">{process.pid}</div>
            </div>
            <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-3">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Parent PID</div>
              <div className="text-lg font-mono font-semibold text-zinc-100 mt-0.5">
                {process.parentPid !== undefined && process.parentPid !== null ? (
                  process.parentPid
                ) : (
                  <span className="text-zinc-500 text-sm font-normal">None / Unavailable</span>
                )}
              </div>
            </div>
          </div>

          {/* Executable Path */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-400 uppercase tracking-wider">
              <span>Executable Path</span>
              {process.executablePath && (
                <button
                  onClick={() => copyToClipboard(process.executablePath!, 'exe')}
                  className="text-xs text-blue-400 hover:text-blue-300 font-sans normal-case transition-colors flex items-center gap-1"
                >
                  {copiedField === 'exe' ? '✓ Copied' : 'Copy path'}
                </button>
              )}
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono break-all text-zinc-300">
              {process.executablePath || (
                <span className="text-zinc-500 italic">Access restricted or unavailable</span>
              )}
            </div>
          </div>

          {/* Command Line */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-400 uppercase tracking-wider">
              <span>Command Line</span>
              {process.commandLine && (
                <button
                  onClick={() => copyToClipboard(process.commandLine!, 'cmd')}
                  className="text-xs text-blue-400 hover:text-blue-300 font-sans normal-case transition-colors flex items-center gap-1"
                >
                  {copiedField === 'cmd' ? '✓ Copied' : 'Copy command'}
                </button>
              )}
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono break-all text-zinc-300 whitespace-pre-wrap max-h-36 overflow-y-auto">
              {process.commandLine || (
                <span className="text-zinc-500 italic">Access restricted or unavailable</span>
              )}
            </div>
          </div>

          {/* Working Directory */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-400 uppercase tracking-wider">
              <span>Working Directory</span>
              {process.workingDirectory && (
                <button
                  onClick={() => copyToClipboard(process.workingDirectory!, 'cwd')}
                  className="text-xs text-blue-400 hover:text-blue-300 font-sans normal-case transition-colors flex items-center gap-1"
                >
                  {copiedField === 'cwd' ? '✓ Copied' : 'Copy CWD'}
                </button>
              )}
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono break-all text-zinc-300">
              {process.workingDirectory || (
                <span className="text-zinc-500 italic">Access restricted or unavailable</span>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
