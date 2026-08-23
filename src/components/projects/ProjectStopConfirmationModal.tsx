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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-100">Stop All Services?</h3>
              <p className="text-xs text-zinc-400">
                Project: <strong className="text-zinc-200">{project.name}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isOperating}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <p className="text-xs text-zinc-300 leading-relaxed">
            {runningServices > 0 ? (
              <>
                <strong className="text-rose-400">{runningServices}</strong> running {runningServices === 1 ? 'service' : 'services'} will be stopped in reverse configured order.
              </>
            ) : (
              'All member services in this project are already stopped.'
            )}
          </p>

          {runningProfilesReverse.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Reverse Teardown Sequence ({runningProfilesReverse.length})
              </div>
              <div className="space-y-1.5 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
                {runningProfilesReverse.map((item, idx) => (
                  <div key={item.profile.id} className="flex items-center justify-between text-xs py-1 px-1.5 rounded">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-zinc-500 text-[11px]">{idx + 1}.</span>
                      <span className="font-medium text-zinc-200">{item.profile.name}</span>
                      <span className="text-[10px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                        {item.profile.environment.type === 'wsl'
                          ? `WSL:${item.profile.environment.distro}`
                          : 'Windows'}
                      </span>
                    </div>
                    {item.activePort && (
                      <span className="font-mono text-[11px] text-zinc-400">:{item.activePort}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/40 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isOperating}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/60 hover:bg-zinc-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isOperating}
            className="px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 rounded-xl transition-colors flex items-center gap-1.5"
          >
            {isOperating ? 'Stopping Services...' : 'Stop All Services'}
          </button>
        </div>
      </div>
    </div>
  );
};
