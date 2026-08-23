import React from 'react';

interface EmptyStateProps {
  isFiltered?: boolean;
  onClearFilters?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  isFiltered = false,
  onClearFilters,
}) => {
  return (
    <div className="border border-dashed border-app-border rounded-2xl p-12 text-center bg-app-surface/40 flex flex-col items-center justify-center">
      <div className="w-14 h-14 rounded-2xl bg-app-muted border border-app-border flex items-center justify-center text-app-muted-fg mb-4 shadow-inner">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
          <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
          <line x1="6" x2="6.01" y1="6" y2="6" />
          <line x1="6" x2="6.01" y1="18" y2="18" />
        </svg>
      </div>

      <h3 className="text-base font-semibold text-app-fg">
        {isFiltered
          ? 'No matching development servers'
          : 'No running development servers found'}
      </h3>

      <p className="text-xs text-app-muted-fg mt-1.5 max-w-md mx-auto leading-relaxed">
        {isFiltered
          ? 'No active development servers matched your current search query or filter criteria. Try adjusting your query or resetting filters.'
          : 'Runara is actively monitoring your local Windows and WSL environments. Start a development server (e.g. npm run dev, vite, uvicorn, cargo run) or launch a Server Profile to begin.'}
      </p>

      {isFiltered && onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-4 px-3.5 py-1.5 bg-app-muted hover:bg-app-surface-hover text-app-fg text-xs font-medium rounded-lg border border-app-border transition-colors cursor-pointer"
        >
          Clear search & filters
        </button>
      )}

      {!isFiltered && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] text-app-muted-fg bg-app-surface border border-app-border px-4 py-2 rounded-lg">
          <span>Supported runtimes:</span>
          <span className="text-app-fg font-mono">Node.js (npm / pnpm / yarn / bun)</span>
          <span>•</span>
          <span className="text-app-fg font-mono">Python (uvicorn / django / flask)</span>
          <span>•</span>
          <span className="text-app-fg font-mono">Rust (cargo)</span>
          <span>•</span>
          <span className="text-app-fg font-mono">.NET / Go / Java</span>
        </div>
      )}
    </div>
  );
};
