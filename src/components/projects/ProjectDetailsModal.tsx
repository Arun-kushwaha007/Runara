import React, { useState } from 'react';
import type { ProjectView, ProjectProfileView } from '../../types';
import { ProjectServiceLogPreview } from './ProjectServiceLogPreview';
import { ServiceLogModal } from './ServiceLogModal';

interface ProjectDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectView: ProjectView | null;
  onStart: (projectId: string) => void;
  onStop: (projectId: string) => void;
  onRestart: (projectId: string) => void;
  onEdit: (project: ProjectView) => void;
  onDelete: (project: ProjectView) => void;
  onAddProfile: (project: ProjectView) => void;
  onRemoveProfile: (project: ProjectView, profileView: ProjectProfileView) => void;
  onMoveUp: (project: ProjectView, profileIndex: number) => void;
  onMoveDown: (project: ProjectView, profileIndex: number) => void;
  onStartService?: (profileId: string) => void;
  onStopService?: (profileView: ProjectProfileView) => void;
  onInspectService?: (profileView: ProjectProfileView) => void;
  operatingProfileId?: string | null;
  isOperating?: boolean;
}

export const ProjectDetailsModal: React.FC<ProjectDetailsModalProps> = ({
  isOpen,
  onClose,
  projectView,
  onStart,
  onStop,
  onRestart,
  onEdit,
  onDelete,
  onAddProfile,
  onRemoveProfile,
  onMoveUp,
  onMoveDown,
  onStartService,
  onStopService,
  onInspectService,
  operatingProfileId,
  isOperating = false,
}) => {
  const [activeLogProfile, setActiveLogProfile] = useState<ProjectProfileView | null>(null);

  if (!isOpen || !projectView) return null;

  const { project, status, profiles, totalServices, runningServices, stoppedServices } = projectView;

  const hasWsl = profiles.some((p) => p.profile.environment.type === 'wsl');
  const isRunning = status === 'running';
  const isStarting = status === 'starting';
  const isStopping = status === 'stopping';

  const getStatusBadge = () => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Healthy ({runningServices}/{totalServices})
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Partial ({runningServices}/{totalServices})
          </span>
        );
      case 'starting':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
            <svg className="animate-spin h-3.5 w-3.5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Starting Project...
          </span>
        );
      case 'stopping':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
            <svg className="animate-spin h-3.5 w-3.5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Stopping Project...
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Error
          </span>
        );
      case 'stopped':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-app-muted text-app-muted-fg border border-app-border">
            <span className="h-2 w-2 rounded-full bg-app-muted-fg" />
            Stopped
          </span>
        );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Project details - ${project.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 text-app-fg"
    >
      <div className="bg-app-surface border border-app-border rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-app-border flex items-start justify-between gap-4 bg-app-surface">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-xl font-bold text-app-fg tracking-tight">{project.name}</h3>
              {getStatusBadge()}
              {hasWsl && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-medium">
                  Mixed / WSL Environment
                </span>
              )}
            </div>

            {project.description && (
              <p className="mt-1.5 text-xs text-app-muted-fg leading-relaxed">
                {project.description}
              </p>
            )}

            <div className="mt-2.5 flex items-center gap-3 text-xs text-app-muted-fg font-mono">
              <span>Services: <strong className="text-app-fg">{totalServices}</strong></span>
              <span>&bull;</span>
              <span className="text-emerald-600 dark:text-emerald-400">Running: <strong>{runningServices}</strong></span>
              <span>&bull;</span>
              <span>Stopped: <strong className="text-app-fg">{stoppedServices}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(projectView)}
              className="p-2 text-app-muted-fg hover:text-app-fg bg-app-muted hover:bg-app-surface-hover rounded-xl border border-app-border transition-colors cursor-pointer"
              title="Edit project details"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onDelete(projectView)}
              className="p-2 text-app-muted-fg hover:text-red-500 bg-app-muted hover:bg-red-500/10 rounded-xl border border-app-border transition-colors cursor-pointer"
              title="Delete project"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-app-muted-fg hover:text-app-fg bg-app-muted hover:bg-app-surface-hover rounded-xl border border-app-border transition-colors cursor-pointer"
              title="Close modal"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="px-6 py-3 bg-app-bg border-b border-app-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onStart(project.id)}
              disabled={isOperating || isRunning || totalServices === 0}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {isStarting ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>Start All</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onStop(project.id)}
              disabled={isOperating || stoppedServices === totalServices || totalServices === 0}
              className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white disabled:opacity-40 text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {isStopping ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Stopping...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                  <span>Stop All</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onRestart(project.id)}
              disabled={isOperating || totalServices === 0}
              className="px-3.5 py-1.5 rounded-xl bg-app-surface hover:bg-app-surface-hover text-app-fg border border-app-border disabled:opacity-40 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-app-muted-fg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span>Restart All</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onAddProfile(projectView)}
            disabled={isOperating}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add Service</span>
          </button>
        </div>

        {/* Services List Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-app-surface space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-app-muted-fg">
                Services in Startup Order ({profiles.length})
              </h4>
              <span className="text-[11px] text-app-muted-fg italic">
                {profiles.length > 1 ? 'Services start sequentially top-to-bottom' : ''}
              </span>
            </div>

            {profiles.length === 0 ? (
              <div className="text-center py-12 bg-app-bg rounded-xl border border-dashed border-app-border">
                <svg className="mx-auto h-8 w-8 text-app-muted-fg mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <p className="text-sm font-medium text-app-fg">No services configured</p>
                <p className="text-xs text-app-muted-fg mt-1 max-w-xs mx-auto">
                  Add server profiles before starting the project.
                </p>
                <button
                  onClick={() => onAddProfile(projectView)}
                  className="mt-3 px-3.5 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 hover:bg-indigo-500/25 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add First Service
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {profiles.map((item, idx) => {
                  const isItemRunning = item.status === 'running';
                  const isItemError = item.status === 'error';
                  const isItemStarting = item.status === 'starting' || operatingProfileId === item.profile.id;

                  return (
                    <div
                      key={item.profile.id}
                      className="p-3.5 bg-app-bg border border-app-border rounded-xl flex flex-col gap-2 hover:border-app-border-subtle transition-all"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          {/* Order Index Badge */}
                          <div className="flex flex-col items-center justify-center h-8 w-8 rounded-lg bg-app-surface border border-app-border text-xs font-bold font-mono text-app-fg shrink-0">
                            {idx + 1}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-app-fg truncate">
                                {item.profile.name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-app-muted text-app-muted-fg font-mono border border-app-border">
                                {item.profile.environment.type === 'wsl'
                                  ? `WSL:${item.profile.environment.distro}`
                                  : 'Windows'}
                              </span>
                              {item.profile.expectedPort && (
                                <span className="text-xs font-mono text-app-muted-fg">
                                  :{item.profile.expectedPort}
                                </span>
                              )}
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  isItemRunning
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                    : isItemStarting
                                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                                    : isItemError
                                    ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
                                    : 'bg-app-muted text-app-muted-fg border border-app-border'
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    isItemRunning
                                      ? 'bg-emerald-500'
                                      : isItemStarting
                                      ? 'bg-blue-500 animate-pulse'
                                      : isItemError
                                      ? 'bg-red-500'
                                      : 'bg-app-muted-fg'
                                  }`}
                                />
                                {isItemStarting ? 'starting...' : item.status}
                              </span>
                            </div>

                            <div className="mt-1 text-xs text-app-muted-fg font-mono truncate">
                              {item.profile.workingDirectory} &bull; {item.profile.command}
                            </div>

                            {/* Runtime details if running */}
                            {isItemRunning && item.activePid && (
                              <div className="mt-1 flex items-center gap-3 text-[11px] text-app-muted-fg">
                                <span>PID: <strong className="text-app-fg font-mono">{item.activePid}</strong></span>
                                {item.activePort && (
                                  <span>Port: <strong className="text-app-fg font-mono">:{item.activePort}</strong></span>
                                )}
                              </div>
                            )}

                            {isItemError && item.errorMessage && (
                              <div className="mt-1 text-xs text-red-500">
                                Error: {item.errorMessage}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Service Actions & Ordering */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Inspect Profile Button */}
                          {onInspectService && (
                            <button
                              onClick={() => onInspectService(item)}
                              className="px-2.5 py-1 text-xs font-medium text-app-fg bg-app-surface border border-app-border hover:bg-app-surface-hover rounded-lg transition-colors cursor-pointer"
                              title="Inspect server configuration"
                            >
                              Inspect
                            </button>
                          )}

                          {/* Individual Start / Stop Controls */}
                          {isItemRunning ? (
                            onStopService && (
                              <button
                                onClick={() => onStopService(item)}
                                disabled={isOperating || isItemStarting}
                                className="px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-300 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
                                title={isOperating ? 'Project operation in progress' : 'Stop this service'}
                              >
                                Stop
                              </button>
                            )
                          ) : (
                            onStartService && (
                              <button
                                onClick={() => onStartService(item.profile.id)}
                                disabled={isOperating || isItemStarting}
                                className="px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 disabled:opacity-40 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                title={isOperating ? 'Project operation in progress' : 'Start this service'}
                              >
                                {isItemStarting && (
                                  <svg className="animate-spin h-3 w-3 text-emerald-500" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                )}
                                Start
                              </button>
                            )
                          )}

                          {/* Reordering and removal actions */}
                          <div className="flex items-center gap-0.5 border-l border-app-border pl-1.5 ml-1">
                            <button
                              onClick={() => onMoveUp(projectView, idx)}
                              disabled={idx === 0 || isOperating}
                              className="p-1 text-app-muted-fg hover:text-app-fg hover:bg-app-surface-hover disabled:opacity-20 disabled:hover:bg-transparent rounded-lg transition-colors cursor-pointer"
                              title="Move up in startup order"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 15l-6-6-6 6" />
                              </svg>
                            </button>
                            <button
                              onClick={() => onMoveDown(projectView, idx)}
                              disabled={idx === profiles.length - 1 || isOperating}
                              className="p-1 text-app-muted-fg hover:text-app-fg hover:bg-app-surface-hover disabled:opacity-20 disabled:hover:bg-transparent rounded-lg transition-colors cursor-pointer"
                              title="Move down in startup order"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 9l6 6 6-6" />
                              </svg>
                            </button>
                            <button
                              onClick={() => onRemoveProfile(projectView, item)}
                              disabled={isOperating}
                              className="p-1 text-app-muted-fg hover:text-red-500 hover:bg-red-500/10 disabled:opacity-30 rounded-lg transition-colors ml-0.5 cursor-pointer"
                              title="Remove from project"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Milestone 16: Project Service Log Preview */}
                      <ProjectServiceLogPreview
                        profileId={item.profile.id}
                        profileName={item.profile.name}
                        status={item.status}
                        onOpenLogs={() => setActiveLogProfile(item)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-app-border bg-app-surface/90 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-app-fg bg-app-muted hover:bg-app-surface-hover border border-app-border rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Full Modal Viewer for Service Logs */}
      {activeLogProfile && (
        <ServiceLogModal
          isOpen={Boolean(activeLogProfile)}
          onClose={() => setActiveLogProfile(null)}
          profile={activeLogProfile.profile}
          status={activeLogProfile.status}
          activePort={activeLogProfile.activePort}
          activePid={activeLogProfile.activePid}
        />
      )}
    </div>
  );
};
