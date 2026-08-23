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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Healthy ({runningServices}/{totalServices})
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Partial ({runningServices}/{totalServices})
          </span>
        );
      case 'starting':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
            <svg className="animate-spin h-3 w-3 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Starting...
          </span>
        );
      case 'stopping':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
            <svg className="animate-spin h-3 w-3 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Stopping...
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            Error
          </span>
        );
      case 'stopped':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-app-muted text-app-muted-fg border border-app-border">
            <span className="h-1.5 w-1.5 rounded-full bg-app-muted-fg" />
            Stopped
          </span>
        );
    }
  };

  return (
    <div
      data-testid={`project-card-${project.id}`}
      className="bg-app-surface border border-app-border rounded-xl p-5 hover:border-app-border-subtle transition-all flex flex-col justify-between shadow-xs text-app-fg"
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h3 className="font-semibold text-lg text-app-fg tracking-tight">{project.name}</h3>
            {project.description && (
              <p className="text-xs text-app-muted-fg mt-0.5 line-clamp-2">{project.description}</p>
            )}
            {environmentsSummary && (
              <div
                className="text-[11px] text-app-muted-fg mt-1 font-mono"
                dangerouslySetInnerHTML={{ __html: environmentsSummary }}
              />
            )}
          </div>
          {getStatusBadge()}
        </div>

        {/* Member Services Summary */}
        <div className="mt-4 mb-4">
          <div className="text-xs font-medium text-app-muted-fg uppercase tracking-wider mb-2">
            Services ({totalServices})
          </div>
          {profiles.length === 0 ? (
            <div className="text-xs text-app-muted-fg italic bg-app-bg p-2.5 rounded-lg border border-dashed border-app-border">
              No services configured yet.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {profiles.map((item, idx) => (
                <div
                  key={item.profile.id}
                  className="flex items-center justify-between text-xs bg-app-bg px-2.5 py-1.5 rounded-lg border border-app-border"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-app-muted-fg font-mono text-[10px] w-3.5">{idx + 1}.</span>
                    <span className="font-medium text-app-fg truncate">{item.profile.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-app-muted text-app-muted-fg border border-app-border font-mono">
                      {item.profile.environment.type === 'wsl'
                        ? `WSL:${item.profile.environment.distro}`
                        : 'Win'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.profile.expectedPort && (
                      <span className="text-app-muted-fg font-mono text-[11px]">
                        :{item.profile.expectedPort}
                      </span>
                    )}
                    <span
                      className={`h-2 w-2 rounded-full ${
                        item.status === 'running'
                          ? 'bg-emerald-500'
                          : item.status === 'starting'
                          ? 'bg-blue-500 animate-pulse'
                          : item.status === 'error'
                          ? 'bg-red-500'
                          : 'bg-app-muted-fg'
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
      <div className="pt-3 border-t border-app-border flex items-center justify-between gap-2 mt-auto">
        <button
          onClick={() => onInspect(projectView)}
          className="px-3 py-1.5 text-xs font-medium text-app-fg bg-app-muted hover:bg-app-surface-hover rounded-lg border border-app-border transition-colors cursor-pointer"
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
              className="px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
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
              className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-300 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
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
              className="px-3 py-1.5 text-xs font-medium text-app-fg bg-app-muted hover:bg-app-surface-hover rounded-lg border border-app-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
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
