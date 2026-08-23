import React from 'react';

interface RemoveProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  profileName: string;
  projectName: string;
  isRemoving?: boolean;
}

export const RemoveProfileModal: React.FC<RemoveProfileModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  profileName,
  projectName,
  isRemoving = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150 text-app-fg">
      <div className="bg-app-surface border border-app-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-app-fg">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4 text-amber-500">
            <div className="p-2.5 bg-amber-500/15 rounded-xl border border-amber-500/30">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-app-fg">Remove Server from Project</h3>
              <p className="text-xs text-app-muted-fg">Remove profile membership</p>
            </div>
          </div>

          <div className="p-3.5 bg-app-bg border border-app-border rounded-xl text-xs text-app-fg space-y-2">
            <p>
              Remove <span className="font-semibold text-app-fg">"{profileName}"</span> from <span className="font-semibold text-app-fg">"{projectName}"</span>?
            </p>
            <p className="text-app-muted-fg text-[11px] leading-relaxed">
              The server profile will remain available in DevHub. Any currently running process will not be stopped.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isRemoving}
              className="px-4 py-2 text-xs font-medium text-app-fg bg-app-muted hover:bg-app-surface-hover border border-app-border rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isRemoving}
              className="px-4 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
            >
              {isRemoving ? 'Removing...' : 'Remove Server'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
