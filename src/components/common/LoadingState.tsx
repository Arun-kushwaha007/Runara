import React from 'react';

export const LoadingState: React.FC = () => {
  return (
    <div className="space-y-4">
      {/* Top Banner Status */}
      <div className="border border-zinc-800/80 rounded-xl p-6 text-center bg-zinc-900/30 flex flex-col items-center justify-center gap-3">
        <div className="relative">
          <svg
            className="animate-spin h-7 w-7 text-blue-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
        <div>
          <p className="text-sm text-zinc-200 font-semibold">Discovering local development servers...</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Querying Windows & WSL listening TCP endpoints, process PEBs, ancestry trees & runtimes
          </p>
        </div>
      </div>

      {/* Skeleton Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-4 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="h-5 bg-zinc-800 rounded w-1/2"></div>
              <div className="h-5 bg-zinc-800 rounded-full w-16"></div>
            </div>
            <div className="h-8 bg-zinc-800/80 rounded w-1/3"></div>
            <div className="space-y-2 pt-2 border-t border-zinc-800/60">
              <div className="h-3.5 bg-zinc-800/60 rounded w-4/5"></div>
              <div className="h-3.5 bg-zinc-800/60 rounded w-3/5"></div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="h-4 bg-zinc-800/60 rounded w-20"></div>
              <div className="h-7 bg-zinc-800 rounded w-16"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
