import React from 'react';
import type { ProcessInfo } from '../../types';

export type SortField = 'pid' | 'name' | 'parentPid' | 'commandLine';
export type SortDirection = 'asc' | 'desc';

interface ProcessTableProps {
  processes: ProcessInfo[];
  onSelectProcess: (process: ProcessInfo) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}

export const ProcessTable: React.FC<ProcessTableProps> = ({
  processes,
  onSelectProcess,
  sortField,
  sortDirection,
  onSort,
}) => {
  const renderSortIndicator = (field: SortField) => {
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

  const renderStatus = (status: ProcessInfo['status']) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Running
          </span>
        );
      case 'accessrestricted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-950/60 text-amber-400 border border-amber-800/40">
            Restricted
          </span>
        );
      case 'unavailable':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/50">
            Unavailable
          </span>
        );
      default:
        return <span className="text-zinc-500 text-xs">-</span>;
    }
  };

  if (processes.length === 0) {
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
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <p className="text-sm font-medium text-zinc-300">No matching processes found</p>
        <p className="text-xs text-zinc-500 mt-1">Try adjusting your search criteria.</p>
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
                onClick={() => onSort('pid')}
                className="py-3 px-4 cursor-pointer hover:text-zinc-200 transition-colors group w-24"
              >
                <div className="flex items-center">
                  <span>PID</span>
                  {renderSortIndicator('pid')}
                </div>
              </th>
              <th
                onClick={() => onSort('name')}
                className="py-3 px-4 cursor-pointer hover:text-zinc-200 transition-colors group w-48"
              >
                <div className="flex items-center">
                  <span>Process Name</span>
                  {renderSortIndicator('name')}
                </div>
              </th>
              <th
                onClick={() => onSort('parentPid')}
                className="py-3 px-4 cursor-pointer hover:text-zinc-200 transition-colors group w-24"
              >
                <div className="flex items-center">
                  <span>PPID</span>
                  {renderSortIndicator('parentPid')}
                </div>
              </th>
              <th
                onClick={() => onSort('commandLine')}
                className="py-3 px-4 cursor-pointer hover:text-zinc-200 transition-colors group min-w-[200px]"
              >
                <div className="flex items-center">
                  <span>Command Line</span>
                  {renderSortIndicator('commandLine')}
                </div>
              </th>
              <th className="py-3 px-4 min-w-[200px]">Executable Path</th>
              <th className="py-3 px-4 min-w-[160px]">Working Directory</th>
              <th className="py-3 px-4 w-28 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
            {processes.map((proc) => (
              <tr
                key={proc.pid}
                onClick={() => onSelectProcess(proc)}
                className="hover:bg-zinc-800/40 cursor-pointer transition-colors group"
              >
                <td className="py-2.5 px-4 font-mono font-medium text-zinc-200">
                  {proc.pid}
                </td>
                <td className="py-2.5 px-4 font-medium text-zinc-100 group-hover:text-blue-400 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="truncate max-w-[180px]" title={proc.name}>
                      {proc.name}
                    </span>
                  </div>
                </td>
                <td className="py-2.5 px-4 font-mono text-zinc-400">
                  {proc.parentPid ?? <span className="text-zinc-600">-</span>}
                </td>
                <td className="py-2.5 px-4 font-mono text-zinc-300 max-w-xs truncate">
                  {proc.commandLine ? (
                    <span title={proc.commandLine} className="truncate block">
                      {proc.commandLine}
                    </span>
                  ) : (
                    <span className="text-zinc-600 italic">unavailable</span>
                  )}
                </td>
                <td className="py-2.5 px-4 font-mono text-zinc-400 max-w-xs truncate">
                  {proc.executablePath ? (
                    <span title={proc.executablePath} className="truncate block">
                      {proc.executablePath}
                    </span>
                  ) : (
                    <span className="text-zinc-600 italic">unavailable</span>
                  )}
                </td>
                <td className="py-2.5 px-4 font-mono text-zinc-400 max-w-[180px] truncate">
                  {proc.workingDirectory ? (
                    <span title={proc.workingDirectory} className="truncate block">
                      {proc.workingDirectory}
                    </span>
                  ) : (
                    <span className="text-zinc-600 italic">unavailable</span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-center">
                  {renderStatus(proc.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
