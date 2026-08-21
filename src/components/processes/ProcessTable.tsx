import React from 'react';
import type { ProcessIdentity, Runtime, PackageManager } from '../../types';

export type ProcessSortField =
  | 'pid'
  | 'name'
  | 'runtime'
  | 'packageManager'
  | 'commandLine'
  | 'ports';
export type SortDirection = 'asc' | 'desc';

interface ProcessTableProps {
  identities: ProcessIdentity[];
  onSelectIdentity: (identity: ProcessIdentity) => void;
  sortField: ProcessSortField;
  sortDirection: SortDirection;
  onSort: (field: ProcessSortField) => void;
}

export const ProcessTable: React.FC<ProcessTableProps> = ({
  identities,
  onSelectIdentity,
  sortField,
  sortDirection,
  onSort,
}) => {
  const renderSortIndicator = (field: ProcessSortField) => {
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

  const renderRuntimeBadge = (runtime: Runtime) => {
    switch (runtime) {
      case 'Node.js':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-green-950/60 text-green-400 border border-green-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
            Node.js
          </span>
        );
      case 'Python':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-yellow-950/60 text-yellow-400 border border-yellow-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
            Python
          </span>
        );
      case 'Java':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-950/60 text-red-400 border border-red-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
            Java
          </span>
        );
      case '.NET':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-950/60 text-purple-400 border border-purple-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            .NET
          </span>
        );
      case 'Go':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-cyan-950/60 text-cyan-400 border border-cyan-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            Go
          </span>
        );
      case 'Rust':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-orange-950/60 text-orange-400 border border-orange-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
            Rust
          </span>
        );
      default:
        return <span className="text-zinc-600 text-xs">-</span>;
    }
  };

  const renderPackageManagerBadge = (pm: PackageManager) => {
    if (pm === 'Unknown') return <span className="text-zinc-600 text-xs">-</span>;

    const colors: Record<string, string> = {
      npm: 'bg-red-950/40 text-red-300 border-red-800/30',
      pnpm: 'bg-amber-950/40 text-amber-300 border-amber-800/30',
      yarn: 'bg-blue-950/40 text-blue-300 border-blue-800/30',
      bun: 'bg-orange-950/40 text-orange-300 border-orange-800/30',
    };

    return (
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border ${
          colors[pm] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'
        }`}
      >
        {pm}
      </span>
    );
  };

  const renderStatus = (status: ProcessIdentity['process']['status']) => {
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

  if (identities.length === 0) {
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
                className="py-3 px-4 cursor-pointer hover:text-zinc-200 transition-colors group w-20"
              >
                <div className="flex items-center">
                  <span>PID</span>
                  {renderSortIndicator('pid')}
                </div>
              </th>
              <th
                onClick={() => onSort('name')}
                className="py-3 px-4 cursor-pointer hover:text-zinc-200 transition-colors group w-44"
              >
                <div className="flex items-center">
                  <span>Process Name</span>
                  {renderSortIndicator('name')}
                </div>
              </th>
              <th
                onClick={() => onSort('runtime')}
                className="py-3 px-4 cursor-pointer hover:text-zinc-200 transition-colors group w-28"
              >
                <div className="flex items-center">
                  <span>Runtime</span>
                  {renderSortIndicator('runtime')}
                </div>
              </th>
              <th
                onClick={() => onSort('packageManager')}
                className="py-3 px-4 cursor-pointer hover:text-zinc-200 transition-colors group w-24"
              >
                <div className="flex items-center">
                  <span>Pkg Mgr</span>
                  {renderSortIndicator('packageManager')}
                </div>
              </th>
              <th
                onClick={() => onSort('ports')}
                className="py-3 px-4 cursor-pointer hover:text-zinc-200 transition-colors group w-28"
              >
                <div className="flex items-center">
                  <span>Ports</span>
                  {renderSortIndicator('ports')}
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
              <th className="py-3 px-4 min-w-[160px]">Working Directory</th>
              <th className="py-3 px-4 w-28 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
            {identities.map((id) => {
              const { process: proc, runtime, packageManager, listeningPorts } = id;
              return (
                <tr
                  key={proc.pid}
                  onClick={() => onSelectIdentity(id)}
                  className="hover:bg-zinc-800/40 cursor-pointer transition-colors group"
                >
                  <td className="py-2.5 px-4 font-mono font-medium text-zinc-200">
                    {proc.pid}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-zinc-100 group-hover:text-blue-400 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[170px] font-mono" title={proc.name}>
                        {proc.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4">{renderRuntimeBadge(runtime)}</td>
                  <td className="py-2.5 px-4">{renderPackageManagerBadge(packageManager)}</td>
                  <td className="py-2.5 px-4 font-mono">
                    {listeningPorts.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {listeningPorts.map((p) => (
                          <span
                            key={p}
                            className="bg-blue-950/60 border border-blue-800/40 px-1.5 py-0.5 rounded text-[11px] text-blue-300 font-semibold"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-600 text-xs">-</span>
                    )}
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
