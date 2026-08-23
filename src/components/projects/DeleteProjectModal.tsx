import React from 'react';

interface DeleteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  projectName: string;
  isDeleting?: boolean;
}

export const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  projectName,
  isDeleting = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150 text-app-fg">
      <div className="bg-app-surface border border-app-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-app-fg">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4 text-red-500">
            <div className="p-2.5 bg-red-500/15 rounded-xl border border-red-500/30">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-app-fg">Delete Project?</h3>
              <p className="text-xs text-app-muted-fg">This action will remove the project group.</p>
            </div>
          </div>

          <div className="p-3.5 bg-app-bg border border-app-border rounded-xl text-xs text-app-fg space-y-2">
            <p>
              Are you sure you want to delete <span className="font-semibold text-app-fg">"{projectName}"</span>?
            </p>
            <p className="text-app-muted-fg text-[11px] leading-relaxed">
              This only removes the project grouping. All member server profiles will remain available in DevHub, and running processes will not be stopped.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-medium text-app-fg bg-app-muted hover:bg-app-surface-hover border border-app-border rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
            >
              {isDeleting ? 'Deleting...' : 'Delete Project'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
