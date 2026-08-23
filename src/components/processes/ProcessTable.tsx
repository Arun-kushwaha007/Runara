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
      <span className="text-blue-500 ml-1 inline-block">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  const renderRuntimeBadge = (runtime: Runtime) => {
    switch (runtime) {
      case 'Node.js':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Node.js
          </span>
        );
      case 'Python':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Python
          </span>
        );
      case 'Java':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            Java
          </span>
        );
      case '.NET':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            .NET
          </span>
        );
      case 'Go':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
            Go
          </span>
        );
      case 'Rust':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
            Rust
          </span>
        );
      default:
        return <span className="text-app-muted-fg text-xs">-</span>;
    }
  };

  const renderPackageManagerBadge = (pm: PackageManager) => {
    if (pm === 'Unknown') return <span className="text-app-muted-fg text-xs">-</span>;

    const colors: Record<string, string> = {
      npm: 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30',
      pnpm: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
      yarn: 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30',
      bun: 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/30',
    };

    return (
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border ${
          colors[pm] ?? 'bg-app-muted text-app-muted-fg border-app-border'
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Running
          </span>
        );
      case 'accessrestricted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            Restricted
          </span>
        );
      case 'unavailable':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-app-muted text-app-muted-fg border border-app-border">
            Unavailable
          </span>
        );
      default:
        return <span className="text-app-muted-fg text-xs">-</span>;
    }
  };

  if (identities.length === 0) {
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
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <p className="text-sm font-medium text-app-fg">No matching processes found</p>
        <p className="text-xs text-app-muted-fg mt-1">Try adjusting your search criteria.</p>
      </div>
    );
  }

  return (
    <div className="border border-app-border rounded-xl overflow-hidden bg-app-surface shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-app-muted border-b border-app-border text-app-muted-fg select-none font-medium">
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
                onClick={() => onSort('name')}
                className="py-3 px-4 cursor-pointer hover:text-app-fg transition-colors group w-44"
              >
                <div className="flex items-center">
                  <span>Process Name</span>
                  {renderSortIndicator('name')}
                </div>
              </th>
              <th
                onClick={() => onSort('runtime')}
                className="py-3 px-4 cursor-pointer hover:text-app-fg transition-colors group w-28"
              >
                <div className="flex items-center">
                  <span>Runtime</span>
                  {renderSortIndicator('runtime')}
                </div>
              </th>
              <th
                onClick={() => onSort('packageManager')}
                className="py-3 px-4 cursor-pointer hover:text-app-fg transition-colors group w-24"
              >
                <div className="flex items-center">
                  <span>Pkg Mgr</span>
                  {renderSortIndicator('packageManager')}
                </div>
              </th>
              <th
                onClick={() => onSort('ports')}
                className="py-3 px-4 cursor-pointer hover:text-app-fg transition-colors group w-28"
              >
                <div className="flex items-center">
                  <span>Ports</span>
                  {renderSortIndicator('ports')}
                </div>
              </th>
              <th
                onClick={() => onSort('commandLine')}
                className="py-3 px-4 cursor-pointer hover:text-app-fg transition-colors group min-w-[200px]"
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
          <tbody className="divide-y divide-app-border text-app-fg">
            {identities.map((id) => {
              const { process: proc, runtime, packageManager, listeningPorts } = id;
              return (
                <tr
                  key={proc.pid}
                  onClick={() => onSelectIdentity(id)}
                  className="hover:bg-app-surface-hover cursor-pointer transition-colors group"
                >
                  <td className="py-2.5 px-4 font-mono font-medium text-app-fg">
                    {proc.pid}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-app-fg group-hover:text-blue-500 transition-colors">
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
                            className="bg-blue-600/10 border border-blue-500/30 px-1.5 py-0.5 rounded text-[11px] text-blue-600 dark:text-blue-300 font-semibold"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-app-muted-fg text-xs">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-app-fg max-w-xs truncate">
                    {proc.commandLine ? (
                      <span title={proc.commandLine} className="truncate block">
                        {proc.commandLine}
                      </span>
                    ) : (
                      <span className="text-app-muted-fg italic">unavailable</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-app-muted-fg max-w-[180px] truncate">
                    {proc.workingDirectory ? (
                      <span title={proc.workingDirectory} className="truncate block">
                        {proc.workingDirectory}
                      </span>
                    ) : (
                      <span className="text-app-muted-fg italic">unavailable</span>
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
