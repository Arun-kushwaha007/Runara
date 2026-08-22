import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { DirectoryEntry, DirectoryListing } from '../../types';
import { filesystemApi } from '../../lib/commands';

interface WslDirectoryBrowserModalProps {
  isOpen: boolean;
  distro: string;
  initialPath?: string;
  onSelect: (selectedPath: string) => void;
  onClose: () => void;
}

export const WslDirectoryBrowserModal: React.FC<WslDirectoryBrowserModalProps> = ({
  isOpen,
  distro,
  initialPath,
  onSelect,
  onClose,
}) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [filterText, setFilterText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const listContainerRef = useRef<HTMLDivElement>(null);

  const loadDirectory = useCallback(
    async (path?: string) => {
      if (!distro.trim()) {
        setError('No WSL distribution specified.');
        return;
      }

      setIsLoading(true);
      setError(null);
      setSelectedIndex(-1);

      try {
        const listing: DirectoryListing = await filesystemApi.listWslDirectories(distro, path);
        setCurrentPath(listing.currentPath);
        setParentPath(listing.parentPath);
        setEntries(listing.entries);
      } catch (err: unknown) {
        const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Failed to browse directory.';
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [distro]
  );

  // Initial load when modal opens or distro changes
  useEffect(() => {
    if (isOpen) {
      setFilterText('');
      loadDirectory(initialPath || undefined);
    }
  }, [isOpen, distro, initialPath, loadDirectory]);

  // Filtered directory entries
  const filteredEntries = React.useMemo(() => {
    if (!filterText.trim()) return entries;
    const q = filterText.toLowerCase();
    return entries.filter((e) => e.name.toLowerCase().includes(q));
  }, [entries, filterText]);

  // Keyboard navigation inside modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredEntries.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredEntries.length - 1));
      } else if (e.key === 'Enter') {
        // If an entry is selected, navigate into it
        if (selectedIndex >= 0 && selectedIndex < filteredEntries.length) {
          e.preventDefault();
          const target = filteredEntries[selectedIndex];
          if (target) {
            loadDirectory(target.path);
          }
        }
      } else if (e.key === 'Backspace' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        if (parentPath) {
          e.preventDefault();
          loadDirectory(parentPath);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, selectedIndex, filteredEntries, parentPath, loadDirectory]);

  // Scroll active item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listContainerRef.current) {
      const activeEl = listContainerRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
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

  const isStoppedDistro = error && error.toLowerCase().includes('stopped');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wsl-browser-modal-title"
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
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
              <h2 id="wsl-browser-modal-title" className="text-base font-semibold text-zinc-100">
                Browse WSL Directory
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span>Distribution:</span>
                <span className="font-semibold text-amber-400">{distro}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded-lg transition-colors cursor-pointer"
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
        <div className="p-4 border-b border-zinc-800 bg-zinc-950/20 space-y-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!parentPath || isLoading}
              onClick={() => parentPath && loadDirectory(parentPath)}
              title={parentPath ? `Navigate to ${parentPath}` : 'Already at root'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                parentPath && !isLoading
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700 cursor-pointer'
                  : 'bg-zinc-900/50 text-zinc-600 border-zinc-800/80 cursor-not-allowed'
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
            <div className="flex-1 flex items-center bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 overflow-hidden">
              <span className="text-zinc-500 text-xs mr-2 font-mono select-none">Path:</span>
              <span
                className="text-xs font-mono text-zinc-200 truncate select-all"
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
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
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
                className="absolute left-2.5 top-2.5 text-zinc-500"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          )}
        </div>

        {/* Directory List Area */}
        <div className="flex-1 min-h-[220px] max-h-[360px] overflow-y-auto p-3">
          {isLoading ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-zinc-400">
              <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              <span className="text-xs">Browsing {distro}...</span>
            </div>
          ) : error ? (
            <div className="h-48 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <div className="p-3 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
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
                <h3 className="text-sm font-medium text-zinc-200">
                  {isStoppedDistro ? `${distro} is currently stopped` : 'Unable to access directory'}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{error}</p>
              </div>
              {!isStoppedDistro && (
                <button
                  type="button"
                  onClick={() => loadDirectory(currentPath || '/')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 cursor-pointer"
                >
                  Retry
                </button>
              )}
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-zinc-500 space-y-1">
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
                className="text-zinc-600"
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
                        ? 'bg-amber-500/20 border border-amber-500/40 text-amber-200 font-medium'
                        : 'hover:bg-zinc-800/80 text-zinc-200 border border-transparent'
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
                        className={entry.isHidden ? 'text-zinc-500' : 'text-amber-400 shrink-0'}
                      >
                        <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                      </svg>
                      <span className="truncate font-mono">{entry.name}</span>
                    </div>

                    {entry.isHidden && (
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/60">
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
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-zinc-800 bg-zinc-950/40">
          <span className="text-[11px] text-zinc-500 hidden sm:inline">
            Double-click a folder to navigate.
          </span>
          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-700/80 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!currentPath || isLoading || Boolean(error)}
              onClick={handleSelectCurrent}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                currentPath && !isLoading && !error
                  ? 'bg-amber-600 hover:bg-amber-500 text-zinc-950 shadow-md shadow-amber-950/30 cursor-pointer'
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed'
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
