import React from 'react';
import type { JoinedPortProcess } from '../../types';

export type PortSortField = 'port' | 'pid' | 'process' | 'address' | 'protocol' | 'command';
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
      <span className="text-blue-400 ml-1 inline-block">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  const isLocalhost = (addr: string) =>
    addr === '127.0.0.1' || addr === 'localhost' || addr === '[::1]' || addr === '::1';

  const isWildcard = (addr: string) =>
    addr === '0.0.0.0' || addr === '[::]' || addr === '::';

  if (items.length === 0) {
    return (
      <div className="border border-dashed border-zinc-800 rounded-xl p-12 text-center bg-zinc-900/30">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto h-10 w-10 text-zinc-600 mb-3"
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
        <p className="text-sm font-medium text-zinc-300">No matching listening ports found</p>
        <p className="text-xs text-zinc-500 mt-1">
          Make sure your local development servers are running or adjust your search filter.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40 shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-zinc-800/70 border-b border-zinc-800 text-zinc-400 select-none font-medium">
              <th
                onClick={() => onSort('port')}
                className="py-3 px-4 cursor-pointer hover:text-zinc-200 transition-colors group w-24"
              >
                <div className="flex items-center">
                  <span>Port</span>
                  {renderSortIndicator('port')}
                </div>
              </th>
              <th
                onClick={() => onSort('address')}
                className="py-3 px-4 cursor-pointer hover:text-zinc-200 transition-colors group w-36"
              >
                <div className="flex items-center">
                  <span>Local Address</span>
                  {renderSortIndicator('address')}
                </div>
              </th>
              <th
                onClick={() => onSort('pid')}
                className="py-3 px-4 cursor-pointer hover:text-zinc-200 transition-colors group w-24"
              >
                <div className="flex items-center">
                  <span>PID</span>
                  {renderSortIndicator('pid')}
                </div>
              </th>
              <th
                onClick={() => onSort('process')}
                className="py-3 px-4 cursor-pointer hover:text-zinc-200 transition-colors group w-44"
              >
                <div className="flex items-center">
                  <span>Process Name</span>
                  {renderSortIndicator('process')}
                </div>
              </th>
              <th
                onClick={() => onSort('command')}
                className="py-3 px-4 cursor-pointer hover:text-zinc-200 transition-colors group min-w-[200px]"
              >
                <div className="flex items-center">
                  <span>Command Line</span>
                  {renderSortIndicator('command')}
                </div>
              </th>
              <th className="py-3 px-4 min-w-[180px]">Working Directory</th>
              <th className="py-3 px-4 w-28 text-center">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
            {items.map((item, idx) => {
              const { port, process } = item;
              const uniqueKey = `${port.address}_${port.port}_${port.pid}_${idx}`;
              const localhost = isLocalhost(port.address);
              const wildcard = isWildcard(port.address);

              return (
                <tr
                  key={uniqueKey}
                  onClick={() => onSelectItem(item)}
                  className="hover:bg-zinc-800/40 cursor-pointer transition-colors group"
                >
                  {/* Port Number */}
                  <td className="py-2.5 px-4 font-mono font-semibold text-blue-400">
                    <span className="bg-blue-950/50 border border-blue-800/40 px-2 py-0.5 rounded text-blue-300">
                      {port.port}
                    </span>
                  </td>

                  {/* Local Address & Scope */}
                  <td className="py-2.5 px-4 font-mono">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`truncate max-w-[120px] ${
                          localhost
                            ? 'text-emerald-300'
                            : wildcard
                            ? 'text-amber-300'
                            : 'text-zinc-300'
                        }`}
                        title={port.address}
                      >
                        {port.address}
                      </span>
                    </div>
                  </td>

                  {/* PID */}
                  <td className="py-2.5 px-4 font-mono font-medium text-zinc-200">
                    {port.pid}
                  </td>

                  {/* Process Name */}
                  <td className="py-2.5 px-4 font-medium text-zinc-100 group-hover:text-blue-400 transition-colors">
                    {process ? (
                      <span className="truncate max-w-[160px] block font-mono" title={process.name}>
                        {process.name}
                      </span>
                    ) : (
                      <span className="text-amber-400/80 italic text-[11px]">
                        Unavailable (PID {port.pid})
                      </span>
                    )}
                  </td>

                  {/* Command Line */}
                  <td className="py-2.5 px-4 font-mono text-zinc-300 max-w-xs truncate">
                    {process?.commandLine ? (
                      <span title={process.commandLine} className="truncate block">
                        {process.commandLine}
                      </span>
                    ) : (
                      <span className="text-zinc-600 italic">unavailable</span>
                    )}
                  </td>

                  {/* Working Directory */}
                  <td className="py-2.5 px-4 font-mono text-zinc-400 max-w-[180px] truncate">
                    {process?.workingDirectory ? (
                      <span title={process.workingDirectory} className="truncate block">
                        {process.workingDirectory}
                      </span>
                    ) : (
                      <span className="text-zinc-600 italic">unavailable</span>
                    )}
                  </td>

                  {/* State Badge */}
                  <td className="py-2.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
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
