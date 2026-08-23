import React from 'react';
import type { StartError } from '../../types';

interface PortConflictModalProps {
  error: StartError;
  onInspectOwner?: (pid: number) => void;
  onClose: () => void;
}

export const PortConflictModal: React.FC<PortConflictModalProps> = ({
  error,
  onInspectOwner,
  onClose,
}) => {
  const { currentOwner } = error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150 text-app-fg">
      <div className="bg-app-surface border border-amber-500/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-app-fg">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500">
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
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-app-fg">
                Port Conflict Detected
              </h3>
              <p className="text-xs text-amber-600 dark:text-amber-300 font-medium">
                The expected port is already occupied by another process.
              </p>
            </div>
          </div>

          <p className="text-xs text-app-fg leading-relaxed">
            {error.message}
          </p>

          {currentOwner && (
            <div className="bg-app-bg border border-app-border rounded-xl p-3.5 space-y-2 text-xs">
              <div className="text-[11px] font-semibold text-app-muted-fg uppercase tracking-wider">
                Current Port Owner
              </div>
              <div className="grid grid-cols-2 gap-2 text-app-fg">
                <div>
                  <span className="text-app-muted-fg">Port:</span>{' '}
                  <strong className="font-mono text-app-fg">{currentOwner.port}</strong>
                </div>
                <div>
                  <span className="text-app-muted-fg">PID:</span>{' '}
                  <strong className="font-mono text-app-fg">{currentOwner.pid}</strong>
                </div>
                <div className="col-span-2">
                  <span className="text-app-muted-fg">Process Name:</span>{' '}
                  <span className="font-mono text-blue-500 font-medium">{currentOwner.processName}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-app-muted hover:bg-app-surface-hover text-app-fg rounded-lg text-xs font-medium border border-app-border transition-colors cursor-pointer"
            >
              Cancel
            </button>
            {currentOwner && onInspectOwner && (
              <button
                type="button"
                onClick={() => {
                  onInspectOwner(currentOwner.pid);
                  onClose();
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Inspect Owner Process
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
