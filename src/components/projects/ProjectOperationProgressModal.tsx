import React from 'react';
import type { ProjectOperationResult } from '../../types';

interface ProjectOperationProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: ProjectOperationResult | null;
  projectName: string;
  operationType: 'start' | 'stop' | 'restart';
}

export const ProjectOperationProgressModal: React.FC<ProjectOperationProgressModalProps> = ({
  isOpen,
  onClose,
  result,
  projectName,
  operationType,
}) => {
  if (!isOpen || !result) return null;

  const isSuccess = result.status === 'running' || result.status === 'stopped';
  const isPartial = result.status === 'partial';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150 text-app-fg">
      <div className="bg-app-surface border border-app-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col text-app-fg">
        {/* Header */}
        <div className="px-6 py-5 border-b border-app-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl border ${
                isSuccess
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : isPartial
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                  : 'bg-red-500/15 border-red-500/30 text-red-600 dark:text-red-400'
              }`}
            >
              {isSuccess ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : isPartial ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-app-fg">
                {operationType === 'start'
                  ? 'Project Startup'
                  : operationType === 'stop'
                  ? 'Project Teardown'
                  : 'Project Restart'}{' '}
                — {projectName}
              </h3>
              <p className="text-xs text-app-muted-fg">
                Status:{' '}
                <span
                  className={`font-semibold capitalize ${
                    isSuccess
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : isPartial
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {result.status}
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-app-muted-fg hover:text-app-fg p-1 rounded-lg transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Summary Banner */}
          <div
            className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
              isSuccess
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                : isPartial
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                : 'bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-300'
            }`}
          >
            {result.message}
          </div>

          {/* Breakdown List */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-app-muted-fg uppercase tracking-wider">
              Execution Sequence Breakdown
            </h4>

            {/* Started profiles */}
            {result.startedProfiles.map((name) => (
              <div
                key={`started-${name}`}
                className="flex items-center justify-between p-2.5 bg-app-bg border border-app-border rounded-xl text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                  <span className="font-medium text-app-fg">{name}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-medium">
                  Started / Running
                </span>
              </div>
            ))}

            {/* Stopped profiles */}
            {result.stoppedProfiles.map((name) => (
              <div
                key={`stopped-${name}`}
                className="flex items-center justify-between p-2.5 bg-app-bg border border-app-border rounded-xl text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="text-app-muted-fg font-bold">✓</span>
                  <span className="font-medium text-app-fg">{name}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-app-muted text-app-muted-fg border border-app-border font-medium">
                  Stopped
                </span>
              </div>
            ))}

            {/* Failed profile */}
            {result.failedProfile && (
              <div className="flex items-center justify-between p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-red-500 font-bold">✕</span>
                  <span className="font-medium text-red-600 dark:text-red-300">{result.failedProfile}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 font-medium">
                  Failed
                </span>
              </div>
            )}

            {/* Pending / Not Started profiles */}
            {result.pendingProfiles.map((name) => (
              <div
                key={`pending-${name}`}
                className="flex items-center justify-between p-2.5 bg-app-bg border border-app-border/60 rounded-xl text-xs text-app-muted-fg"
              >
                <div className="flex items-center gap-2">
                  <span className="text-app-muted-fg">○</span>
                  <span>{name}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-app-muted text-app-muted-fg border border-app-border font-medium">
                  Not Started (Fail-Fast)
                </span>
              </div>
            ))}

            {/* Unsupported WSL profiles */}
            {result.unsupportedProfiles.map((name) => (
              <div
                key={`unsupported-${name}`}
                className="flex items-center justify-between p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="text-amber-500 font-bold">!</span>
                  <span className="font-medium text-amber-700 dark:text-amber-200">{name}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-medium">
                  WSL Stop Unsupported
                </span>
              </div>
            ))}
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
    </div>
  );
};
