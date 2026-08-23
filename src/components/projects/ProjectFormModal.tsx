import React, { useState, useEffect, useMemo } from 'react';
import type { Project, CreateProjectRequest, UpdateProjectRequest, ServerProfile, ProjectView } from '../../types';

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateProjectRequest | UpdateProjectRequest, selectedProfileIds?: string[]) => Promise<void>;
  projectToEdit?: Project | null;
  allProfiles?: ServerProfile[];
  allProjects?: ProjectView[];
}

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  projectToEdit,
  allProfiles = [],
  allProjects = [],
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [profileSearch, setProfileSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Map of profileId -> currentProjectName
  const profileToProjectMap = useMemo(() => {
    const map = new Map<string, { projectId: string; projectName: string }>();
    for (const proj of allProjects) {
      for (const p of proj.profiles) {
        map.set(p.profile.id, { projectId: proj.project.id, projectName: proj.project.name });
      }
    }
    return map;
  }, [allProjects]);

  useEffect(() => {
    if (projectToEdit) {
      setName(projectToEdit.name);
      setDescription(projectToEdit.description || '');
      setSelectedProfileIds([]);
    } else {
      setName('');
      setDescription('');
      setSelectedProfileIds([]);
    }
    setIsPickerOpen(false);
    setProfileSearch('');
    setError(null);
  }, [projectToEdit, isOpen]);

  if (!isOpen) return null;

  // Selected profiles in current configured order
  const selectedProfiles = selectedProfileIds
    .map((id) => allProfiles.find((p) => p.id === id))
    .filter((p): p is ServerProfile => Boolean(p));

  // Available profiles not yet added to this project draft
  const availableProfiles = allProfiles
    .filter((p) => !selectedProfileIds.includes(p.id))
    .filter((p) => {
      if (!profileSearch.trim()) return true;
      const q = profileSearch.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.command.toLowerCase().includes(q) ||
        p.workingDirectory.toLowerCase().includes(q) ||
        (p.expectedPort && String(p.expectedPort).includes(q))
      );
    });

  const handleAddService = (profileId: string) => {
    if (!selectedProfileIds.includes(profileId)) {
      setSelectedProfileIds((prev) => [...prev, profileId]);
    }
  };

  const handleRemoveService = (profileId: string) => {
    setSelectedProfileIds((prev) => prev.filter((id) => id !== profileId));
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setSelectedProfileIds((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return next;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= selectedProfileIds.length - 1) return;
    setSelectedProfileIds((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      if (projectToEdit) {
        await onSubmit({
          id: projectToEdit.id,
          name: name.trim(),
          description: description.trim() ? description.trim() : null,
        } as UpdateProjectRequest);
      } else {
        await onSubmit(
          {
            name: name.trim(),
            description: description.trim() ? description.trim() : null,
          } as CreateProjectRequest,
          selectedProfileIds
        );
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to save project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">
              {projectToEdit ? 'Edit Project' : 'Create New Project'}
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              {projectToEdit
                ? 'Update project grouping metadata.'
                : 'Configure a multi-service development environment.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2">
              <svg className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
              Project Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Company Platform"
              className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the microservices in this project..."
              className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 resize-none"
            />
          </div>

          {/* Initial Services Selection (Only during project creation) */}
          {!projectToEdit && (
            <div className="pt-2 border-t border-zinc-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    Services ({selectedProfiles.length})
                  </h4>
                  <p className="text-[11px] text-zinc-500">
                    Add member server profiles to run sequentially in this project.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPickerOpen((prev) => !prev)}
                  className="px-3 py-1.5 text-xs font-medium text-indigo-300 bg-indigo-950/50 border border-indigo-800/50 hover:bg-indigo-900 rounded-xl transition-colors inline-flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  {isPickerOpen ? 'Hide Available Profiles' : 'Add Service'}
                </button>
              </div>

              {/* Service Picker Dropdown / Box */}
              {isPickerOpen && (
                <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={profileSearch}
                      onChange={(e) => setProfileSearch(e.target.value)}
                      placeholder="Search existing server profiles..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-zinc-500"
                    />
                    <svg className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {availableProfiles.length === 0 ? (
                      <div className="text-center py-4 text-xs text-zinc-500 italic">
                        {allProfiles.length === 0
                          ? 'No server profiles available yet.'
                          : 'No remaining profiles match your search.'}
                      </div>
                    ) : (
                      availableProfiles.map((p) => {
                        const membership = profileToProjectMap.get(p.id);
                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between p-2 bg-zinc-900/90 border border-zinc-800/80 rounded-lg hover:border-zinc-700 transition-colors text-xs"
                          >
                            <div className="min-w-0 flex-1 mr-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-zinc-200 truncate">{p.name}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                                  {p.environment.type === 'wsl' ? `WSL:${p.environment.distro}` : 'Windows'}
                                </span>
                                {p.expectedPort && (
                                  <span className="font-mono text-zinc-400 text-[11px]">:{p.expectedPort}</span>
                                )}
                              </div>
                              <div className="text-[11px] text-zinc-500 font-mono truncate">
                                {p.command}
                              </div>
                              {membership && (
                                <div className="text-[10px] text-amber-400/90 mt-0.5">
                                  Currently in: {membership.projectName} (will be moved)
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddService(p.id)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-indigo-300 bg-indigo-950/60 border border-indigo-800/60 hover:bg-indigo-900 rounded-lg shrink-0 transition-colors"
                            >
                              + Add
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Selected Services Ordered List */}
              {selectedProfiles.length === 0 ? (
                <div className="p-4 bg-zinc-950/40 border border-dashed border-zinc-800 rounded-xl text-center text-xs text-zinc-500">
                  No services added yet. Click &ldquo;Add Service&rdquo; to select profiles, or create the project now and add services later.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {selectedProfiles.map((p, idx) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                        <span className="flex items-center justify-center h-6 w-6 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-bold font-mono text-zinc-300 shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-zinc-200 truncate">{p.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                              {p.environment.type === 'wsl' ? `WSL:${p.environment.distro}` : 'Windows'}
                            </span>
                            {p.expectedPort && (
                              <span className="font-mono text-zinc-400 text-[11px]">:{p.expectedPort}</span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-500 font-mono truncate">
                            {p.workingDirectory} &bull; {p.command}
                          </div>
                        </div>
                      </div>

                      {/* Move Up/Down & Remove */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(idx)}
                          disabled={idx === 0}
                          className="p-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-20 rounded transition-colors"
                          title="Move up"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 15l-6-6-6 6" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(idx)}
                          disabled={idx === selectedProfiles.length - 1}
                          className="p-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-20 rounded transition-colors"
                          title="Move down"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveService(p.id)}
                          className="p-1 text-zinc-500 hover:text-rose-400 rounded transition-colors ml-1"
                          title="Remove service"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/60 hover:bg-zinc-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-2"
            >
              {isSubmitting ? 'Saving...' : projectToEdit ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

