import React, { useState } from 'react';
import type { JoinedPortProcess } from '../../types';

interface PortDetailsModalProps {
  item: JoinedPortProcess | null;
  onClose: () => void;
}

export const PortDetailsModal: React.FC<PortDetailsModalProps> = ({ item, onClose }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!item) return null;

  const { port, process } = item;

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isLocalhost =
    port.address === '127.0.0.1' ||
    port.address === 'localhost' ||
    port.address === '[::1]' ||
    port.address === '::1';

  const isWildcard =
    port.address === '0.0.0.0' ||
    port.address === '[::]' ||
    port.address === '::';

  const fullEndpoint = port.address.startsWith('[')
    ? `${port.address}:${port.port}`
    : `${port.address}:${port.port}`;

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
                <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
                <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
                <line x1="6" x2="6.01" y1="6" y2="6" />
                <line x1="6" x2="6.01" y1="18" y2="18" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-zinc-100 truncate flex items-center gap-2">
                <span>Port {port.port}</span>
                <span className="text-xs font-mono text-zinc-400 font-normal">({fullEndpoint})</span>
              </h3>
              <p className="text-xs text-zinc-400">
                Owning PID: <span className="font-mono text-zinc-300 font-semibold">{port.pid}</span>
                {process ? ` (${process.name})` : ' (Process Unavailable)'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Listening
            </span>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors ml-1"
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
          {/* Socket Endpoint Card */}
          <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                TCP Socket Endpoint
              </span>
              <button
                onClick={() => copyToClipboard(fullEndpoint, 'endpoint')}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                {copiedField === 'endpoint' ? '✓ Copied' : 'Copy endpoint'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="text-[11px] text-zinc-500">Port</div>
                <div className="text-base font-mono font-semibold text-blue-400">{port.port}</div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500">Bound Address</div>
                <div className="text-xs font-mono font-medium text-zinc-200 truncate" title={port.address}>
                  {port.address}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500">Protocol / Type</div>
                <div className="text-xs font-medium text-zinc-300">
                  <span className="uppercase">{port.protocol}</span>{' '}
                  <span className="text-[11px] text-zinc-500">
                    ({port.address.includes(':') ? 'IPv6' : 'IPv4'})
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500">Scope</div>
                <div className="text-xs font-medium">
                  {isLocalhost ? (
                    <span className="text-emerald-400">Loopback Only</span>
                  ) : isWildcard ? (
                    <span className="text-amber-400">All Interfaces (0.0.0.0)</span>
                  ) : (
                    <span className="text-blue-400">Specific Host IP</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Process Information Card */}
          <div className="space-y-4">
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>Owning Process (PID {port.pid})</span>
              {process && (
                <button
                  onClick={() => copyToClipboard(port.pid.toString(), 'pid')}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {copiedField === 'pid' ? '✓ Copied' : 'Copy PID'}
                </button>
              )}
            </div>

            {process ? (
              <div className="space-y-4 bg-zinc-950/60 border border-zinc-800 rounded-lg p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="text-[11px] text-zinc-500">Process Name</div>
                    <div className="text-sm font-semibold text-zinc-100 font-mono">{process.name}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-zinc-500">Parent PID</div>
                    <div className="text-sm font-mono text-zinc-300">
                      {process.parentPid ?? 'None'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-zinc-500">Process Status</div>
                    <div className="text-xs text-zinc-300 capitalize">{process.status}</div>
                  </div>
                </div>

                {/* Executable Path */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Executable Path</span>
                    {process.executablePath && (
                      <button
                        onClick={() => copyToClipboard(process.executablePath!, 'exe')}
                        className="text-[11px] text-blue-400 hover:text-blue-300"
                      >
                        {copiedField === 'exe' ? '✓ Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                  <div className="bg-zinc-900/90 border border-zinc-800/80 rounded p-2 text-xs font-mono text-zinc-300 break-all">
                    {process.executablePath || <span className="text-zinc-500 italic">Unavailable / Restricted</span>}
                  </div>
                </div>

                {/* Command Line */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Command Line</span>
                    {process.commandLine && (
                      <button
                        onClick={() => copyToClipboard(process.commandLine!, 'cmd')}
                        className="text-[11px] text-blue-400 hover:text-blue-300"
                      >
                        {copiedField === 'cmd' ? '✓ Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                  <div className="bg-zinc-900/90 border border-zinc-800/80 rounded p-2 text-xs font-mono text-zinc-300 break-all whitespace-pre-wrap max-h-28 overflow-y-auto">
                    {process.commandLine || <span className="text-zinc-500 italic">Unavailable / Restricted</span>}
                  </div>
                </div>

                {/* Working Directory */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Working Directory (CWD)</span>
                    {process.workingDirectory && (
                      <button
                        onClick={() => copyToClipboard(process.workingDirectory!, 'cwd')}
                        className="text-[11px] text-blue-400 hover:text-blue-300"
                      >
                        {copiedField === 'cwd' ? '✓ Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                  <div className="bg-zinc-900/90 border border-zinc-800/80 rounded p-2 text-xs font-mono text-zinc-300 break-all">
                    {process.workingDirectory || <span className="text-zinc-500 italic">Unavailable / Restricted</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-950/60 border border-dashed border-zinc-800 rounded-lg p-6 text-center">
                <p className="text-xs text-amber-400 font-medium">
                  Process information unavailable for PID {port.pid}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1 max-w-sm mx-auto">
                  The process may have terminated immediately after socket enumeration, or access may be restricted by Windows security.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/90 flex items-center justify-between">
          <div className="text-[11px] text-zinc-500">
            Snapshot data discovered via Win32 IP Helper API
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
