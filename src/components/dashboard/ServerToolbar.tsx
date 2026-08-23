import React from 'react';
import type {
  ServerSortField,
  ServerSortDirection,
  ServerFilterOptions,
  Runtime,
  WslDistribution,
} from '../../types';

interface ServerToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: ServerFilterOptions;
  onFilterChange: (filters: ServerFilterOptions) => void;
  sortField: ServerSortField;
  sortDirection: ServerSortDirection;
  onSortChange: (field: ServerSortField) => void;
  onToggleSortDirection: () => void;
  availableRuntimes: Runtime[];
  wslDistributions?: WslDistribution[];
  autoRefresh: boolean;
  onToggleAutoRefresh: (val: boolean) => void;
  onRefresh: () => void;
  loading: boolean;
  refreshing: boolean;
}

export const ServerToolbar: React.FC<ServerToolbarProps> = ({
  searchQuery,
  onSearchChange,
  filters,
  onFilterChange,
  sortField,
  sortDirection,
  onSortChange,
  onToggleSortDirection,
  availableRuntimes,
  wslDistributions = [],
  autoRefresh,
  onToggleAutoRefresh,
  onRefresh,
  loading,
  refreshing,
}) => {
  const runningWslDistros = wslDistributions.filter((d) => d.state === 'running');

  return (
    <div className="space-y-3 bg-app-surface border border-app-border rounded-xl p-4">
      {/* Top row: Search Bar & Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Field */}
        <div className="relative flex-1 min-w-[240px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-app-muted-fg">
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
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search servers by name, port (e.g. 3000), PID, distro (e.g. Fedora), runtime, command..."
            className="w-full bg-app-input border border-app-border focus:border-blue-500 rounded-lg pl-9 pr-8 py-2 text-xs text-app-fg placeholder:text-app-muted-fg focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-app-muted-fg hover:text-app-fg cursor-pointer"
              title="Clear search"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
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
          )}
        </div>

        {/* Right side controls: Auto-Refresh & Refresh Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          <label className="flex items-center gap-2 text-xs text-app-muted-fg cursor-pointer bg-app-muted border border-app-border px-3 py-1.5 rounded-lg hover:bg-app-surface-hover transition-colors select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => onToggleAutoRefresh(e.target.checked)}
              className="rounded bg-app-surface border-app-border text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span className="flex items-center gap-1.5 text-app-fg">
              {autoRefresh && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              )}
              <span>Auto-refresh (3s)</span>
            </span>
          </label>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading || refreshing}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={refreshing ? 'animate-spin' : ''}
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Bottom row: Filter Chips & Sorting */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-app-border text-xs">
        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Environment Filter */}
          <div className="flex items-center gap-1 bg-app-muted border border-app-border rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => onFilterChange({ ...filters, environment: 'all' })}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                filters.environment === 'all'
                  ? 'bg-app-surface text-app-fg font-semibold shadow-xs'
                  : 'text-app-muted-fg hover:text-app-fg'
              }`}
            >
              All Envs
            </button>
            <button
              type="button"
              onClick={() => onFilterChange({ ...filters, environment: 'windows' })}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                filters.environment === 'windows'
                  ? 'bg-blue-600/20 text-blue-600 dark:text-blue-300 border border-blue-500/40 font-semibold'
                  : 'text-app-muted-fg hover:text-app-fg'
              }`}
            >
              Windows
            </button>
            <button
              type="button"
              onClick={() => onFilterChange({ ...filters, environment: 'wsl' })}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                filters.environment === 'wsl' || filters.environment.startsWith('wsl:')
                  ? 'bg-purple-600/20 text-purple-600 dark:text-purple-300 border border-purple-500/40 font-semibold'
                  : 'text-app-muted-fg hover:text-app-fg'
              }`}
            >
              <span>WSL</span>
              {runningWslDistros.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              )}
            </button>
          </div>

          {/* If WSL filter is active and multiple running distros exist, allow selecting specific distro */}
          {(filters.environment === 'wsl' || filters.environment.startsWith('wsl:')) &&
            runningWslDistros.length > 1 && (
              <div className="flex items-center gap-1.5 bg-app-muted border border-purple-500/30 rounded-lg px-2.5 py-1">
                <span className="text-purple-600 dark:text-purple-400 text-[11px] font-medium">Distro:</span>
                <select
                  value={filters.environment}
                  onChange={(e) => onFilterChange({ ...filters, environment: e.target.value })}
                  className="bg-transparent text-xs text-app-fg focus:outline-hidden cursor-pointer"
                >
                  <option value="wsl" className="bg-app-surface text-app-fg">
                    All WSL ({runningWslDistros.length})
                  </option>
                  {runningWslDistros.map((d) => (
                    <option key={d.name} value={`wsl:${d.name}`} className="bg-app-surface text-app-fg">
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

          {/* Runtime Dropdown Filter */}
          <div className="flex items-center gap-1.5 bg-app-muted border border-app-border rounded-lg px-2.5 py-1">
            <span className="text-app-muted-fg text-[11px] font-medium">Runtime:</span>
            <select
              value={filters.runtime}
              onChange={(e) => onFilterChange({ ...filters, runtime: e.target.value })}
              className="bg-transparent text-xs text-app-fg focus:outline-hidden cursor-pointer"
            >
              <option value="all" className="bg-app-surface text-app-fg">
                All Runtimes
              </option>
              {availableRuntimes.map((rt) => (
                <option key={rt} value={rt} className="bg-app-surface text-app-fg">
                  {rt}
                </option>
              ))}
            </select>
          </div>

          {/* Managed State Filter */}
          <div className="flex items-center gap-1.5 bg-app-muted border border-app-border rounded-lg px-2.5 py-1">
            <span className="text-app-muted-fg text-[11px] font-medium">Status:</span>
            <select
              value={filters.managedStatus ?? 'all'}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  managedStatus: e.target.value as 'all' | 'managed' | 'unmanaged',
                })
              }
              className="bg-transparent text-xs text-app-fg focus:outline-hidden cursor-pointer"
            >
              <option value="all" className="bg-app-surface text-app-fg">
                All Profiles & Processes
              </option>
              <option value="managed" className="bg-app-surface text-emerald-600 dark:text-emerald-300">
                Managed Only
              </option>
              <option value="unmanaged" className="bg-app-surface text-amber-600 dark:text-amber-300">
                Unmanaged Only
              </option>
            </select>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-app-muted border border-app-border rounded-lg px-2.5 py-1">
            <span className="text-app-muted-fg text-[11px] font-medium">Sort by:</span>
            <select
              value={sortField}
              onChange={(e) => onSortChange(e.target.value as ServerSortField)}
              className="bg-transparent text-xs text-app-fg focus:outline-hidden cursor-pointer font-medium"
            >
              <option value="port" className="bg-app-surface text-app-fg">
                Port Number
              </option>
              <option value="name" className="bg-app-surface text-app-fg">
                Server Name
              </option>
              <option value="pid" className="bg-app-surface text-app-fg">
                Process ID (PID)
              </option>
              <option value="runtime" className="bg-app-surface text-app-fg">
                Runtime
              </option>
              <option value="environment" className="bg-app-surface text-app-fg">
                Environment
              </option>
            </select>

            <button
              type="button"
              onClick={onToggleSortDirection}
              title={`Sort direction: ${sortDirection === 'asc' ? 'Ascending' : 'Descending'}`}
              className="ml-1 p-1 text-app-muted-fg hover:text-app-fg rounded hover:bg-app-surface-hover transition-colors cursor-pointer"
            >
              {sortDirection === 'asc' ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m3 8 4-4 4 4" />
                  <path d="M7 4v16" />
                  <path d="M11 12h4" />
                  <path d="M11 16h7" />
                  <path d="M11 20h10" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m3 16 4 4 4-4" />
                  <path d="M7 20V4" />
                  <path d="M11 4h10" />
                  <path d="M11 8h7" />
                  <path d="M11 12h4" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
