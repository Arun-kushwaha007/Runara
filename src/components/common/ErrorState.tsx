import React from 'react';

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => {
  return (
    <div className="border border-red-900/60 bg-red-950/20 rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3">
      <div className="w-12 h-12 rounded-full bg-red-900/40 text-red-400 border border-red-800/50 flex items-center justify-center shadow-inner">
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
        <h4 className="text-sm font-bold text-red-200">Unable to inspect local development servers</h4>
        <p className="text-xs text-red-300/80 mt-1 max-w-lg mx-auto leading-relaxed">
          {error}
        </p>
      </div>

      <div className="flex items-center gap-3 mt-2">
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 bg-red-800 hover:bg-red-700 text-red-100 text-xs font-semibold rounded-lg transition-colors shadow-xs"
        >
          Retry Discovery
        </button>
      </div>

      <div className="text-[11px] text-zinc-500 max-w-md mt-2">
        Ensure DevHub has standard user permissions to query the Windows process and socket table.
      </div>
    </div>
  );
};
