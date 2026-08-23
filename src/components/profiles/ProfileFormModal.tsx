import React, { useState, useEffect } from 'react';
import type {
  ServerProfile,
  CreateProfileRequest,
  UpdateProfileRequest,
  WslDistribution,
  Environment,
} from '../../types';
import { WorkingDirectoryField } from '../common/WorkingDirectoryField';

interface ProfileFormModalProps {
  initialProfile?: ServerProfile | null;
  wslDistros: WslDistribution[];
  onSave: (req: CreateProfileRequest | UpdateProfileRequest) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}

export const ProfileFormModal: React.FC<ProfileFormModalProps> = ({
  initialProfile,
  wslDistros,
  onSave,
  onClose,
  isSaving,
}) => {
  const isEditing = Boolean(initialProfile);

  const [name, setName] = useState(initialProfile?.name ?? '');
  const [description, setDescription] = useState(initialProfile?.description ?? '');
  const [envType, setEnvType] = useState<'windows' | 'wsl'>(
    initialProfile?.environment.type === 'wsl' ? 'wsl' : 'windows'
  );
  const [distro, setDistro] = useState(
    initialProfile?.environment.type === 'wsl'
      ? initialProfile.environment.distro
      : wslDistros[0]?.name ?? 'Ubuntu'
  );
  const [workingDirectory, setWorkingDirectory] = useState(
    initialProfile?.workingDirectory ?? ''
  );
  const [command, setCommand] = useState(initialProfile?.command ?? '');
  const [expectedPort, setExpectedPort] = useState<string>(
    initialProfile?.expectedPort ? String(initialProfile.expectedPort) : ''
  );
  const [expectedHost, setExpectedHost] = useState(initialProfile?.expectedHost ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync state if initialProfile changes
  useEffect(() => {
    if (initialProfile) {
      setName(initialProfile.name);
      setDescription(initialProfile.description ?? '');
      setEnvType(initialProfile.environment.type === 'wsl' ? 'wsl' : 'windows');
      if (initialProfile.environment.type === 'wsl') {
        setDistro(initialProfile.environment.distro);
      }
      setWorkingDirectory(initialProfile.workingDirectory);
      setCommand(initialProfile.command);
      setExpectedPort(initialProfile.expectedPort ? String(initialProfile.expectedPort) : '');
      setExpectedHost(initialProfile.expectedHost ?? '');
    }
  }, [initialProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validation
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

    if (envType === 'wsl' && !distro.trim()) {
      setValidationError('A WSL distribution must be selected for WSL profiles.');
      return;
    }

    let parsedPort: number | undefined = undefined;
    if (expectedPort.trim()) {
      const p = parseInt(expectedPort.trim(), 10);
      if (isNaN(p) || p < 1 || p > 65535) {
        setValidationError('Expected port must be a valid TCP port number between 1 and 65535.');
        return;
      }
      parsedPort = p;
    }

    const environment: Environment =
      envType === 'wsl'
        ? { type: 'wsl', distro: distro.trim() }
        : { type: 'windows' };

    try {
      if (isEditing && initialProfile) {
        const updateReq: UpdateProfileRequest = {
          id: initialProfile.id,
          name: name.trim(),
          description: description.trim() || null,
          environment,
          workingDirectory: workingDirectory.trim(),
          command: command.trim(),
          expectedPort: parsedPort ?? null,
          expectedHost: expectedHost.trim() || null,
        };
        await onSave(updateReq);
      } else {
        const createReq: CreateProfileRequest = {
          name: name.trim(),
          description: description.trim() || null,
          environment,
          workingDirectory: workingDirectory.trim(),
          command: command.trim(),
          expectedPort: parsedPort ?? null,
          expectedHost: expectedHost.trim() || null,
        };
        await onSave(createReq);
      }
    } catch (err: unknown) {
      setValidationError(typeof err === 'string' ? err : 'Failed to save profile.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150 text-app-fg">
      <div className="bg-app-surface border border-app-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-app-fg">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border bg-app-surface/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-600/20 text-blue-500 border border-blue-500/30">
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
                <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
                <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
                <line x1="6" x2="6.01" y1="6" y2="6" />
                <line x1="6" x2="6.01" y1="18" y2="18" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-app-fg">
                {isEditing ? 'Edit Server Profile' : 'Create Server Profile'}
              </h3>
              <p className="text-xs text-app-muted-fg">
                Save a reusable server configuration to start development commands with one click.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-app-muted-fg hover:text-app-fg p-1.5 rounded-lg hover:bg-app-surface-hover transition-colors cursor-pointer"
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

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {validationError && (
            <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-300 text-xs flex items-center gap-2">
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
                className="text-red-500 shrink-0"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{validationError}</span>
            </div>
          )}

          {/* Profile Name */}
          <div className="space-y-1.5">
            <label htmlFor="profile-name" className="text-xs font-medium text-app-fg">
              Server Name <span className="text-red-500">*</span>
            </label>
            <input
              id="profile-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Company Frontend, API Service"
              className="w-full bg-app-input border border-app-border rounded-lg px-3 py-2 text-xs text-app-fg placeholder:text-app-muted-fg focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Environment Selector */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="profile-env-type" className="text-xs font-medium text-app-fg">
                Environment <span className="text-red-500">*</span>
              </label>
              <select
                id="profile-env-type"
                value={envType}
                onChange={(e) => setEnvType(e.target.value as 'windows' | 'wsl')}
                className="w-full bg-app-input border border-app-border rounded-lg px-3 py-2 text-xs text-app-fg focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="windows" className="bg-app-surface text-app-fg">Windows Host</option>
                <option value="wsl" className="bg-app-surface text-app-fg">WSL (Linux)</option>
              </select>
            </div>

            {/* WSL Distro Selector (Visible only when WSL is selected) */}
            {envType === 'wsl' && (
              <div className="space-y-1.5 animate-in fade-in duration-150">
                <label htmlFor="profile-wsl-distro" className="text-xs font-medium text-app-fg">
                  WSL Distribution <span className="text-red-500">*</span>
                </label>
                <select
                  id="profile-wsl-distro"
                  value={distro}
                  onChange={(e) => setDistro(e.target.value)}
                  className="w-full bg-app-input border border-app-border rounded-lg px-3 py-2 text-xs text-app-fg focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  {wslDistros.map((d) => (
                    <option key={d.name} value={d.name} className="bg-app-surface text-app-fg">
                      {d.name} {d.isDefault ? '(Default)' : ''} — {d.state}
                    </option>
                  ))}
                  {wslDistros.length === 0 && (
                    <option value="Ubuntu" className="bg-app-surface text-app-fg">Ubuntu</option>
                  )}
                </select>
              </div>
            )}
          </div>

          {/* Working Directory */}
          <WorkingDirectoryField
            id="profile-cwd"
            label="Working Directory"
            required
            environment={
              envType === 'wsl'
                ? { type: 'wsl', distro: distro.trim() }
                : { type: 'windows' }
            }
            value={workingDirectory}
            onChange={setWorkingDirectory}
            disabled={isSaving}
          />

          {/* Command */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="profile-cmd" className="text-xs font-medium text-app-fg">
                Startup Command <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] text-app-muted-fg">
                e.g. npm run dev, cargo run, python -m uvicorn
              </span>
            </div>
            <input
              id="profile-cmd"
              type="text"
              required
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="npm run dev"
              className="w-full bg-app-input border border-app-border rounded-lg px-3 py-2 text-xs font-mono text-app-fg placeholder:text-app-muted-fg focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Expected Port & Host (2 columns) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="profile-expected-port" className="text-xs font-medium text-app-fg">
                Expected Port <span className="text-app-muted-fg font-normal">(Optional)</span>
              </label>
              <input
                id="profile-expected-port"
                type="number"
                min="1"
                max="65535"
                value={expectedPort}
                onChange={(e) => setExpectedPort(e.target.value)}
                placeholder="3000"
                className="w-full bg-app-input border border-app-border rounded-lg px-3 py-2 text-xs font-mono text-app-fg placeholder:text-app-muted-fg focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-[10px] text-app-muted-fg">
                Verifies server is listening after launch.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="profile-expected-host" className="text-xs font-medium text-app-fg">
                Expected Host <span className="text-app-muted-fg font-normal">(Optional)</span>
              </label>
              <input
                id="profile-expected-host"
                type="text"
                value={expectedHost}
                onChange={(e) => setExpectedHost(e.target.value)}
                placeholder="127.0.0.1"
                className="w-full bg-app-input border border-app-border rounded-lg px-3 py-2 text-xs font-mono text-app-fg placeholder:text-app-muted-fg focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-[10px] text-app-muted-fg">
                e.g. 127.0.0.1 or localhost
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-app-fg">
              Description <span className="text-app-muted-fg font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes or service context..."
              className="w-full bg-app-input border border-app-border rounded-lg px-3 py-2 text-xs text-app-fg placeholder:text-app-muted-fg focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-app-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-app-muted hover:bg-app-surface-hover text-app-fg rounded-lg text-xs font-medium border border-app-border transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              {isSaving ? (
                <>
                  <svg
                    className="animate-spin h-3.5 w-3.5 text-white"
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
                  Saving...
                </>
              ) : isEditing ? (
                'Save Changes'
              ) : (
                'Create Profile'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
