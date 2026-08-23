import React from 'react';
import type { ProjectView } from '../../types';

interface ProjectStopConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  projectView: ProjectView | null;
  isOperating?: boolean;
}

export const ProjectStopConfirmationModal: React.FC<ProjectStopConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  projectView,
  isOperating = false,
}) => {
  if (!isOpen || !projectView) return null;

  const { project, profiles, runningServices } = projectView;

  // Compute the running profiles in reverse configured order
  const runningProfilesReverse = [...profiles]
    .reverse()
    .filter((p) => p.status === 'running');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150 text-app-fg">
      <div className="bg-app-surface border border-app-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col text-app-fg">
        {/* Header */}
        <div className="px-6 py-5 border-b border-app-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-500">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-app-fg">Stop All Services?</h3>
              <p className="text-xs text-app-muted-fg">
                Project: <strong className="text-app-fg">{project.name}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isOperating}
            className="text-app-muted-fg hover:text-app-fg p-1 rounded-lg transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <p className="text-xs text-app-fg leading-relaxed">
            {runningServices > 0 ? (
              <>
                <strong className="text-red-500 font-semibold">{runningServices}</strong> running {runningServices === 1 ? 'service' : 'services'} will be stopped in reverse configured order.
              </>
            ) : (
              'All member services in this project are already stopped.'
            )}
          </p>

          {runningProfilesReverse.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-app-muted-fg uppercase tracking-wider mb-2">
                Reverse Teardown Sequence ({runningProfilesReverse.length})
              </div>
              <div className="space-y-1.5 bg-app-bg p-3 rounded-xl border border-app-border">
                {runningProfilesReverse.map((item, idx) => (
                  <div key={item.profile.id} className="flex items-center justify-between text-xs py-1 px-1.5 rounded">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-app-muted-fg text-[11px]">{idx + 1}.</span>
                      <span className="font-medium text-app-fg">{item.profile.name}</span>
                      <span className="text-[10px] px-1 py-0.5 rounded bg-app-muted text-app-muted-fg font-mono border border-app-border">
                        {item.profile.environment.type === 'wsl'
                          ? `WSL:${item.profile.environment.distro}`
                          : 'Windows'}
                      </span>
                    </div>
                    {item.activePort && (
                      <span className="font-mono text-[11px] text-app-muted-fg">:{item.activePort}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-app-border bg-app-surface/90 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isOperating}
            className="px-4 py-2 text-xs font-medium text-app-fg bg-app-muted hover:bg-app-surface-hover border border-app-border rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isOperating}
            className="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {isOperating ? 'Stopping Services...' : 'Stop All Services'}
          </button>
        </div>
      </div>
    </div>
  );
};
