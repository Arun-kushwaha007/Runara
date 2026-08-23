import React from 'react';

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => {
  return (
    <div className="border border-red-500/30 bg-red-500/10 rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3">
      <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-500 border border-red-500/30 flex items-center justify-center shadow-inner">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <div>
        <h4 className="text-sm font-bold text-red-600 dark:text-red-300">Unable to inspect local development servers</h4>
        <p className="text-xs text-red-700/80 dark:text-red-300/80 mt-1 max-w-lg mx-auto leading-relaxed">
          {error}
        </p>
      </div>

      <div className="flex items-center gap-3 mt-2">
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer"
        >
          Retry Discovery
        </button>
      </div>

      <div className="text-[11px] text-app-muted-fg max-w-md mt-2">
        Ensure Runara has standard permissions to query the Windows and WSL process and socket tables.
      </div>
    </div>
  );
};
