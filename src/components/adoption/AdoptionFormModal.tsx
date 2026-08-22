import React, { useState, useEffect, useCallback } from 'react';
import type {
  DashboardServer,
  CreateProfileRequest,
  ServerProfile,
} from '../../types';
import { buildAdoptionDraft } from '../../lib/adoptionDraft';
import { profileApi } from '../../lib/commands';
import { DuplicateProfileWarning } from './DuplicateProfileWarning';
import { WorkingDirectoryField } from '../common/WorkingDirectoryField';

interface AdoptionFormModalProps {
  server: DashboardServer;
  onSave: (req: CreateProfileRequest) => Promise<void>;
  onClose: () => void;
  onUseExistingProfile?: (profile: ServerProfile) => void;
  isSaving: boolean;
}

export const AdoptionFormModal: React.FC<AdoptionFormModalProps> = ({
  server,
  onSave,
  onClose,
  onUseExistingProfile,
  isSaving,
}) => {
  const [draft] = useState(() => buildAdoptionDraft(server));

  const [name, setName] = useState(draft.name);
  const [description, setDescription] = useState(draft.description ?? '');
  const [workingDirectory, setWorkingDirectory] = useState(draft.workingDirectory);
  const [command, setCommand] = useState(draft.command);
  const [selectedPort, setSelectedPort] = useState<string>(
    draft.expectedPort != null ? String(draft.expectedPort) : ''
  );
  const [expectedHost, setExpectedHost] = useState(draft.expectedHost ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Duplicate detection state
  const [duplicates, setDuplicates] = useState<ServerProfile[]>([]);
  const [ignoredDuplicates, setIgnoredDuplicates] = useState(false);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Check for duplicates
  const checkForDuplicates = useCallback(async () => {
    if (ignoredDuplicates) return;
    try {
      const portNum = selectedPort.trim() ? parseInt(selectedPort.trim(), 10) : null;
      const validPort = portNum && !isNaN(portNum) && portNum >= 1 && portNum <= 65535 ? portNum : null;

      const result = await profileApi.findDuplicates(
        draft.environment,
        workingDirectory.trim(),
        command.trim(),
        validPort
      );
      setDuplicates(result.duplicates);
    } catch {
      // Non-critical: if duplicate check fails, continue
    }
  }, [draft.environment, workingDirectory, command, selectedPort, ignoredDuplicates]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      checkForDuplicates();
    }, 250);
    return () => clearTimeout(timeout);
  }, [checkForDuplicates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim()) {
      setValidationError('Profile name is required.');
      return;
    }

    if (!workingDirectory.trim()) {
      setValidationError('Working directory is required.');
      return;
    }

    if (!command.trim()) {
      setValidationError('Startup command is required.');
      return;
    }

    let parsedPort: number | null = null;
    if (selectedPort.trim()) {
      const p = parseInt(selectedPort.trim(), 10);
      if (isNaN(p) || p < 1 || p > 65535) {
        setValidationError('Expected port must be a valid TCP port number between 1 and 65535.');
        return;
      }
      parsedPort = p;
    }

    const createReq: CreateProfileRequest = {
      name: name.trim(),
      description: description.trim() || null,
      environment: draft.environment,
      workingDirectory: workingDirectory.trim(),
      command: command.trim(),
      expectedPort: parsedPort,
      expectedHost: expectedHost.trim() || null,
    };

    try {
      await onSave(createReq);
    } catch (err: unknown) {
      setValidationError(typeof err === 'string' ? err : 'Failed to create profile.');
    }
  };

  const isWsl = draft.environment.type === 'wsl';
  const hasMultiplePorts = draft.allDetectedPorts.length > 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="adoption-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div>
              <h2 id="adoption-modal-title" className="text-base font-semibold text-zinc-100">
                Adopt Running Server
              </h2>
              <p className="text-xs text-zinc-400">
                Save this discovered process as a managed profile for one-click control and startup.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          >
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
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Discovered Context Banner */}
          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="font-medium text-zinc-300">Detected Process Context</span>
              <span className="font-mono text-zinc-400">PID {server.pid}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-zinc-300">
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono text-[11px]">
                {server.processName}
              </span>
              {server.runtime && server.runtime !== 'Unknown' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800/50 text-[11px]">
                  {server.runtime}
                </span>
              )}
              {server.packageManager && server.packageManager !== 'Unknown' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 text-[11px]">
                  {server.packageManager}
                </span>
              )}
              <span className="text-zinc-500">•</span>
              <span className="font-mono text-zinc-400">
                Port {server.allPorts.join(', ')}
              </span>
            </div>
          </div>

          {/* Validation Error Banner */}
          {validationError && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-200 text-xs flex items-center gap-2 animate-in fade-in duration-150">
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
                className="text-rose-400 shrink-0"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{validationError}</span>
            </div>
          )}

          {/* Duplicate Profile Warning */}
          {!ignoredDuplicates && duplicates.length > 0 && (
            <DuplicateProfileWarning
              duplicates={duplicates}
              onUseExisting={(profile) => {
                if (onUseExistingProfile) {
                  onUseExistingProfile(profile);
                }
                onClose();
              }}
              onCreateAnyway={() => setIgnoredDuplicates(true)}
            />
          )}

          {/* Profile Name Field */}
          <div className="space-y-1.5">
            <label htmlFor="adoption-profile-name" className="text-xs font-medium text-zinc-300">
              Profile Name <span className="text-rose-400">*</span>
            </label>
            <input
              id="adoption-profile-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Company Frontend, API Service"
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Environment & Distro Badges (Read-Only) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">
              Environment <span className="text-zinc-500 font-normal">(Derived from running server)</span>
            </label>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs">
              {isWsl ? (
                <div className="flex items-center gap-2 text-purple-300">
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
                    className="text-purple-400"
                  >
                    <polyline points="4 17 10 11 4 5" />
                    <line x1="12" y1="19" x2="20" y2="19" />
                  </svg>
                  <span className="font-medium">
                    WSL / {draft.environment.type === 'wsl' ? draft.environment.distro : 'Linux'}
                  </span>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/80">
                    Linux Distro
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-blue-300">
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
                    className="text-blue-400"
                  >
                    <rect width="20" height="14" x="2" y="3" rx="2" />
                    <line x1="8" x2="16" y1="21" y2="21" />
                    <line x1="12" x2="12" y1="17" y2="21" />
                  </svg>
                  <span className="font-medium">Windows Host</span>
                </div>
              )}
            </div>
          </div>

          {/* Working Directory Field */}
          <WorkingDirectoryField
            id="adoption-working-dir"
            label="Working Directory"
            required
            environment={draft.environment}
            value={workingDirectory}
            onChange={setWorkingDirectory}
            disabled={isSaving}
          />

          {/* Command Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="adoption-command" className="text-xs font-medium text-zinc-300">
                Startup Command <span className="text-rose-400">*</span>
              </label>
              <span className="text-[11px] text-amber-400/90 font-normal">
                Detected from process — edit to original dev command if needed
              </span>
            </div>
            <input
              id="adoption-command"
              type="text"
              required
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="e.g. npm run dev, python -m uvicorn main:app, cargo run"
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Expected Port Field */}
          <div className="space-y-1.5">
            <label htmlFor="adoption-port" className="text-xs font-medium text-zinc-300">
              Expected Port
            </label>
            {hasMultiplePorts ? (
              <div className="space-y-2">
                <p className="text-[11px] text-zinc-400">
                  Multiple listening ports detected. Select the primary server port:
                </p>
                <div className="flex flex-wrap gap-2">
                  {draft.allDetectedPorts.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedPort(String(p))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors border ${
                        selectedPort === String(p)
                          ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/70 font-semibold'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      Port {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedPort('')}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors border ${
                      selectedPort === ''
                        ? 'bg-zinc-800 text-zinc-200 border-zinc-600 font-medium'
                        : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-300'
                    }`}
                  >
                    None / Match by dir
                  </button>
                </div>
              </div>
            ) : (
              <input
                id="adoption-port"
                type="number"
                min="1"
                max="65535"
                value={selectedPort}
                onChange={(e) => setSelectedPort(e.target.value)}
                placeholder="e.g. 3000, 5173, 8080 (optional)"
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            )}
          </div>

          {/* Expected Host Field */}
          <div className="space-y-1.5">
            <label htmlFor="adoption-host" className="text-xs font-medium text-zinc-300">
              Expected Host Binding <span className="text-zinc-500 font-normal">(Optional)</span>
            </label>
            <input
              id="adoption-host"
              type="text"
              value={expectedHost}
              onChange={(e) => setExpectedHost(e.target.value)}
              placeholder="e.g. 127.0.0.1, localhost (optional)"
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="adoption-description" className="text-xs font-medium text-zinc-300">
              Description <span className="text-zinc-500 font-normal">(Optional)</span>
            </label>
            <textarea
              id="adoption-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add optional notes about this server..."
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving Profile...</span>
                </>
              ) : (
                <>
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
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
