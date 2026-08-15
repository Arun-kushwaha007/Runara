import React from 'react';

const Servers: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">Servers</h2>
        <p className="text-zinc-400 mt-1">Server management will be available in Milestone 4.</p>
      </div>
      
      <div className="flex-1 border border-dashed border-zinc-700/50 rounded-xl flex items-center justify-center bg-zinc-900/20">
        <div className="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-zinc-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
            <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
            <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
            <line x1="6" x2="6.01" y1="6" y2="6" />
            <line x1="6" x2="6.01" y1="18" y2="18" />
          </svg>
          <h3 className="text-lg font-medium text-zinc-300">No servers configured</h3>
          <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
            You will be able to add, monitor, and manage your local development servers here.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Servers;
