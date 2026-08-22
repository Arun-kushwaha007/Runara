import React, { useState, useEffect, useCallback } from 'react';
import type { Environment } from '../../types';
import { filesystemApi } from '../../lib/commands';
import { WslDirectoryBrowserModal } from './WslDirectoryBrowserModal';
import { CopyButton } from './CopyButton';

interface WorkingDirectoryFieldProps {
  id?: string;
  label?: string;
  required?: boolean;
  environment: Environment;
  value: string;
  onChange: (path: string) => void;
  error?: string | null;
  disabled?: boolean;
  placeholder?: string;
  onValidationChange?: (isValid: boolean, error?: string | null) => void;
}

export const WorkingDirectoryField: React.FC<WorkingDirectoryFieldProps> = ({
  id = 'working-directory-input',
  label = 'Working Directory',
  required = true,
  environment,
  value,
  onChange,
  error: externalError,
  disabled = false,
  placeholder,
  onValidationChange,
}) => {
  const [isWslModalOpen, setIsWslModalOpen] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const isWsl = environment.type === 'wsl';
  const distro = isWsl ? environment.distro : '';

  const defaultPlaceholder = isWsl
    ? '/home/developer/projects/api'
    : 'C:\\Projects\\my-project';

  const displayedPlaceholder = placeholder || defaultPlaceholder;

  // Validate path against environment
  const validatePath = useCallback(
    async (pathToCheck: string) => {
      const trimmed = pathToCheck.trim();
      if (!trimmed) {
        setInternalError(null);
        onValidationChange?.(false, null);
        return;
      }

      setIsValidating(true);
      try {
        const result = await filesystemApi.validateDirectory(environment, trimmed);
        if (result.isValid) {
          setInternalError(null);
          onValidationChange?.(true, null);
        } else {
          const err = result.error || 'Directory does not exist.';
          setInternalError(err);
          onValidationChange?.(false, err);
        }
      } catch (err: unknown) {
        const msg =
          typeof err === 'string'
            ? err
            : err instanceof Error
            ? err.message
            : 'Failed to validate directory.';
        setInternalError(msg);
        onValidationChange?.(false, msg);
      } finally {
        setIsValidating(false);
      }
    },
    [environment, onValidationChange]
  );

  // When environment or distro changes, re-validate current path if non-empty
  useEffect(() => {
    if (value.trim()) {
      validatePath(value);
    } else {
      setInternalError(null);
    }
  }, [environment.type, distro, validatePath]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Windows Browse
  const handleWindowsBrowse = async () => {
    if (disabled) return;
    try {
      const selected = await filesystemApi.pickFolder(value || undefined);
      if (selected) {
        onChange(selected);
        validatePath(selected);
      }
    } catch (err: unknown) {
      console.error('Failed to open Windows folder dialog:', err);
    }
  };

  // Handle WSL Browse
  const handleWslBrowse = () => {
    if (disabled) return;
    setIsWslModalOpen(true);
  };

  // Handle WSL Selection
  const handleWslFolderSelected = (selectedPath: string) => {
    onChange(selectedPath);
    validatePath(selectedPath);
  };

  // Handle Clear
  const handleClear = () => {
    onChange('');
    setInternalError(null);
    onValidationChange?.(false, null);
  };

  // Combined error message
  const activeError = externalError || internalError;

  return (
    <div className="space-y-1.5">
      {/* Label and Environment Hint */}
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-medium text-zinc-300">
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
        <span className="text-[10px] text-zinc-500 font-mono">
          {isWsl ? `WSL (${distro || 'Linux'})` : 'Windows Host'}
        </span>
      </div>

      {/* Input and Action Buttons Group */}
      <div className="flex items-stretch gap-1.5">
        <div className="relative flex-1 min-w-0">
          <input
            id={id}
            type="text"
            required={required}
            disabled={disabled}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              if (internalError) setInternalError(null);
            }}
            onBlur={() => {
              if (value.trim()) validatePath(value);
            }}
            placeholder={displayedPlaceholder}
            className={`w-full bg-zinc-950 border rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:ring-1 transition-colors ${
              activeError
                ? 'border-rose-500/80 focus:ring-rose-500'
                : 'border-zinc-700/80 focus:ring-blue-500'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          />

          {/* Inline Right Actions (Copy & Validating Spinner) */}
          <div className="absolute right-2 top-2 flex items-center gap-1">
            {isValidating && (
              <div className="w-3.5 h-3.5 border-2 border-zinc-500/30 border-t-zinc-400 rounded-full animate-spin" />
            )}
            {value.trim() && (
              <CopyButton
                textToCopy={value}
                showIconOnly
                title="Copy full directory path"
                className="p-1 text-zinc-400 hover:text-zinc-200"
              />
            )}
          </div>
        </div>

        {/* Clear Button */}
        {value.trim() && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            title="Clear directory path"
            aria-label="Clear path"
            className="px-2.5 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-rose-300 hover:bg-rose-500/10 border border-zinc-700/80 transition-colors cursor-pointer shrink-0"
          >
            Clear
          </button>
        )}

        {/* Browse Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={isWsl ? handleWslBrowse : handleWindowsBrowse}
          className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all shrink-0 cursor-pointer ${
            isWsl
              ? 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border-amber-500/40 hover:border-amber-500/60 shadow-xs'
              : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border-blue-500/40 hover:border-blue-500/60 shadow-xs'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
          </svg>
          <span>{isWsl ? 'Browse WSL...' : 'Browse...'}</span>
        </button>
      </div>

      {/* Validation Error Message */}
      {activeError && (
        <div className="flex items-start gap-1.5 text-xs text-rose-400 pt-0.5 animate-in fade-in duration-150">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 mt-0.5"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="leading-tight">{activeError}</span>
        </div>
      )}

      {/* WSL Directory Browser Modal */}
      {isWsl && isWslModalOpen && (
        <WslDirectoryBrowserModal
          isOpen={isWslModalOpen}
          distro={distro}
          initialPath={value || undefined}
          onSelect={handleWslFolderSelected}
          onClose={() => setIsWslModalOpen(false)}
        />
      )}
    </div>
  );
};
