import React, { useState, useEffect } from 'react';
import type { ServerProfile, ProjectView } from '../../types';

interface AddProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProfile: (profileId: string) => Promise<void>;
  targetProject: ProjectView;
  allProfiles: ServerProfile[];
  allProjects: ProjectView[];
}

export const AddProfileModal: React.FC<AddProfileModalProps> = ({
  isOpen,
  onClose,
  onAddProfile,
  targetProject,
  allProfiles,
  allProjects,
}) => {
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Map of profileId -> currentProjectName (if in another project)
  const profileToProjectMap = React.useMemo(() => {
    const map = new Map<string, { projectId: string; projectName: string }>();
    for (const proj of allProjects) {
      for (const p of proj.profiles) {
        map.set(p.profile.id, { projectId: proj.project.id, projectName: proj.project.name });
      }
    }
    return map;
  }, [allProjects]);

  // Exclude profiles already in THIS project
  const currentMemberIds = React.useMemo(() => {
    return new Set(targetProject.profiles.map((p) => p.profile.id));
  }, [targetProject]);

  const availableProfiles = React.useMemo(() => {
    return allProfiles
      .filter((p) => !currentMemberIds.has(p.id))
      .filter((p) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.command.toLowerCase().includes(q) ||
          p.workingDirectory.toLowerCase().includes(q) ||
          (p.expectedPort && String(p.expectedPort).includes(q))
        );
      });
  }, [allProfiles, currentMemberIds, search]);

  useEffect(() => {
    setSelectedProfileId('');
    setSearch('');
    setError(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedMembership = selectedProfileId ? profileToProjectMap.get(selectedProfileId) : null;
  const isMoving = selectedMembership && selectedMembership.projectId !== targetProject.project.id;

  const handleConfirm = async () => {
    if (!selectedProfileId) {
      setError('Please select a server profile to add.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onAddProfile(selectedProfileId);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to add profile to project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150 text-app-fg">
      <div className="bg-app-surface border border-app-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh] text-app-fg">
        <div className="px-6 py-5 border-b border-app-border flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-app-fg">Add Server to Project</h3>
            <p className="text-xs text-app-muted-fg mt-0.5">
              Adding to <span className="text-app-fg font-medium">{targetProject.project.name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-app-muted-fg hover:text-app-fg p-1 rounded-lg transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 dark:text-red-300 flex items-start gap-2">
              <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Search input */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search available server profiles..."
              className="w-full bg-app-input border border-app-border rounded-xl pl-9 pr-3.5 py-2 text-sm text-app-fg placeholder:text-app-muted-fg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
            <svg
              className="w-4 h-4 text-app-muted-fg absolute left-3 top-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          {/* Profiles list */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {availableProfiles.length === 0 ? (
              <div className="text-center py-8 text-xs text-app-muted-fg italic bg-app-bg rounded-xl border border-dashed border-app-border">
                {allProfiles.length === 0
                  ? 'No server profiles exist yet. Create a server profile first.'
                  : 'No remaining available server profiles match your search.'}
              </div>
            ) : (
              availableProfiles.map((p) => {
                const membership = profileToProjectMap.get(p.id);
                const isSelected = selectedProfileId === p.id;

                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedProfileId(p.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-500/15 border-indigo-500/60 ring-1 ring-indigo-500/50'
                        : 'bg-app-bg border-app-border hover:border-app-border-subtle'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-app-fg truncate">{p.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-app-muted text-app-muted-fg font-mono border border-app-border">
                          {p.environment.type === 'wsl' ? `WSL:${p.environment.distro}` : 'Windows'}
                        </span>
                        {p.expectedPort && (
                          <span className="text-[11px] text-app-muted-fg font-mono">:{p.expectedPort}</span>
                        )}
                      </div>
                      <p className="text-xs text-app-muted-fg font-mono truncate mt-0.5">{p.command}</p>
                    </div>

                    {membership && (
                      <div className="ml-3 shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-medium">
                          In: {membership.projectName}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Warning Banner if moving profile */}
          {isMoving && selectedMembership && (
            <div className="p-3.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div>
                <p className="font-semibold">Move profile between projects?</p>
                <p className="mt-0.5 text-amber-800/90 dark:text-amber-400/90 leading-relaxed">
                  This server profile currently belongs to <span className="font-semibold text-amber-900 dark:text-amber-200">"{selectedMembership.projectName}"</span>. Adding it here will move it to <span className="font-semibold text-amber-900 dark:text-amber-200">"{targetProject.project.name}"</span>.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-app-border bg-app-surface/90 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-app-fg bg-app-muted hover:bg-app-surface-hover border border-app-border rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedProfileId || isSubmitting}
            className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
          >
            {isSubmitting ? 'Adding...' : isMoving ? 'Move to Project' : 'Add to Project'}
          </button>
        </div>
      </div>
    </div>
  );
};
