import React from 'react';
import type { ServerProfile } from '../../types';

interface DuplicateProfileWarningProps {
  duplicates: ServerProfile[];
  onUseExisting: (profile: ServerProfile) => void;
  onCreateAnyway: () => void;
}

export const DuplicateProfileWarning: React.FC<DuplicateProfileWarningProps> = ({
  duplicates,
  onUseExisting,
  onCreateAnyway,
}) => {
  if (duplicates.length === 0) return null;

  const primary = duplicates[0];

  return (
    <div className="p-3.5 rounded-xl bg-amber-950/70 border border-amber-600/60 text-amber-200 text-xs space-y-2.5 animate-in fade-in duration-150">
      <div className="flex items-start gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-amber-400 shrink-0 mt-0.5"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div className="flex-1 space-y-1">
          <p className="font-semibold text-amber-100">
            Similar profile already exists
          </p>
          <p className="text-amber-300/90 leading-relaxed">
            A profile matching this directory, command, and environment already exists:{' '}
            <strong className="text-amber-100 font-medium">"{primary.name}"</strong>
            {duplicates.length > 1 && ` (and ${duplicates.length - 1} other${duplicates.length > 2 ? 's' : ''})`}.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-amber-700/40">
        <button
          type="button"
          onClick={() => onUseExisting(primary)}
          className="px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium text-xs transition-colors"
        >
          Use Existing Profile
        </button>
        <button
          type="button"
          onClick={onCreateAnyway}
          className="px-2.5 py-1 rounded-md bg-amber-950 hover:bg-amber-900/80 text-amber-200 border border-amber-700/70 text-xs transition-colors"
        >
          Create Anyway
        </button>
      </div>
    </div>
  );
};
