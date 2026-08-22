import React from 'react';
import type { ServerProfileView } from '../../types';
import { CopyButton } from '../common/CopyButton';

interface ProfileCardProps {
  view: ServerProfileView;
  isStarting: boolean;
  isStopping?: boolean;
  onStart: (profileId: string) => void;
  onRestart: (profileId: string) => void;
  onStop?: (view: ServerProfileView) => void;
  onEdit: (view: ServerProfileView) => void;
  onDelete: (view: ServerProfileView) => void;
  onInspect?: (view: ServerProfileView) => void;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  view,
  isStarting,
  isStopping = false,
  onStart,
  onRestart,
  onStop,
  onEdit,
  onDelete,
  onInspect,
}) => {
  const { profile, status, activePid, activePort, errorMessage } = view;
  const isRunning = status === 'running';
  const isError = status === 'error';
  const isStartingState = status === 'starting' || isStarting;

  return (
    <div className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 rounded-xl p-5 transition-all duration-200 shadow-sm flex flex-col justify-between gap-4">
      {/* Header Section: Title, Environment Badge, Status Dot */}
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-zinc-100 truncate tracking-tight">
                {profile.name}
              </h3>

              {/* Environment Badge */}
              {profile.environment.type === 'wsl' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-purple-950/80 text-purple-300 border border-purple-800/50">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m4 6 8-4 8 4" />
                    <path d="m18 10 4 2-8 4-8-4 4-2" />
                    <path d="m4 14 8 4 8-4" />
                  </svg>
                  WSL / {profile.environment.distro}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-950/80 text-blue-300 border border-blue-800/50">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="20" height="20" x="2" y="2" rx="2" />
                    <path d="M12 2v20" />
                    <path d="M2 12h20" />
                  </svg>
                  Windows
                </span>
              )}

              {/* Expected Port Badge */}
              {profile.expectedPort && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/50">
                  :{profile.expectedPort}
                </span>
              )}
            </div>

            {profile.description && (
              <p className="text-xs text-zinc-400 mt-1 line-clamp-1">
                {profile.description}
              </p>
            )}
          </div>

          {/* Runtime Status Pill */}
          <div className="shrink-0 flex items-center gap-1.5">
            {isRunning && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Running
              </span>
            )}

            {isStartingState && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-950/80 text-amber-300 border border-amber-800/60">
                <svg
                  className="animate-spin h-2.5 w-2.5 text-amber-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Starting...
              </span>
            )}

            {isError && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-950/80 text-rose-300 border border-rose-800/60">
                <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                Error
              </span>
            )}

            {!isRunning && !isStartingState && !isError && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-500"></span>
                Stopped
              </span>
            )}
          </div>
        </div>

        {/* Command & Directory Details */}
        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-lg p-2.5 space-y-1.5 text-xs font-mono">
          <div className="flex items-center justify-between text-zinc-300 group">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-zinc-500 select-none">$</span>
              <span className="truncate text-blue-300/90">{profile.command}</span>
            </div>
            <CopyButton textToCopy={profile.command} label="Copy" showIconOnly />
          </div>

          <div className="flex items-center justify-between text-zinc-400 border-t border-zinc-900 pt-1.5">
            <div className="flex items-center gap-1.5 truncate">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-zinc-500 shrink-0"
              >
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-1.2-1.2A2 2 0 0 0 6.07 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
              </svg>
              <span className="truncate text-[11px]">{profile.workingDirectory}</span>
            </div>
            <CopyButton textToCopy={profile.workingDirectory} label="Copy" showIconOnly />
          </div>
        </div>



        {/* Live Active Process Info when running */}
        {isRunning && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-[11px]">
            <div className="flex items-center gap-3 text-emerald-300">
              <span>PID: <strong className="font-mono text-zinc-100">{activePid ?? '—'}</strong></span>
              {activePort && (
                <span>Port: <strong className="font-mono text-zinc-100">{activePort}</strong></span>
              )}
            </div>
            {onInspect && (
              <button
                type="button"
                onClick={() => onInspect(view)}
                className="text-emerald-400 hover:text-emerald-200 underline font-medium cursor-pointer"
              >
                Inspect Server
              </button>
            )}
          </div>
        )}

        {/* Error message banner */}
        {isError && errorMessage && (
          <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-200 text-xs flex items-start gap-2">
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
              className="text-rose-400 shrink-0 mt-0.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Action Buttons Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 gap-2">
        {/* Left Side: Start / Stop / Restart Controls */}
        <div className="flex items-center gap-2">
          {!isRunning && !isStartingState && (
            <button
              type="button"
              onClick={() => onStart(profile.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1"
              >
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
              Start
            </button>
          )}

          {isStartingState && (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/50 text-amber-200 rounded-lg text-xs font-semibold cursor-not-allowed opacity-80"
            >
              <svg
                className="animate-spin h-3 w-3 text-amber-300"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Starting...
            </button>
          )}

          {isRunning && onStop && (
            <button
              type="button"
              onClick={() => onStop(view)}
              disabled={isStopping}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect width="14" height="14" x="5" y="5" rx="2" />
              </svg>
              Stop
            </button>
          )}

          {isRunning && (
            <button
              type="button"
              onClick={() => onRestart(profile.id)}
              disabled={isStartingState || isStopping}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              title="Restart Server"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M8 16H3v5" />
              </svg>
              Restart
            </button>
          )}
        </div>

        {/* Right Side: Edit & Delete */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(view)}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            title="Edit Profile Configuration"
          >
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
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => onDelete(view)}
            className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
            title="Delete Profile"
          >
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
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
