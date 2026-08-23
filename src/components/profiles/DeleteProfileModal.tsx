import React from 'react';
import type { ServerProfileView } from '../../types';

interface DeleteProfileModalProps {
  view: ServerProfileView;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

export const DeleteProfileModal: React.FC<DeleteProfileModalProps> = ({
  view,
  onConfirm,
  onCancel,
  isDeleting,
}) => {
  const isRunning = view.status === 'running';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150 text-app-fg">
      <div className="bg-app-surface border border-app-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-app-fg">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-app-fg">
                Delete Server Profile?
              </h3>
              <p className="text-xs text-app-muted-fg font-mono mt-0.5">
                {view.profile.name}
              </p>
            </div>
          </div>

          {isRunning ? (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-200 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-semibold">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-amber-500 shrink-0"
                >
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>This profile is currently running.</span>
              </div>
              <p className="text-amber-800/80 dark:text-amber-300/80 leading-relaxed text-[11px]">
                Deleting the profile will permanently remove the saved configuration from SQLite, but will <strong>not terminate the running operating system process</strong>.
              </p>
            </div>
          ) : (
            <p className="text-xs text-app-fg leading-relaxed">
              Are you sure you want to delete <strong className="text-app-fg font-bold">{view.profile.name}</strong>? This action will remove the saved configuration from DevHub.
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-app-muted hover:bg-app-surface-hover text-app-fg rounded-lg text-xs font-medium border border-app-border transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              {isDeleting ? 'Deleting...' : 'Delete Profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
