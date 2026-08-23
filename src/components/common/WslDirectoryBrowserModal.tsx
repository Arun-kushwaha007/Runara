import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { DirectoryEntry } from '../../types';
import { filesystemApi } from '../../lib/commands';

interface WslDirectoryBrowserModalProps {
  isOpen: boolean;
  distro: string;
  initialPath?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

export const WslDirectoryBrowserModal: React.FC<WslDirectoryBrowserModalProps> = ({
  isOpen,
  distro,
  initialPath,
  onSelect,
  onClose,
}) => {
  const [currentPath, setCurrentPath] = useState<string>(initialPath || '/');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [filterText, setFilterText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isStoppedDistro, setIsStoppedDistro] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const listContainerRef = useRef<HTMLDivElement>(null);

  // Load directory entries for the current path
  const loadDirectory = useCallback(
    async (path: string) => {
      setIsLoading(true);
      setError(null);
      setIsStoppedDistro(false);
      try {
        const listing = await filesystemApi.browseWslDirectory(distro, path);
        setCurrentPath(listing.currentPath);
        setParentPath(listing.parentPath);
        // Sort: non-hidden folders first alphabetically, then hidden folders
        const sorted = [...listing.entries].sort((a, b) => {
          if (a.isHidden !== b.isHidden) return a.isHidden ? 1 : -1;
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });
        setEntries(sorted);
        setSelectedIndex(-1);
        setFilterText('');
      } catch (err: unknown) {
        const message =
          typeof err === 'string'
            ? err
            : err instanceof Error
            ? err.message
            : 'Failed to access directory';

        setError(message);
        if (message.toLowerCase().includes('stopped') || message.toLowerCase().includes('not running')) {
          setIsStoppedDistro(true);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [distro]
  );

  // Initialize directory on open or distro change
  useEffect(() => {
    if (isOpen && distro) {
      loadDirectory(initialPath || '/');
    }
  }, [isOpen, distro, initialPath, loadDirectory]);

  // Filter entries based on filterText
  const filteredEntries = entries.filter((e) =>
    e.name.toLowerCase().includes(filterText.toLowerCase())
  );

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredEntries.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredEntries.length - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredEntries.length) {
          loadDirectory(filteredEntries[selectedIndex].path);
        } else if (currentPath) {
          handleSelectCurrent();
        }
      } else if (e.key === 'Backspace' && parentPath && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        loadDirectory(parentPath);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredEntries, parentPath, currentPath, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll selected entry into view
  useEffect(() => {
    if (selectedIndex >= 0 && listContainerRef.current) {
      const selectedEl = listContainerRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const handleSelectCurrent = () => {
    if (currentPath) {
      onSelect(currentPath);
      onClose();
    }
  };

  const handleEntryDoubleClick = (entry: DirectoryEntry) => {
    loadDirectory(entry.path);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wsl-browser-modal-title"
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-app-surface border border-app-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] my-auto text-app-fg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border bg-app-surface/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30">
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
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
              </svg>
            </div>
            <div>
              <h2 id="wsl-browser-modal-title" className="text-base font-semibold text-app-fg">
                Browse WSL Directory
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-app-muted-fg">
                <span>Distribution:</span>
                <span className="font-semibold text-amber-500">{distro}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-app-muted-fg hover:text-app-fg hover:bg-app-surface-hover rounded-lg transition-colors cursor-pointer"
          >
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Current Location & Navigation Bar */}
        <div className="p-4 border-b border-app-border bg-app-bg/50 space-y-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!parentPath || isLoading}
              onClick={() => parentPath && loadDirectory(parentPath)}
              title={parentPath ? `Navigate to ${parentPath}` : 'Already at root'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                parentPath && !isLoading
                  ? 'bg-app-muted hover:bg-app-surface-hover text-app-fg border-app-border cursor-pointer'
                  : 'bg-app-muted/40 text-app-muted-fg border-app-border-subtle cursor-not-allowed opacity-50'
              }`}
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
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Parent</span>
            </button>

            {/* Current Path Bar */}
            <div className="flex-1 flex items-center bg-app-input border border-app-border rounded-lg px-3 py-1.5 overflow-hidden">
              <span className="text-app-muted-fg text-xs mr-2 font-mono select-none">Path:</span>
              <span
                className="text-xs font-mono text-app-fg truncate select-all"
                title={currentPath}
              >
                {currentPath || '/'}
              </span>
            </div>
          </div>

          {/* Quick Filter Search within current folder */}
          {entries.length > 5 && (
            <div className="relative">
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter folders in this directory..."
                className="w-full bg-app-input border border-app-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-app-fg placeholder:text-app-muted-fg focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              />
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
                className="absolute left-2.5 top-2.5 text-app-muted-fg"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          )}
        </div>

        {/* Directory List Area */}
        <div className="flex-1 min-h-[220px] max-h-[360px] overflow-y-auto p-3 bg-app-surface">
          {isLoading ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-app-muted-fg">
              <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              <span className="text-xs">Browsing {distro}...</span>
            </div>
          ) : error ? (
            <div className="h-48 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <div className="p-3 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
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
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="space-y-1 max-w-md">
                <h3 className="text-sm font-medium text-app-fg">
                  {isStoppedDistro ? `${distro} is currently stopped` : 'Unable to access directory'}
                </h3>
                <p className="text-xs text-app-muted-fg leading-relaxed">{error}</p>
              </div>
              {!isStoppedDistro && (
                <button
                  type="button"
                  onClick={() => loadDirectory(currentPath || '/')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-app-muted hover:bg-app-surface-hover text-app-fg border border-app-border cursor-pointer"
                >
                  Retry
                </button>
              )}
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-app-muted-fg space-y-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-app-muted-fg/60"
              >
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
              </svg>
              <p className="text-xs">
                {filterText ? 'No matching subdirectories found.' : 'No subdirectories in this folder.'}
              </p>
            </div>
          ) : (
            <div ref={listContainerRef} className="space-y-1">
              {filteredEntries.map((entry, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={entry.path}
                    onClick={() => setSelectedIndex(idx)}
                    onDoubleClick={() => handleEntryDoubleClick(entry)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors select-none ${
                      isSelected
                        ? 'bg-amber-500/20 border border-amber-500/40 text-amber-600 dark:text-amber-200 font-medium'
                        : 'hover:bg-app-surface-hover text-app-fg border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={entry.isHidden ? 'text-app-muted-fg' : 'text-amber-500 shrink-0'}
                      >
                        <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                      </svg>
                      <span className="truncate font-mono">{entry.name}</span>
                    </div>

                    {entry.isHidden && (
                      <span className="text-[10px] text-app-muted-fg uppercase tracking-wider px-1.5 py-0.5 rounded bg-app-muted">
                        hidden
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-app-border bg-app-surface/60">
          <span className="text-[11px] text-app-muted-fg hidden sm:inline">
            Double-click a folder to navigate.
          </span>
          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg text-xs font-medium text-app-muted-fg hover:text-app-fg hover:bg-app-surface-hover border border-app-border transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!currentPath || isLoading || Boolean(error)}
              onClick={handleSelectCurrent}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                currentPath && !isLoading && !error
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-md cursor-pointer'
                  : 'bg-app-muted text-app-muted-fg border border-app-border cursor-not-allowed opacity-50'
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Select Folder</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
