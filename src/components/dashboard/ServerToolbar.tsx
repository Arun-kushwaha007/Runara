import React from 'react';
import type {
  ServerSortField,
  ServerSortDirection,
  ServerFilterOptions,
  Runtime,
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
  autoRefresh,
  onToggleAutoRefresh,
  onRefresh,
  loading,
  refreshing,
}) => {
  return (
    <div className="space-y-3 bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4">
      {/* Top row: Search Bar & Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Field */}
        <div className="relative flex-1 min-w-[240px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
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
            placeholder="Search servers by name, port (e.g. 3000), PID, runtime, command, CWD..."
            className="w-full bg-zinc-950/80 border border-zinc-800 focus:border-blue-500/80 rounded-lg pl-9 pr-8 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-400 hover:text-zinc-200"
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
          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer bg-zinc-950/60 border border-zinc-800 px-3 py-1.5 rounded-lg hover:bg-zinc-800/50 transition-colors select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => onToggleAutoRefresh(e.target.checked)}
              className="rounded bg-zinc-900 border-zinc-700 text-blue-600 focus:ring-0 focus:ring-offset-0"
            />
            <span className="flex items-center gap-1.5">
              {autoRefresh && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              )}
              <span>Auto-refresh (3s)</span>
            </span>
          </label>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading || refreshing}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
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
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/60 text-xs">
        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Environment Filter */}
          <div className="flex items-center gap-1 bg-zinc-950/60 border border-zinc-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => onFilterChange({ ...filters, environment: 'all' })}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filters.environment === 'all'
                  ? 'bg-zinc-800 text-zinc-100 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All Envs
            </button>
            <button
              type="button"
              onClick={() => onFilterChange({ ...filters, environment: 'windows' })}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filters.environment === 'windows'
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Windows
            </button>
            <button
              type="button"
              disabled
              title="WSL integration coming in Milestone 6"
              className="px-2.5 py-1 rounded-md text-xs font-medium text-zinc-600 cursor-not-allowed opacity-60 flex items-center gap-1"
            >
              <span>WSL</span>
              <span className="text-[9px] uppercase px-1 rounded bg-zinc-800 text-zinc-500">M6</span>
            </button>
          </div>

          {/* Runtime Dropdown Filter */}
          <div className="flex items-center gap-1.5 bg-zinc-950/60 border border-zinc-800 rounded-lg px-2.5 py-1">
            <span className="text-zinc-500 text-[11px] font-medium">Runtime:</span>
            <select
              value={filters.runtime}
              onChange={(e) => onFilterChange({ ...filters, runtime: e.target.value })}
              className="bg-transparent text-xs text-zinc-200 focus:outline-hidden cursor-pointer"
            >
              <option value="all" className="bg-zinc-900 text-zinc-200">
                All Runtimes
              </option>
              {availableRuntimes.map((rt) => (
                <option key={rt} value={rt} className="bg-zinc-900 text-zinc-200">
                  {rt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-zinc-950/60 border border-zinc-800 rounded-lg px-2.5 py-1">
            <span className="text-zinc-500 text-[11px] font-medium">Sort by:</span>
            <select
              value={sortField}
              onChange={(e) => onSortChange(e.target.value as ServerSortField)}
              className="bg-transparent text-xs text-zinc-200 focus:outline-hidden cursor-pointer font-medium"
            >
              <option value="port" className="bg-zinc-900 text-zinc-200">
                Port Number
              </option>
              <option value="name" className="bg-zinc-900 text-zinc-200">
                Server Name
              </option>
              <option value="pid" className="bg-zinc-900 text-zinc-200">
                Process ID (PID)
              </option>
              <option value="runtime" className="bg-zinc-900 text-zinc-200">
                Runtime
              </option>
            </select>

            <button
              type="button"
              onClick={onToggleSortDirection}
              title={`Sort direction: ${sortDirection === 'asc' ? 'Ascending' : 'Descending'}`}
              className="ml-1 p-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-800 transition-colors"
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
