import React from 'react';
import type { ProjectView } from '../../types';

interface ProjectRestartConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  projectView: ProjectView | null;
  isOperating?: boolean;
}

export const ProjectRestartConfirmationModal: React.FC<ProjectRestartConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  projectView,
  isOperating = false,
}) => {
  if (!isOpen || !projectView) return null;

  const { project, profiles, totalServices, runningServices } = projectView;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-100">Restart Project?</h3>
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
            Restarting <strong className="text-zinc-100">{project.name}</strong> will:
          </p>

          <ol className="list-decimal list-inside space-y-2 text-xs text-zinc-400 bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800/80">
            <li>
              Stop all <strong className="text-amber-300">{runningServices}</strong> currently running services in reverse configured order.
            </li>
            <li>Wait for socket teardown and operating system port release.</li>
            <li>
              Sequentially start all <strong className="text-emerald-300">{totalServices}</strong> member services in configured order.
            </li>
          </ol>

          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Startup Sequence Order ({profiles.length})
            </div>
            <div className="space-y-1 bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-800/60">
              {profiles.map((item, idx) => (
                <div key={item.profile.id} className="flex items-center justify-between text-xs py-1 px-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-zinc-500 text-[11px]">{idx + 1}.</span>
                    <span className="font-medium text-zinc-200">{item.profile.name}</span>
                    <span className="text-[10px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                      {item.profile.environment.type === 'wsl'
                        ? `WSL:${item.profile.environment.distro}`
                        : 'Windows'}
                    </span>
                  </div>
                  {item.profile.expectedPort && (
                    <span className="font-mono text-[11px] text-zinc-400">:{item.profile.expectedPort}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
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
            className="px-4 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-xl transition-colors flex items-center gap-1.5"
          >
            {isOperating ? 'Restarting Project...' : 'Restart Project'}
          </button>
        </div>
      </div>
    </div>
  );
};
