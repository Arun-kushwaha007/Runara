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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4 text-amber-400">
            <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-100">Remove Server from Project</h3>
              <p className="text-xs text-zinc-400">Remove profile membership</p>
            </div>
          </div>

          <div className="p-3.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-xs text-zinc-300 space-y-2">
            <p>
              Remove <span className="font-semibold text-zinc-100">"{profileName}"</span> from <span className="font-semibold text-zinc-100">"{projectName}"</span>?
            </p>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              The server profile will remain available in DevHub. Any currently running process will not be stopped.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isRemoving}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/60 hover:bg-zinc-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isRemoving}
              className="px-4 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-2"
            >
              {isRemoving ? 'Removing...' : 'Remove Server'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
