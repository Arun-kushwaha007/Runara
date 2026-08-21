import React, { useState } from 'react';
import type { ProcessIdentity, Runtime, PackageManager } from '../../types';

interface ProcessDetailsModalProps {
  identity: ProcessIdentity | null;
  onClose: () => void;
}

export const ProcessDetailsModal: React.FC<ProcessDetailsModalProps> = ({
  identity,
  onClose,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!identity) return null;

  const { process, runtime, packageManager, parent, processTree, listeningPorts } = identity;

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

  const renderRuntimeBadge = (r: Runtime) => {
    const map: Record<string, string> = {
      'Node.js': 'bg-green-950/60 text-green-300 border-green-800/40',
      Python: 'bg-yellow-950/60 text-yellow-300 border-yellow-800/40',
      Java: 'bg-red-950/60 text-red-300 border-red-800/40',
      '.NET': 'bg-purple-950/60 text-purple-300 border-purple-800/40',
      Go: 'bg-cyan-950/60 text-cyan-300 border-cyan-800/40',
      Rust: 'bg-orange-950/60 text-orange-300 border-orange-800/40',
      Unknown: 'bg-zinc-800 text-zinc-400 border-zinc-700',
    };

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
          map[r] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'
        }`}
      >
        {r}
      </span>
    );
  };

  const renderPackageManagerBadge = (pm: PackageManager) => {
    if (pm === 'Unknown') {
      return <span className="text-zinc-500 text-sm font-normal">None / Unknown</span>;
    }

    const colors: Record<string, string> = {
      npm: 'bg-red-950/40 text-red-300 border-red-800/40',
      pnpm: 'bg-amber-950/40 text-amber-300 border-amber-800/40',
      yarn: 'bg-blue-950/40 text-blue-300 border-blue-800/40',
      bun: 'bg-orange-950/40 text-orange-300 border-orange-800/40',
    };

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border ${
          colors[pm] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'
        }`}
      >
        {pm}
      </span>
    );
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
        className="bg-zinc-900 border border-zinc-700/70 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
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
              <h3 className="text-lg font-semibold text-zinc-100 truncate flex items-center gap-2 font-mono">
                {process.name}
              </h3>
              <p className="text-xs text-zinc-400">
                PID: <span className="font-mono text-zinc-200">{process.pid}</span>
              </p>
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
          {/* Identity Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-3">
              <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Process ID</div>
              <div className="text-base font-mono font-semibold text-zinc-100 mt-1">{process.pid}</div>
            </div>

            <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-3">
              <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Parent Process</div>
              <div className="text-xs font-mono text-zinc-200 mt-1 truncate" title={parent?.name ?? 'None'}>
                {parent ? (
                  <span>
                    {parent.name} <span className="text-zinc-400 font-normal">({parent.pid})</span>
                  </span>
                ) : (
                  <span className="text-zinc-500 font-sans">None</span>
                )}
              </div>
            </div>

            <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-3">
              <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Runtime</div>
              <div className="mt-1">{renderRuntimeBadge(runtime)}</div>
            </div>

            <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-3">
              <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Package Manager</div>
              <div className="mt-1">{renderPackageManagerBadge(packageManager)}</div>
            </div>
          </div>

          {/* Listening Ports Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-400 uppercase tracking-wider">
              <span>Listening Ports ({listeningPorts.length})</span>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
              {listeningPorts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {listeningPorts.map((port) => (
                    <span
                      key={port}
                      className="inline-flex items-center gap-1.5 bg-blue-950/70 border border-blue-700/50 px-3 py-1 rounded-md text-xs font-mono font-semibold text-blue-300"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                      Port {port}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-zinc-500 text-xs italic">
                  No active TCP listening ports associated with this process
                </span>
              )}
            </div>
          </div>

          {/* Process Tree Ancestry Hierarchy */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-400 uppercase tracking-wider">
              <span>Process Ancestry Tree</span>
              <span className="text-[11px] text-zinc-500 lowercase font-mono">
                {processTree.length} level{processTree.length !== 1 ? 's' : ''} (max depth: 32)
              </span>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-xs overflow-x-auto space-y-1.5">
              {processTree.map((node, index) => {
                const indentPx = node.depth * 20;

                return (
                  <div
                    key={`${node.pid}_${index}`}
                    style={{ paddingLeft: `${indentPx}px` }}
                    className={`flex items-center gap-2 py-1 px-2 rounded-md transition-colors ${
                      node.isTarget
                        ? 'bg-blue-950/60 border border-blue-600/50 text-blue-300 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {/* Tree connector branch */}
                    <span className="text-zinc-600 select-none">
                      {node.depth === 0 ? '●' : '└──'}
                    </span>

                    {/* Node Name */}
                    <span className="font-semibold text-zinc-200 truncate max-w-xs" title={node.name}>
                      {node.name}
                    </span>

                    {/* Node PID */}
                    <span className="text-zinc-500 text-[11px]">
                      (PID {node.pid})
                    </span>

                    {/* Target Badge */}
                    {node.isTarget && (
                      <span className="ml-auto text-[10px] bg-blue-600 text-white uppercase tracking-wider px-1.5 py-0.5 rounded font-sans font-bold">
                        Target
                      </span>
                    )}

                    {/* Command line tooltip if present and not target */}
                    {!node.isTarget && node.commandLine && (
                      <span
                        className="text-zinc-600 text-[11px] truncate max-w-sm ml-auto hidden sm:inline"
                        title={node.commandLine}
                      >
                        {node.commandLine}
                      </span>
                    )}
                  </div>
                );
              })}
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
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono break-all text-zinc-300 whitespace-pre-wrap max-h-32 overflow-y-auto">
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
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/90 flex items-center justify-between">
          <div className="text-[11px] text-zinc-500">
            Process identity enriched via DevHub ProcessIdentityService
          </div>
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
