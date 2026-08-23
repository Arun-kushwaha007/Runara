import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  ProjectView,
  ServerProfile,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateProfileRequest,
  UpdateProfileRequest,
  ProjectOperationResult,
  ProjectProfileView,
  ProcessTarget,
} from '../types';
import { projectApi, profileApi, controlApi } from '../lib/commands';
import { ProjectCard } from '../components/projects/ProjectCard';
import { ProjectDetailsModal } from '../components/projects/ProjectDetailsModal';
import { ProjectFormModal } from '../components/projects/ProjectFormModal';
import { AddProfileModal } from '../components/projects/AddProfileModal';
import { DeleteProjectModal } from '../components/projects/DeleteProjectModal';
import { RemoveProfileModal } from '../components/projects/RemoveProfileModal';
import { ProjectStopConfirmationModal } from '../components/projects/ProjectStopConfirmationModal';
import { ProjectRestartConfirmationModal } from '../components/projects/ProjectRestartConfirmationModal';
import { ProjectOperationProgressModal } from '../components/projects/ProjectOperationProgressModal';
import { ProfileFormModal } from '../components/profiles/ProfileFormModal';
import { Toast, type ToastMessage } from '../components/common/Toast';

const Projects: React.FC = () => {
  const [projectViews, setProjectViews] = useState<ProjectView[]>([]);
  const [allProfiles, setAllProfiles] = useState<ServerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'partial' | 'stopped' | 'error'>('all');
  const [isOperating, setIsOperating] = useState(false);
  const [operatingProfileId, setOperatingProfileId] = useState<string | null>(null);

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

  // Confirmation Modals
  const [projectToStop, setProjectToStop] = useState<ProjectView | null>(null);
  const [projectToRestart, setProjectToRestart] = useState<ProjectView | null>(null);

  // Service Inspection / Edit Modal
  const [profileToInspect, setProfileToInspect] = useState<ServerProfile | null>(null);

  // Progress / Operation Modal State
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [operationResult, setOperationResult] = useState<ProjectOperationResult | null>(null);
  const [operationProjectName, setOperationProjectName] = useState('');
  const [operationType, setOperationType] = useState<'start' | 'stop' | 'restart'>('start');

  // Toast Notification
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast]);

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
  const handleCreateOrUpdateProject = async (
    data: CreateProjectRequest | UpdateProjectRequest,
    selectedProfileIds?: string[]
  ) => {
    try {
      if ('id' in data) {
        await projectApi.updateProject(data);
        setToast({ type: 'success', message: `Project '${data.name}' updated.` });
      } else {
        const created = await projectApi.createProject(data);
        if (selectedProfileIds && selectedProfileIds.length > 0) {
          for (let i = 0; i < selectedProfileIds.length; i++) {
            await projectApi.addProfileToProject({
              projectId: created.id,
              profileId: selectedProfileIds[i],
              orderIndex: i,
            });
          }
        }
        setToast({
          type: 'success',
          message: selectedProfileIds && selectedProfileIds.length > 0
            ? `Project '${data.name}' created with ${selectedProfileIds.length} services.`
            : `Project '${data.name}' created.`,
        });
      }
      await fetchAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setToast({ type: 'error', message: `Project error: ${msg}` });
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    const name = projectToDelete.project.name;
    try {
      await projectApi.deleteProject(projectToDelete.project.id);
      setIsDeleteOpen(false);
      setProjectToDelete(null);
      if (detailsProject?.project.id === projectToDelete.project.id) {
        setDetailsProject(null);
      }
      setToast({ type: 'success', message: `Project '${name}' deleted.` });
      await fetchAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setToast({ type: 'error', message: `Failed to delete project: ${msg}` });
    }
  };

  const handleAddProfile = async (profileId: string) => {
    if (!targetProjectForAdd) return;
    try {
      await projectApi.addProfileToProject({
        projectId: targetProjectForAdd.project.id,
        profileId,
        orderIndex: null,
      });
      setToast({ type: 'success', message: 'Profile added to project.' });
      await fetchAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setToast({ type: 'error', message: `Failed to add profile: ${msg}` });
    }
  };

  const handleRemoveProfile = async () => {
    if (!profileToRemove) return;
    const name = profileToRemove.profileView.profile.name;
    try {
      await projectApi.removeProfileFromProject(
        profileToRemove.project.project.id,
        profileToRemove.profileView.profile.id
      );
      setIsRemoveProfileOpen(false);
      setProfileToRemove(null);
      setToast({ type: 'success', message: `Profile '${name}' removed from project.` });
      await fetchAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setToast({ type: 'error', message: `Failed to remove profile: ${msg}` });
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

  // Direct Start All (No confirmation required as starting is non-destructive)
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
      if (res.status === 'running') {
        setToast({ type: 'success', message: `Project '${projName}' started successfully.` });
      } else if (res.status === 'partial') {
        setToast({ type: 'warning', message: `Project '${projName}' partially started.` });
      } else {
        setToast({ type: 'error', message: res.message });
      }
      await fetchAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to start project.');
      setToast({ type: 'error', message: `Failed to start project: ${msg}` });
    } finally {
      setIsOperating(false);
    }
  };

  // Stop All trigger with confirmation modal
  const handleRequestStopProject = (projectId: string) => {
    const proj = projectViews.find((p) => p.project.id === projectId);
    if (proj) {
      setProjectToStop(proj);
    }
  };

  const handleConfirmStopProject = async () => {
    if (!projectToStop) return;
    const projName = projectToStop.project.name;
    const projId = projectToStop.project.id;
    try {
      setIsOperating(true);
      setOperationType('stop');
      setOperationProjectName(projName);
      const res = await projectApi.stopProject(projId);
      setOperationResult(res);
      setProjectToStop(null);
      setIsProgressOpen(true);
      if (res.status === 'stopped') {
        setToast({ type: 'success', message: `Project '${projName}' stopped.` });
      } else {
        setToast({ type: 'warning', message: `Project '${projName}' stop partially completed.` });
      }
      await fetchAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to stop project.');
      setToast({ type: 'error', message: `Failed to stop project: ${msg}` });
    } finally {
      setIsOperating(false);
    }
  };

  // Restart All trigger with confirmation modal
  const handleRequestRestartProject = (projectId: string) => {
    const proj = projectViews.find((p) => p.project.id === projectId);
    if (proj) {
      setProjectToRestart(proj);
    }
  };

  const handleConfirmRestartProject = async () => {
    if (!projectToRestart) return;
    const projName = projectToRestart.project.name;
    const projId = projectToRestart.project.id;
    try {
      setIsOperating(true);
      setOperationType('restart');
      setOperationProjectName(projName);
      const res = await projectApi.restartProject(projId);
      setOperationResult(res);
      setProjectToRestart(null);
      setIsProgressOpen(true);
      if (res.status === 'running') {
        setToast({ type: 'success', message: `Project '${projName}' restarted successfully.` });
      } else {
        setToast({ type: 'warning', message: `Project '${projName}' restart partially completed.` });
      }
      await fetchAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to restart project.');
      setToast({ type: 'error', message: `Failed to restart project: ${msg}` });
    } finally {
      setIsOperating(false);
    }
  };

  // Individual Service Controls inside Project
  const handleStartService = async (profileId: string) => {
    const prof = allProfiles.find((p) => p.id === profileId);
    const profName = prof ? prof.name : 'Service';
    try {
      setOperatingProfileId(profileId);
      await profileApi.startProfile(profileId);
      setToast({ type: 'success', message: `Service '${profName}' started.` });
      await fetchAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setToast({ type: 'error', message: `Failed to start service: ${msg}` });
    } finally {
      setOperatingProfileId(null);
    }
  };

  const handleStopService = async (profileView: ProjectProfileView) => {
    const prof = profileView.profile;
    try {
      setOperatingProfileId(prof.id);
      if (profileView.activePid) {
        const target: ProcessTarget = {
          pid: profileView.activePid,
          processName: prof.name,
          executablePath: undefined,
          workingDirectory: prof.workingDirectory,
          expectedPorts: prof.expectedPort ? [prof.expectedPort] : [],
          force: false,
          environment: prof.environment,
        };
        await controlApi.stopServer(target);
      }
      setToast({ type: 'success', message: `Service '${prof.name}' stopped.` });
      await fetchAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setToast({ type: 'error', message: `Failed to stop service: ${msg}` });
    } finally {
      setOperatingProfileId(null);
    }
  };

  const handleInspectService = (profileView: ProjectProfileView) => {
    setProfileToInspect(profileView.profile);
  };

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col space-y-6 text-app-fg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-app-fg tracking-tight">Project Groups</h2>
          <p className="text-sm text-app-muted-fg mt-0.5">
            Organize and orchestrate multiple local server profiles as unified development projects.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchAll()}
            className="p-2 text-app-muted-fg hover:text-app-fg bg-app-surface border border-app-border rounded-xl hover:bg-app-surface-hover transition-colors cursor-pointer"
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
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
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
        <div className="bg-app-surface border border-app-border rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-app-muted-fg uppercase tracking-wider">Total Projects</div>
          <div className="text-2xl font-bold text-app-fg mt-1 font-mono">{summary.total}</div>
        </div>
        <div className="bg-app-surface border border-app-border rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Healthy</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">{summary.running}</div>
        </div>
        <div className="bg-app-surface border border-app-border rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Partial</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">{summary.partial}</div>
        </div>
        <div className="bg-app-surface border border-app-border rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-app-muted-fg uppercase tracking-wider">Stopped</div>
          <div className="text-2xl font-bold text-app-muted-fg mt-1 font-mono">{summary.stopped}</div>
        </div>
      </div>

      {/* Toolbar / Search & Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-app-surface border border-app-border rounded-xl p-2.5 shadow-xs">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects or services..."
            className="w-full bg-app-input border border-app-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-app-fg placeholder:text-app-muted-fg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          />
          <svg className="w-3.5 h-3.5 text-app-muted-fg absolute left-2.5 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
              className={`px-3 py-1 text-xs rounded-lg font-medium capitalize transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === filter
                  ? 'bg-app-muted text-app-fg font-semibold border border-app-border shadow-xs'
                  : 'text-app-muted-fg hover:text-app-fg hover:bg-app-surface-hover'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 dark:text-red-300 flex items-start gap-2">
          <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20 text-app-muted-fg text-xs">
          <svg className="animate-spin h-5 w-5 mr-2 text-indigo-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading projects...
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex-1 border border-dashed border-app-border rounded-2xl flex items-center justify-center p-12 bg-app-surface/40">
          <div className="text-center max-w-sm">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-app-muted border border-app-border flex items-center justify-center text-app-muted-fg mb-3.5">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-1.2-1.2A2 2 0 0 0 6.07 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-app-fg">
              {projectViews.length === 0 ? 'No projects yet' : 'No matching projects found'}
            </h3>
            <p className="text-xs text-app-muted-fg mt-1 leading-relaxed">
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
                className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
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
              onStop={handleRequestStopProject}
              onRestart={handleRequestRestartProject}
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
        onStop={handleRequestStopProject}
        onRestart={handleRequestRestartProject}
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
        onStartService={handleStartService}
        onStopService={handleStopService}
        onInspectService={handleInspectService}
        operatingProfileId={operatingProfileId}
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
        allProfiles={allProfiles}
        allProjects={projectViews}
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

      {/* Stop All Confirmation Modal */}
      <ProjectStopConfirmationModal
        isOpen={!!projectToStop}
        onClose={() => setProjectToStop(null)}
        onConfirm={handleConfirmStopProject}
        projectView={projectToStop}
        isOperating={isOperating}
      />

      {/* Restart All Confirmation Modal */}
      <ProjectRestartConfirmationModal
        isOpen={!!projectToRestart}
        onClose={() => setProjectToRestart(null)}
        onConfirm={handleConfirmRestartProject}
        projectView={projectToRestart}
        isOperating={isOperating}
      />

      {/* Profile Inspection / Edit Modal */}
      {profileToInspect && (
        <ProfileFormModal
          initialProfile={profileToInspect}
          wslDistros={[]}
          onClose={() => setProfileToInspect(null)}
          onSave={async (data: CreateProfileRequest | UpdateProfileRequest) => {
            await profileApi.updateProfile(data as UpdateProfileRequest);
            setToast({ type: 'success', message: `Server profile updated.` });
            setProfileToInspect(null);
            await fetchAll();
          }}
          isSaving={false}
        />
      )}

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

      {/* Toast Notification */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
};

export default Projects;
