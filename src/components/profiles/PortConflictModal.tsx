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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-amber-600/50 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-800/60 text-amber-400">
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
              <h3 className="text-base font-semibold text-zinc-100">
                Port Conflict Detected
              </h3>
              <p className="text-xs text-amber-300/90 font-medium">
                The expected port is already occupied by another process.
              </p>
            </div>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed">
            {error.message}
          </p>

          {currentOwner && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Current Port Owner
              </div>
              <div className="grid grid-cols-2 gap-2 text-zinc-300">
                <div>
                  <span className="text-zinc-500">Port:</span>{' '}
                  <strong className="font-mono text-zinc-100">{currentOwner.port}</strong>
                </div>
                <div>
                  <span className="text-zinc-500">PID:</span>{' '}
                  <strong className="font-mono text-zinc-100">{currentOwner.pid}</strong>
                </div>
                <div className="col-span-2">
                  <span className="text-zinc-500">Process Name:</span>{' '}
                  <span className="font-mono text-blue-300">{currentOwner.processName}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
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
