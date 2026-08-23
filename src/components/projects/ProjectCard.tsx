import React, { useMemo } from 'react';
import type { ProjectView } from '../../types';

interface ProjectCardProps {
  projectView: ProjectView;
  onInspect: (projectView: ProjectView) => void;
  onStart: (projectId: string) => void;
  onStop: (projectId: string) => void;
  onRestart: (projectId: string) => void;
  isOperating?: boolean;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  projectView,
  onInspect,
  onStart,
  onStop,
  onRestart,
  isOperating = false,
}) => {
  const { project, status, profiles, totalServices, runningServices } = projectView;

  const isRunning = status === 'running';
  const isPartial = status === 'partial';
  const isError = status === 'error';
  const isStarting = status === 'starting';
  const isStopping = status === 'stopping';

  // Extract distinct environments represented in this project
  const environmentsSummary = useMemo(() => {
    const set = new Set<string>();
    for (const p of profiles) {
      if (p.profile.environment.type === 'wsl') {
        set.add(`WSL / ${p.profile.environment.distro}`);
      } else {
        set.add('Windows');
      }
    }
    return Array.from(set).join(' &bull; ');
  }, [profiles]);

  const getStatusBadge = () => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Healthy ({runningServices}/{totalServices})
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Partial ({runningServices}/{totalServices})
          </span>
        );
      case 'starting':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <svg className="animate-spin h-3 w-3 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Starting...
          </span>
        );
      case 'stopping':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <svg className="animate-spin h-3 w-3 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Stopping...
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            Error
          </span>
        );
      case 'stopped':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700/50">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
            Stopped
          </span>
        );
    }
  };

  return (
    <div
      data-testid={`project-card-${project.id}`}
      className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700/80 transition-all flex flex-col justify-between shadow-sm"
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h3 className="font-semibold text-lg text-zinc-100 tracking-tight">{project.name}</h3>
            {project.description && (
              <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{project.description}</p>
            )}
            {environmentsSummary && (
              <div
                className="text-[11px] text-zinc-500 mt-1 font-mono"
                dangerouslySetInnerHTML={{ __html: environmentsSummary }}
              />
            )}
          </div>
          {getStatusBadge()}
        </div>

        {/* Member Services Summary */}
        <div className="mt-4 mb-4">
          <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
            Services ({totalServices})
          </div>
          {profiles.length === 0 ? (
            <div className="text-xs text-zinc-500 italic bg-zinc-950/40 p-2.5 rounded-lg border border-dashed border-zinc-800">
              No services configured yet.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {profiles.map((item, idx) => (
                <div
                  key={item.profile.id}
                  className="flex items-center justify-between text-xs bg-zinc-950/40 px-2.5 py-1.5 rounded-lg border border-zinc-800/60"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-zinc-500 font-mono text-[10px] w-3.5">{idx + 1}.</span>
                    <span className="font-medium text-zinc-200 truncate">{item.profile.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/40 font-mono">
                      {item.profile.environment.type === 'wsl'
                        ? `WSL:${item.profile.environment.distro}`
                        : 'Win'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.profile.expectedPort && (
                      <span className="text-zinc-400 font-mono text-[11px]">
                        :{item.profile.expectedPort}
                      </span>
                    )}
                    <span
                      className={`h-2 w-2 rounded-full ${
                        item.status === 'running'
                          ? 'bg-emerald-400'
                          : item.status === 'starting'
                          ? 'bg-blue-400 animate-pulse'
                          : item.status === 'error'
                          ? 'bg-rose-400'
                          : 'bg-zinc-600'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2 mt-auto">
        <button
          onClick={() => onInspect(projectView)}
          className="px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-white rounded-lg transition-colors"
        >
          Open Details
        </button>

        <div className="flex items-center gap-2">
          {/* Start All Button */}
          {(!isRunning || isPartial || isError) && (
            <button
              onClick={() => onStart(project.id)}
              disabled={isOperating || isStarting || isStopping || totalServices === 0}
              title={isOperating ? 'Project operation in progress' : 'Start all stopped services'}
              className="px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/60 border border-emerald-800/50 hover:bg-emerald-900/80 hover:text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              Start All
            </button>
          )}

          {/* Stop All Button */}
          {(isRunning || isPartial) && (
            <button
              onClick={() => onStop(project.id)}
              disabled={isOperating || isStarting || isStopping}
              title={isOperating ? 'Project operation in progress' : 'Stop all running services'}
              className="px-3 py-1.5 text-xs font-medium text-rose-300 bg-rose-950/60 border border-rose-800/50 hover:bg-rose-900/80 hover:text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h12v12H6z" />
              </svg>
              Stop All
            </button>
          )}

          {/* Restart All Button */}
          {(isRunning || isPartial) && (
            <button
              onClick={() => onRestart(project.id)}
              disabled={isOperating || isStarting || isStopping}
              title={isOperating ? 'Project operation in progress' : 'Restart all services'}
              className="px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              Restart
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

