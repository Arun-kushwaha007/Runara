import React from 'react';

const Projects: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">Projects</h2>
        <p className="text-zinc-400 mt-1">Project groups will be available in Milestone 9.</p>
      </div>
      
      <div className="flex-1 border border-dashed border-zinc-700/50 rounded-xl flex items-center justify-center bg-zinc-900/20">
        <div className="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-zinc-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-1.2-1.2A2 2 0 0 0 6.07 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
          </svg>
          <h3 className="text-lg font-medium text-zinc-300">No projects found</h3>
          <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
            You will be able to group related repositories, servers, and scripts into projects.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Projects;
