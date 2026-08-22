import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  ProjectView,
  ServerProfile,
  CreateProjectRequest,
  UpdateProjectRequest,
  ProjectOperationResult,
  ProjectProfileView,
} from '../types';
import { projectApi, profileApi } from '../lib/commands';
import { ProjectCard } from '../components/projects/ProjectCard';
import { ProjectDetailsModal } from '../components/projects/ProjectDetailsModal';
import { ProjectFormModal } from '../components/projects/ProjectFormModal';
import { AddProfileModal } from '../components/projects/AddProfileModal';
import { DeleteProjectModal } from '../components/projects/DeleteProjectModal';
import { RemoveProfileModal } from '../components/projects/RemoveProfileModal';
import { ProjectOperationProgressModal } from '../components/projects/ProjectOperationProgressModal';

const Projects: React.FC = () => {
  const [projectViews, setProjectViews] = useState<ProjectView[]>([]);
  const [allProfiles, setAllProfiles] = useState<ServerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'partial' | 'stopped' | 'error'>('all');
  const [isOperating, setIsOperating] = useState(false);

  // Modal States
  const [detailsProject, setDetailsProject] = useState<ProjectView | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<ProjectView | null>(null);
  const [isAddProfileOpen, setIsAddProfileOpen] = useState(false);
  const [targetProjectForAdd, setTargetProjectForAdd] = useState<ProjectView | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectView | null>(null);
  const [isRemoveProfileOpen, setIsRemoveProfileOpen] = useState(false);
  const [profileToRemove, setProfileToRemove] = useState<{
    project: ProjectView;
    profileView: ProjectProfileView;
  } | null>(null);

  // Progress / Operation Modal State
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [operationResult, setOperationResult] = useState<ProjectOperationResult | null>(null);
  const [operationProjectName, setOperationProjectName] = useState('');
  const [operationType, setOperationType] = useState<'start' | 'stop' | 'restart'>('start');

  const fetchAll = useCallback(async () => {
    try {
      const [views, profiles] = await Promise.all([
        projectApi.getProjectViews(),
        profileApi.getProfiles(),
      ]);
      setProjectViews(views);
      setAllProfiles(profiles);

      // Keep detailsProject synchronized with fresh views
      setDetailsProject((prev) => {
        if (!prev) return null;
        return views.find((v) => v.project.id === prev.project.id) || null;
      });

      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to load projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 2500);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projectViews.filter((pv) => {
      // Status filter
      if (statusFilter !== 'all') {
        if (pv.status !== statusFilter) return false;
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = pv.project.name.toLowerCase().includes(q);
        const matchesDesc = (pv.project.description || '').toLowerCase().includes(q);
        const matchesService = pv.profiles.some(
          (p) =>
            p.profile.name.toLowerCase().includes(q) ||
            p.profile.command.toLowerCase().includes(q)
        );
        if (!matchesName && !matchesDesc && !matchesService) return false;
      }

      return true;
    });
  }, [projectViews, statusFilter, search]);

  // Summary counts
  const summary = useMemo(() => {
    let running = 0;
    let partial = 0;
    let stopped = 0;
    let errCount = 0;

    for (const pv of projectViews) {
      if (pv.status === 'running') running++;
      else if (pv.status === 'partial') partial++;
      else if (pv.status === 'error') errCount++;
      else stopped++;
    }

    return {
      total: projectViews.length,
      running,
      partial,
      stopped,
      error: errCount,
    };
  }, [projectViews]);

  // Handlers
  const handleCreateOrUpdateProject = async (data: CreateProjectRequest | UpdateProjectRequest) => {
    if ('id' in data) {
      await projectApi.updateProject(data);
    } else {
      await projectApi.createProject(data);
    }
    await fetchAll();
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      await projectApi.deleteProject(projectToDelete.project.id);
      setIsDeleteOpen(false);
      setProjectToDelete(null);
      if (detailsProject?.project.id === projectToDelete.project.id) {
        setDetailsProject(null);
      }
      await fetchAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to delete project.');
    }
  };

  const handleAddProfile = async (profileId: string) => {
    if (!targetProjectForAdd) return;
    await projectApi.addProfileToProject({
      projectId: targetProjectForAdd.project.id,
      profileId,
      orderIndex: null,
    });
    await fetchAll();
  };

  const handleRemoveProfile = async () => {
    if (!profileToRemove) return;
    try {
      await projectApi.removeProfileFromProject(
        profileToRemove.project.project.id,
        profileToRemove.profileView.profile.id
      );
      setIsRemoveProfileOpen(false);
      setProfileToRemove(null);
      await fetchAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to remove profile.');
    }
  };

  const handleMoveUp = async (pv: ProjectView, profileIndex: number) => {
    if (profileIndex <= 0) return;
    const currentIds = pv.profiles.map((p) => p.profile.id);
    const temp = currentIds[profileIndex];
    currentIds[profileIndex] = currentIds[profileIndex - 1];
    currentIds[profileIndex - 1] = temp;

    try {
      await projectApi.reorderProjectProfiles({
        projectId: pv.project.id,
        profileIds: currentIds,
      });
      await fetchAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to reorder profiles.');
    }
  };

  const handleMoveDown = async (pv: ProjectView, profileIndex: number) => {
    if (profileIndex >= pv.profiles.length - 1) return;
    const currentIds = pv.profiles.map((p) => p.profile.id);
    const temp = currentIds[profileIndex];
    currentIds[profileIndex] = currentIds[profileIndex + 1];
    currentIds[profileIndex + 1] = temp;

    try {
      await projectApi.reorderProjectProfiles({
        projectId: pv.project.id,
        profileIds: currentIds,
      });
      await fetchAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to reorder profiles.');
    }
  };

  const handleStartProject = async (projectId: string) => {
    const proj = projectViews.find((p) => p.project.id === projectId);
    const projName = proj ? proj.project.name : 'Project';
    try {
      setIsOperating(true);
      setOperationType('start');
      setOperationProjectName(projName);
      const res = await projectApi.startProject(projectId);
      setOperationResult(res);
      setIsProgressOpen(true);
      await fetchAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to start project.');
    } finally {
      setIsOperating(false);
    }
  };

  const handleStopProject = async (projectId: string) => {
    const proj = projectViews.find((p) => p.project.id === projectId);
    const projName = proj ? proj.project.name : 'Project';
    try {
      setIsOperating(true);
      setOperationType('stop');
      setOperationProjectName(projName);
      const res = await projectApi.stopProject(projectId);
      setOperationResult(res);
      setIsProgressOpen(true);
      await fetchAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to stop project.');
    } finally {
      setIsOperating(false);
    }
  };

  const handleRestartProject = async (projectId: string) => {
    const proj = projectViews.find((p) => p.project.id === projectId);
    const projName = proj ? proj.project.name : 'Project';
    try {
      setIsOperating(true);
      setOperationType('restart');
      setOperationProjectName(projName);
      const res = await projectApi.restartProject(projectId);
      setOperationResult(res);
      setIsProgressOpen(true);
      await fetchAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to restart project.');
    } finally {
      setIsOperating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">Project Groups</h2>
          <p className="text-sm text-zinc-400 mt-0.5">
            Organize and orchestrate multiple local server profiles as unified projects.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchAll()}
            className="p-2 text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors"
            title="Refresh projects"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </button>
          <button
            onClick={() => {
              setProjectToEdit(null);
              setIsFormOpen(true);
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Project
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3.5">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Total Projects</div>
          <div className="text-2xl font-bold text-zinc-100 mt-1 font-mono">{summary.total}</div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3.5">
          <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Running</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{summary.running}</div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3.5">
          <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Partial</div>
          <div className="text-2xl font-bold text-amber-400 mt-1 font-mono">{summary.partial}</div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3.5">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Stopped</div>
          <div className="text-2xl font-bold text-zinc-400 mt-1 font-mono">{summary.stopped}</div>
        </div>
      </div>

      {/* Toolbar / Search & Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-2.5">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects or services..."
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-zinc-500"
          />
          <svg className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {(['all', 'running', 'partial', 'stopped', 'error'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1 text-xs rounded-lg font-medium capitalize transition-colors whitespace-nowrap ${
                statusFilter === filter
                  ? 'bg-zinc-700 text-zinc-100 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2">
          <svg className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20 text-zinc-500 text-xs">
          <svg className="animate-spin h-5 w-5 mr-2 text-indigo-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading projects...
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex-1 border border-dashed border-zinc-800 rounded-2xl flex items-center justify-center p-12 bg-zinc-900/20">
          <div className="text-center max-w-sm">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center text-zinc-400 mb-3.5">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-1.2-1.2A2 2 0 0 0 6.07 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-zinc-200">
              {projectViews.length === 0 ? 'No projects yet' : 'No matching projects found'}
            </h3>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              {projectViews.length === 0
                ? 'Group your frontend, backend, and worker services into a Project to control them as a unit.'
                : 'Try adjusting your search query or status filter.'}
            </p>
            {projectViews.length === 0 && (
              <button
                onClick={() => {
                  setProjectToEdit(null);
                  setIsFormOpen(true);
                }}
                className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors inline-flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Create Your First Project
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((pv) => (
            <ProjectCard
              key={pv.project.id}
              projectView={pv}
              onInspect={(view) => setDetailsProject(view)}
              onStart={handleStartProject}
              onStop={handleStopProject}
              onRestart={handleRestartProject}
              isOperating={isOperating}
            />
          ))}
        </div>
      )}

      {/* Details Modal */}
      <ProjectDetailsModal
        isOpen={!!detailsProject}
        onClose={() => setDetailsProject(null)}
        projectView={detailsProject}
        onStart={handleStartProject}
        onStop={handleStopProject}
        onRestart={handleRestartProject}
        onEdit={(pv) => {
          setProjectToEdit(pv);
          setIsFormOpen(true);
        }}
        onDelete={(pv) => {
          setProjectToDelete(pv);
          setIsDeleteOpen(true);
        }}
        onAddProfile={(pv) => {
          setTargetProjectForAdd(pv);
          setIsAddProfileOpen(true);
        }}
        onRemoveProfile={(pv, profileView) => {
          setProfileToRemove({ project: pv, profileView });
          setIsRemoveProfileOpen(true);
        }}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        isOperating={isOperating}
      />

      {/* Create / Edit Form Modal */}
      <ProjectFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setProjectToEdit(null);
        }}
        onSubmit={handleCreateOrUpdateProject}
        projectToEdit={projectToEdit ? projectToEdit.project : null}
      />

      {/* Add Profile Modal */}
      {targetProjectForAdd && (
        <AddProfileModal
          isOpen={isAddProfileOpen}
          onClose={() => {
            setIsAddProfileOpen(false);
            setTargetProjectForAdd(null);
          }}
          onAddProfile={handleAddProfile}
          targetProject={targetProjectForAdd}
          allProfiles={allProfiles}
          allProjects={projectViews}
        />
      )}

      {/* Delete Project Modal */}
      <DeleteProjectModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setProjectToDelete(null);
        }}
        onConfirm={handleDeleteProject}
        projectName={projectToDelete ? projectToDelete.project.name : ''}
      />

      {/* Remove Profile Modal */}
      <RemoveProfileModal
        isOpen={isRemoveProfileOpen}
        onClose={() => {
          setIsRemoveProfileOpen(false);
          setProfileToRemove(null);
        }}
        onConfirm={handleRemoveProfile}
        profileName={profileToRemove ? profileToRemove.profileView.profile.name : ''}
        projectName={profileToRemove ? profileToRemove.project.project.name : ''}
      />

      {/* Progress / Result Modal */}
      <ProjectOperationProgressModal
        isOpen={isProgressOpen}
        onClose={() => {
          setIsProgressOpen(false);
          setOperationResult(null);
        }}
        result={operationResult}
        projectName={operationProjectName}
        operationType={operationType}
      />
    </div>
  );
};

export default Projects;
