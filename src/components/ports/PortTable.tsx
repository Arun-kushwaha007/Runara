import React from 'react';
import type { JoinedPortProcess, Runtime } from '../../types';

export type PortSortField =
  | 'port'
  | 'pid'
  | 'process'
  | 'runtime'
  | 'address'
  | 'protocol'
  | 'command';
export type SortDirection = 'asc' | 'desc';

interface PortTableProps {
  items: JoinedPortProcess[];
  onSelectItem: (item: JoinedPortProcess) => void;
  sortField: PortSortField;
  sortDirection: SortDirection;
  onSort: (field: PortSortField) => void;
}

export const PortTable: React.FC<PortTableProps> = ({
  items,
  onSelectItem,
  sortField,
  sortDirection,
  onSort,
}) => {
  const renderSortIndicator = (field: PortSortField) => {
    if (sortField !== field) {
      return (
        <span className="opacity-0 group-hover:opacity-40 transition-opacity ml-1 inline-block">
          ↕
        </span>
      );
    }
    return (
      <span className="text-blue-500 ml-1 inline-block">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  const isLocalhost = (addr: string) =>
    addr === '127.0.0.1' || addr === 'localhost' || addr === '[::1]' || addr === '::1';

  const isWildcard = (addr: string) =>
    addr === '0.0.0.0' || addr === '[::]' || addr === '::';

  const renderRuntimeBadge = (runtime?: Runtime) => {
    if (!runtime || runtime === 'Unknown') {
      return <span className="text-app-muted-fg text-xs">-</span>;
    }

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
        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
          map[runtime] ?? 'bg-app-muted text-app-muted-fg border-app-border'
        }`}
      >
        {runtime}
      </span>
    );
  };

  if (items.length === 0) {
    return (
      <div className="border border-dashed border-app-border rounded-xl p-12 text-center bg-app-surface/40">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto h-10 w-10 text-app-muted-fg/60 mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
          <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
          <line x1="6" x2="6.01" y1="6" y2="6" />
          <line x1="6" x2="6.01" y1="18" y2="18" />
        </svg>
        <p className="text-sm font-medium text-app-fg">No matching listening ports found</p>
        <p className="text-xs text-app-muted-fg mt-1">
          Make sure your local development servers are running or adjust your search filter.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-app-border rounded-xl overflow-hidden bg-app-surface shadow-xs text-app-fg">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-app-muted border-b border-app-border text-app-muted-fg select-none font-medium">
              <th
                onClick={() => onSort('port')}
                className="py-3 px-4 cursor-pointer hover:text-app-fg transition-colors group w-24"
              >
                <div className="flex items-center">
                  <span>Port</span>
                  {renderSortIndicator('port')}
                </div>
              </th>
              <th
                onClick={() => onSort('address')}
                className="py-3 px-4 cursor-pointer hover:text-app-fg transition-colors group w-36"
              >
                <div className="flex items-center">
                  <span>Local Address</span>
                  {renderSortIndicator('address')}
                </div>
              </th>
              <th
                onClick={() => onSort('pid')}
                className="py-3 px-4 cursor-pointer hover:text-app-fg transition-colors group w-20"
              >
                <div className="flex items-center">
                  <span>PID</span>
                  {renderSortIndicator('pid')}
                </div>
              </th>
              <th
                onClick={() => onSort('process')}
                className="py-3 px-4 cursor-pointer hover:text-app-fg transition-colors group w-40"
              >
                <div className="flex items-center">
                  <span>Process Name</span>
                  {renderSortIndicator('process')}
                </div>
              </th>
              <th
                onClick={() => onSort('runtime')}
                className="py-3 px-4 cursor-pointer hover:text-app-fg transition-colors group w-24"
              >
                <div className="flex items-center">
                  <span>Runtime</span>
                  {renderSortIndicator('runtime')}
                </div>
              </th>
              <th
                onClick={() => onSort('command')}
                className="py-3 px-4 cursor-pointer hover:text-app-fg transition-colors group min-w-[200px]"
              >
                <div className="flex items-center">
                  <span>Command Line</span>
                  {renderSortIndicator('command')}
                </div>
              </th>
              <th className="py-3 px-4 min-w-[160px]">Working Directory</th>
              <th className="py-3 px-4 w-28 text-center">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border text-app-fg">
            {items.map((item, idx) => {
              const { port, process, identity } = item;
              const uniqueKey = `${port.address}_${port.port}_${port.pid}_${idx}`;
              const localhost = isLocalhost(port.address);
              const wildcard = isWildcard(port.address);

              return (
                <tr
                  key={uniqueKey}
                  onClick={() => onSelectItem(item)}
                  className="hover:bg-app-surface-hover cursor-pointer transition-colors group"
                >
                  {/* Port Number */}
                  <td className="py-2.5 px-4 font-mono font-semibold text-blue-500">
                    <span className="bg-blue-600/15 border border-blue-500/30 px-2 py-0.5 rounded text-blue-600 dark:text-blue-300">
                      {port.port}
                    </span>
                  </td>

                  {/* Local Address & Scope */}
                  <td className="py-2.5 px-4 font-mono">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`truncate max-w-[120px] ${
                          localhost
                            ? 'text-emerald-600 dark:text-emerald-300 font-semibold'
                            : wildcard
                            ? 'text-amber-600 dark:text-amber-300'
                            : 'text-app-fg'
                        }`}
                        title={port.address}
                      >
                        {port.address}
                      </span>
                    </div>
                  </td>

                  {/* PID */}
                  <td className="py-2.5 px-4 font-mono font-medium text-app-fg">
                    {port.pid}
                  </td>

                  {/* Process Name */}
                  <td className="py-2.5 px-4 font-medium text-app-fg group-hover:text-blue-500 transition-colors">
                    {process ? (
                      <span className="truncate max-w-[150px] block font-mono" title={process.name}>
                        {process.name}
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 italic text-[11px]">
                        Unavailable (PID {port.pid})
                      </span>
                    )}
                  </td>

                  {/* Runtime */}
                  <td className="py-2.5 px-4">{renderRuntimeBadge(identity?.runtime)}</td>

                  {/* Command Line */}
                  <td className="py-2.5 px-4 font-mono text-app-fg max-w-xs truncate">
                    {process?.commandLine ? (
                      <span title={process.commandLine} className="truncate block">
                        {process.commandLine}
                      </span>
                    ) : (
                      <span className="text-app-muted-fg italic">unavailable</span>
                    )}
                  </td>

                  {/* Working Directory */}
                  <td className="py-2.5 px-4 font-mono text-app-muted-fg max-w-[160px] truncate">
                    {process?.workingDirectory ? (
                      <span title={process.workingDirectory} className="truncate block">
                        {process.workingDirectory}
                      </span>
                    ) : (
                      <span className="text-app-muted-fg italic">unavailable</span>
                    )}
                  </td>

                  {/* State Badge */}
                  <td className="py-2.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Listening
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
