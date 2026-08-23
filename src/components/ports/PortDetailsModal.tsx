import React, { useState } from 'react';
import type { JoinedPortProcess, Runtime, PackageManager } from '../../types';

interface PortDetailsModalProps {
  item: JoinedPortProcess | null;
  onClose: () => void;
}

export const PortDetailsModal: React.FC<PortDetailsModalProps> = ({ item, onClose }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!item) return null;

  const { port, process, identity } = item;

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

  const renderRuntimeBadge = (r?: Runtime) => {
    if (!r || r === 'Unknown') return <span className="text-app-muted-fg font-sans">Unknown</span>;
    const map: Record<string, string> = {
      'Node.js': 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
      Python: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
      Java: 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30',
      '.NET': 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30',
      Go: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/30',
      Rust: 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/30',
    };

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
          map[r] ?? 'bg-app-muted text-app-muted-fg border-app-border'
        }`}
      >
        {r}
      </span>
    );
  };

  const renderPackageManagerBadge = (pm?: PackageManager) => {
    if (!pm || pm === 'Unknown') return <span className="text-app-muted-fg font-sans">None</span>;
    const colors: Record<string, string> = {
      npm: 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30',
      pnpm: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
      yarn: 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30',
      bun: 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/30',
    };

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border ${
          colors[pm] ?? 'bg-app-muted text-app-muted-fg border-app-border'
        }`}
      >
        {pm}
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs text-app-fg"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      <div
        className="bg-app-surface border border-app-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-app-fg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border bg-app-surface/90">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-blue-600/10 text-blue-500 border border-blue-500/20">
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
              <h3 className="text-lg font-semibold text-app-fg truncate flex items-center gap-2">
                <span>Port {port.port}</span>
                <span className="text-xs font-mono text-app-muted-fg font-normal">({fullEndpoint})</span>
              </h3>
              <p className="text-xs text-app-muted-fg">
                Owning PID: <span className="font-mono text-app-fg font-semibold">{port.pid}</span>
                {process ? ` (${process.name})` : ' (Process Unavailable)'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Listening
            </span>
            <button
              onClick={onClose}
              className="text-app-muted-fg hover:text-app-fg p-1.5 rounded-lg hover:bg-app-surface-hover transition-colors ml-1 cursor-pointer"
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
          <div className="bg-app-bg border border-app-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-app-muted-fg uppercase tracking-wider">
                TCP Socket Endpoint
              </span>
              <button
                onClick={() => copyToClipboard(fullEndpoint, 'endpoint')}
                className="text-xs text-blue-500 hover:text-blue-400 transition-colors cursor-pointer"
              >
                {copiedField === 'endpoint' ? '✓ Copied' : 'Copy endpoint'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="text-[11px] text-app-muted-fg">Port</div>
                <div className="text-base font-mono font-semibold text-blue-500">{port.port}</div>
              </div>
              <div>
                <div className="text-[11px] text-app-muted-fg">Bound Address</div>
                <div className="text-xs font-mono font-medium text-app-fg truncate" title={port.address}>
                  {port.address}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-app-muted-fg">Protocol / Type</div>
                <div className="text-xs font-medium text-app-fg">
                  <span className="uppercase">{port.protocol}</span>{' '}
                  <span className="text-[11px] text-app-muted-fg">
                    ({port.address.includes(':') ? 'IPv6' : 'IPv4'})
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[11px] text-app-muted-fg">Scope</div>
                <div className="text-xs font-medium">
                  {isLocalhost ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Loopback Only</span>
                  ) : isWildcard ? (
                    <span className="text-amber-600 dark:text-amber-400">All Interfaces (0.0.0.0)</span>
                  ) : (
                    <span className="text-blue-500">Specific Host IP</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Process Information Card */}
          <div className="space-y-4">
            <div className="text-xs font-medium text-app-muted-fg uppercase tracking-wider flex items-center justify-between">
              <span>Owning Process (PID {port.pid})</span>
              {process && (
                <button
                  onClick={() => copyToClipboard(port.pid.toString(), 'pid')}
                  className="text-xs text-blue-500 hover:text-blue-400 transition-colors cursor-pointer"
                >
                  {copiedField === 'pid' ? '✓ Copied' : 'Copy PID'}
                </button>
              )}
            </div>

            {process ? (
              <div className="space-y-4 bg-app-bg border border-app-border rounded-lg p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <div className="text-[11px] text-app-muted-fg">Process Name</div>
                    <div className="text-sm font-semibold text-app-fg font-mono">{process.name}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-app-muted-fg">Parent Process</div>
                    <div className="text-xs font-mono text-app-fg mt-0.5 truncate">
                      {identity?.parent ? (
                        <span>
                          {identity.parent.name} ({identity.parent.pid})
                        </span>
                      ) : (
                        process.parentPid ?? 'None'
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-app-muted-fg">Runtime</div>
                    <div className="mt-0.5">{renderRuntimeBadge(identity?.runtime)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-app-muted-fg">Package Manager</div>
                    <div className="mt-0.5">{renderPackageManagerBadge(identity?.packageManager)}</div>
                  </div>
                </div>

                {/* All Listening Ports for this process */}
                {identity && identity.listeningPorts.length > 1 && (
                  <div className="space-y-1">
                    <div className="text-[11px] text-app-muted-fg">
                      All Listening Ports Owned by PID {port.pid} ({identity.listeningPorts.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {identity.listeningPorts.map((p) => (
                        <span
                          key={p}
                          className={`px-2 py-0.5 rounded text-xs font-mono font-semibold border ${
                            p === port.port
                              ? 'bg-blue-600 text-white border-blue-500'
                              : 'bg-blue-600/15 text-blue-600 dark:text-blue-300 border-blue-500/30'
                          }`}
                        >
                          Port {p} {p === port.port && '(Active)'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Process Tree if available */}
                {identity && identity.processTree.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[11px] text-app-muted-fg">Process Ancestry Tree</div>
                    <div className="bg-app-surface border border-app-border rounded p-3 text-xs font-mono space-y-1">
                      {identity.processTree.map((node, index) => (
                        <div
                          key={`${node.pid}_${index}`}
                          style={{ paddingLeft: `${node.depth * 16}px` }}
                          className={`flex items-center gap-2 ${
                            node.isTarget ? 'text-blue-600 dark:text-blue-300 font-semibold' : 'text-app-muted-fg'
                          }`}
                        >
                          <span className="text-app-muted-fg/60">{node.depth === 0 ? '●' : '└──'}</span>
                          <span>{node.name}</span>
                          <span className="text-app-muted-fg text-[11px]">(PID {node.pid})</span>
                          {node.isTarget && (
                            <span className="text-[9px] bg-blue-600 text-white px-1 rounded uppercase font-sans font-bold">
                              Target
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Executable Path */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-app-muted-fg">
                    <span>Executable Path</span>
                    {process.executablePath && (
                      <button
                        onClick={() => copyToClipboard(process.executablePath!, 'exe')}
                        className="text-[11px] text-blue-500 hover:text-blue-400 cursor-pointer"
                      >
                        {copiedField === 'exe' ? '✓ Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                  <div className="bg-app-surface border border-app-border rounded p-2 text-xs font-mono text-app-fg break-all">
                    {process.executablePath || <span className="text-app-muted-fg italic">Unavailable / Restricted</span>}
                  </div>
                </div>

                {/* Command Line */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-app-muted-fg">
                    <span>Command Line</span>
                    {process.commandLine && (
                      <button
                        onClick={() => copyToClipboard(process.commandLine!, 'cmd')}
                        className="text-[11px] text-blue-500 hover:text-blue-400 cursor-pointer"
                      >
                        {copiedField === 'cmd' ? '✓ Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                  <div className="bg-app-surface border border-app-border rounded p-2 text-xs font-mono text-app-fg break-all whitespace-pre-wrap max-h-28 overflow-y-auto">
                    {process.commandLine || <span className="text-app-muted-fg italic">Unavailable / Restricted</span>}
                  </div>
                </div>

                {/* Working Directory */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-app-muted-fg">
                    <span>Working Directory (CWD)</span>
                    {process.workingDirectory && (
                      <button
                        onClick={() => copyToClipboard(process.workingDirectory!, 'cwd')}
                        className="text-[11px] text-blue-500 hover:text-blue-400 cursor-pointer"
                      >
                        {copiedField === 'cwd' ? '✓ Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                  <div className="bg-app-surface border border-app-border rounded p-2 text-xs font-mono text-app-fg break-all">
                    {process.workingDirectory || <span className="text-app-muted-fg italic">Unavailable / Restricted</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-app-bg border border-dashed border-app-border rounded-lg p-6 text-center">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  Process information unavailable for PID {port.pid}
                </p>
                <p className="text-[11px] text-app-muted-fg mt-1 max-w-sm mx-auto">
                  The process may have terminated immediately after socket enumeration, or access may be restricted by Windows security.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-app-border bg-app-surface/90 flex items-center justify-between">
          <div className="text-[11px] text-app-muted-fg">
            Snapshot data discovered via Win32 IP Helper and ProcessIdentityService
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium bg-app-muted hover:bg-app-surface-hover text-app-fg rounded-lg border border-app-border transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
