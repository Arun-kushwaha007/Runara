import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { controlApi, profileApi, unifiedApi, wslApi } from '../lib/commands';
import type {
  DashboardServer,
  ProcessTarget,
  ProcessControlError,
  ServerSortField,
  ServerSortDirection,
  ServerFilterOptions,
  ServerProfileView,
  ServerProfile,
  CreateProfileRequest,
  UpdateProfileRequest,
  StartError,
  WslDistribution,
} from '../types';
import { deriveDashboardServers, filterServers, sortServers } from '../lib/serverUtils';
import { ServerList } from '../components/dashboard/ServerList';
import { ServerDetailsModal } from '../components/dashboard/ServerDetailsModal';
import { StopConfirmationModal } from '../components/dashboard/StopConfirmationModal';
import { ServerToolbar } from '../components/dashboard/ServerToolbar';
import { ProfileCard } from '../components/profiles/ProfileCard';
import { ProfileFormModal } from '../components/profiles/ProfileFormModal';
import { DeleteProfileModal } from '../components/profiles/DeleteProfileModal';
import { PortConflictModal } from '../components/profiles/PortConflictModal';
import { openUrl } from '@tauri-apps/plugin-opener';

type ServersViewTab = 'profiles' | 'active';

export const Servers: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ServersViewTab>('profiles');

  // Server Profiles State
  const [profileViews, setProfileViews] = useState<ServerProfileView[]>([]);
  const [wslDistros, setWslDistros] = useState<WslDistribution[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);

  // Active in-flight start operations
  const [startingProfileIds, setStartingProfileIds] = useState<Set<string>>(new Set());

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [profileToEdit, setProfileToEdit] = useState<ServerProfile | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  const [profileToDelete, setProfileToDelete] = useState<ServerProfileView | null>(null);
  const [isDeletingProfile, setIsDeletingProfile] = useState<boolean>(false);

  const [portConflictError, setPortConflictError] = useState<StartError | null>(null);

  // Discovered Live Servers State (for "Active" tab)
  const [discoveredServers, setDiscoveredServers] = useState<DashboardServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<DashboardServer | null>(null);
  const [serverToStop, setServerToStop] = useState<DashboardServer | null>(null);
  const [stopError, setStopError] = useState<ProcessControlError | string | null>(null);
  const [isExecutingStop, setIsExecutingStop] = useState<boolean>(false);
  const [stoppingPids, setStoppingPids] = useState<Set<number>>(new Set());

  // Filters & Sorting
  const [filters, setFilters] = useState<ServerFilterOptions>({
    environment: 'all',
    runtime: 'all',
    status: 'all',
  });
  const [sortField, setSortField] = useState<ServerSortField>('port');
  const [sortDirection, setSortDirection] = useState<ServerSortDirection>('asc');

  // Feedback Toast
  const [feedbackToast, setFeedbackToast] = useState<{
    type: 'success' | 'warning' | 'info' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!feedbackToast) return;
    const timer = setTimeout(() => {
      setFeedbackToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [feedbackToast]);

  // Comprehensive Refresh
  const refreshAll = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [fetchedViews, snapshot, distros] = await Promise.all([
        profileApi.getProfilesWithStatus().catch((err) => {
          console.warn('Failed to load profiles with status:', err);
          return [] as ServerProfileView[];
        }),
        unifiedApi.getUnifiedSnapshot().catch((err) => {
          console.warn('Unified discovery failed:', err);
          return { processes: [], ports: [], identities: [], distributions: [], diagnostics: [] };
        }),
        wslApi.getWslDistributions().catch(() => [] as WslDistribution[]),
      ]);

      setProfileViews(fetchedViews);
      setWslDistros(distros);

      const live = deriveDashboardServers(snapshot.ports, snapshot.identities);
      setDiscoveredServers(live);
      setError(null);
    } catch (err) {
      console.error('Failed to refresh servers & profiles:', err);
      setError(
        typeof err === 'string'
          ? err
          : 'Unable to query server profiles and active system processes.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      refreshAll();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshAll]);

  // Filtered & Sorted Profiles
  const visibleProfiles = useMemo(() => {
    return profileViews.filter((v) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = v.profile.name.toLowerCase().includes(q);
        const matchesCmd = v.profile.command.toLowerCase().includes(q);
        const matchesCwd = v.profile.workingDirectory.toLowerCase().includes(q);
        const matchesPort = v.profile.expectedPort?.toString().includes(q) ?? false;
        const matchesDistro =
          v.profile.environment.type === 'wsl'
            ? v.profile.environment.distro.toLowerCase().includes(q)
            : false;


        if (!matchesName && !matchesCmd && !matchesCwd && !matchesPort && !matchesDistro) {
          return false;
        }
      }

      // 2. Environment Filter
      if (filters.environment !== 'all') {
        if (filters.environment === 'windows' && v.profile.environment.type !== 'windows') {
          return false;
        }
        if (filters.environment === 'wsl' && v.profile.environment.type !== 'wsl') {
          return false;
        }
        if (filters.environment.startsWith('wsl:')) {
          const targetDistro = filters.environment.replace('wsl:', '');
          if (
            v.profile.environment.type !== 'wsl' ||
            v.profile.environment.distro !== targetDistro
          ) {
            return false;
          }
        }
      }

      // 3. Status Filter
      if (filters.status !== 'all') {
        if (v.status !== filters.status) {
          return false;
        }
      }

      return true;
    });
  }, [profileViews, searchQuery, filters]);

  // Filtered & Sorted Discovered Servers
  const visibleDiscoveredServers = useMemo(() => {
    const filtered = filterServers(discoveredServers, searchQuery, filters);
    return sortServers(filtered, sortField, sortDirection);
  }, [discoveredServers, searchQuery, filters, sortField, sortDirection]);

  // Handlers for Profile Operations
  const handleOpenCreateModal = () => {
    setProfileToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (view: ServerProfileView) => {
    setProfileToEdit(view.profile);
    setIsFormModalOpen(true);
  };

  const handleSaveProfile = async (req: CreateProfileRequest | UpdateProfileRequest) => {
    setIsSavingProfile(true);
    try {
      if ('id' in req) {
        await profileApi.updateProfile(req);
        setFeedbackToast({
          type: 'success',
          message: `Server profile "${req.name}" updated successfully.`,
        });
      } else {
        await profileApi.createProfile(req);
        setFeedbackToast({
          type: 'success',
          message: `Server profile "${req.name}" created successfully.`,
        });
      }
      setIsFormModalOpen(false);
      setProfileToEdit(null);
      await refreshAll(true);
    } catch (err: unknown) {
      console.error('Failed to save profile:', err);
      throw err;
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!profileToDelete) return;
    setIsDeletingProfile(true);
    try {
      await profileApi.deleteProfile(profileToDelete.profile.id);
      setFeedbackToast({
        type: 'success',
        message: `Profile "${profileToDelete.profile.name}" deleted.`,
      });
      setProfileToDelete(null);
      await refreshAll(true);
    } catch (err: unknown) {
      console.error('Failed to delete profile:', err);
      setFeedbackToast({
        type: 'error',
        message: typeof err === 'string' ? err : 'Failed to delete profile.',
      });
    } finally {
      setIsDeletingProfile(false);
    }
  };

  const handleStartProfile = async (profileId: string) => {
    const targetView = profileViews.find((v) => v.profile.id === profileId);
    setStartingProfileIds((prev) => new Set(prev).add(profileId));

    try {
      const result = await profileApi.startProfile(profileId);
      setFeedbackToast({
        type: 'success',
        message: result.message,
      });
      await refreshAll();
    } catch (err: unknown) {
      console.error('Failed to start profile:', err);
      const startErr = err as StartError;
      if (startErr.code === 'PORT_ALREADY_IN_USE' || startErr.code === 'PORT_OWNER_CHANGED') {
        setPortConflictError(startErr);
      } else {
        setFeedbackToast({
          type: 'error',
          message: startErr.message || `Failed to start "${targetView?.profile.name ?? 'server'}".`,
        });
      }
      await refreshAll();
    } finally {
      setStartingProfileIds((prev) => {
        const next = new Set(prev);
        next.delete(profileId);
        return next;
      });
    }
  };

  const handleRestartProfile = async (profileId: string) => {
    const targetView = profileViews.find((v) => v.profile.id === profileId);
    setStartingProfileIds((prev) => new Set(prev).add(profileId));

    try {
      const result = await profileApi.restartProfile(profileId);
      setFeedbackToast({
        type: 'success',
        message: result.message,
      });
      await refreshAll();
    } catch (err: unknown) {
      console.error('Failed to restart profile:', err);
      const startErr = err as StartError;
      if (startErr.code === 'PORT_ALREADY_IN_USE' || startErr.code === 'PORT_OWNER_CHANGED') {
        setPortConflictError(startErr);
      } else {
        setFeedbackToast({
          type: 'error',
          message: startErr.message || `Failed to restart "${targetView?.profile.name ?? 'server'}".`,
        });
      }
      await refreshAll();
    } finally {
      setStartingProfileIds((prev) => {
        const next = new Set(prev);
        next.delete(profileId);
        return next;
      });
    }
  };

  const handleStopFromProfile = (view: ServerProfileView) => {
    if (!view.activePid) return;
    const targetServer: DashboardServer = {
      id: view.dashboardServerId ?? `win-${view.activePid}`,
      name: view.profile.name,
      status: 'running',
      primaryPort: view.activePort ?? view.profile.expectedPort ?? 0,
      allPorts: view.activePort ? [view.activePort] : [],
      address: '127.0.0.1',
      protocol: 'tcp',
      pid: view.activePid,
      processName: 'node.exe',
      executablePath: null,
      commandLine: view.profile.command,
      workingDirectory: view.profile.workingDirectory,
      runtime: 'Unknown',
      packageManager: 'Unknown',
      parent: null,
      processTree: [],
      environment: view.profile.environment,
      environmentLabel: view.profile.environment.type === 'windows' ? 'Windows' : 'WSL',
      managed: true,
      profileId: view.profile.id,
    };

    setServerToStop(targetServer);
    setStopError(null);
  };

  const handleConfirmStop = async (force = false) => {
    if (!serverToStop) return;

    const target: ProcessTarget = {
      pid: serverToStop.pid,
      processName: serverToStop.processName,
      executablePath: serverToStop.executablePath,
      workingDirectory: serverToStop.workingDirectory,
      expectedPorts: serverToStop.allPorts,
      force,
      environment: serverToStop.environment,
    };

    setIsExecutingStop(true);
    setStoppingPids((prev) => new Set(prev).add(target.pid));

    try {
      const result = force
        ? await controlApi.forceStopServer(target)
        : await controlApi.stopServer(target);

      if (result.status === 'stopped') {
        setFeedbackToast({
          type: 'success',
          message: `Server "${serverToStop.name}" (PID ${target.pid}) stopped. Port ${result.releasedPorts.join(', ')} freed.`,
        });
        setServerToStop(null);
        setStopError(null);
      } else {
        setFeedbackToast({
          type: 'warning',
          message: result.message,
        });
        setServerToStop(null);
      }

      await refreshAll(true);
    } catch (err: unknown) {
      console.error('Stop operation failed:', err);
      setStopError(err as ProcessControlError | string);
    } finally {
      setIsExecutingStop(false);
      setStoppingPids((prev) => {
        const next = new Set(prev);
        next.delete(target.pid);
        return next;
      });
    }
  };

  const handleInspectProfile = (view: ServerProfileView) => {
    const matching = discoveredServers.find(
      (s) => s.pid === view.activePid && s.environment.type === view.profile.environment.type
    );
    if (matching) {
      setSelectedServer(matching);
    }
  };

  const handleOpenBrowser = async (url: string) => {
    try {
      await openUrl(url);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const isFiltered =
    searchQuery.trim() !== '' ||
    filters.environment !== 'all' ||
    filters.runtime !== 'all' ||
    filters.status !== 'all';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Feedback Notification Toast Banner */}
      {feedbackToast && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border text-xs animate-in fade-in slide-in-from-top-2 duration-200 ${
            feedbackToast.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-700/50 text-emerald-200'
              : feedbackToast.type === 'warning'
              ? 'bg-amber-950/70 border-amber-700/50 text-amber-200'
              : feedbackToast.type === 'error'
              ? 'bg-rose-950/70 border-rose-700/50 text-rose-200'
              : 'bg-blue-950/70 border-blue-700/50 text-blue-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackToast.type === 'success' && (
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
                className="text-emerald-400 shrink-0"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
            {feedbackToast.type === 'warning' && (
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
                className="text-amber-400 shrink-0"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
            {feedbackToast.type === 'error' && (
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
                className="text-rose-400 shrink-0"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            <span className="font-medium leading-relaxed">{feedbackToast.message}</span>
          </div>

          <button
            type="button"
            onClick={() => setFeedbackToast(null)}
            className="text-zinc-400 hover:text-zinc-100 p-1 rounded-md transition-colors"
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Page Header with Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">
            Development Server Management
          </h2>
          <p className="text-zinc-400 text-xs mt-1">
            Configure persistent server profiles, start commands directly from DevHub, and monitor active server processes across Windows and WSL.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer shrink-0"
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
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Server Profile
        </button>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('profiles')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'profiles'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
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
            <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
            <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
            <line x1="6" x2="6.01" y1="6" y2="6" />
            <line x1="6" x2="6.01" y1="18" y2="18" />
          </svg>
          <span>Server Profiles ({profileViews.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            activeTab === 'active'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
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
            <circle cx="12" cy="12" r="10" />
            <polygon points="10 8 16 12 10 16 10 8" />
          </svg>
          <span>Live Discovered Servers ({discoveredServers.length})</span>
        </button>
      </div>

      {/* Toolbar for Search & Filters */}
      <ServerToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        onFilterChange={setFilters}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={setSortField}
        onToggleSortDirection={() =>
          setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
        }
        availableRuntimes={['Node.js', 'Python', 'Rust', '.NET', 'Java', 'Go']}
        wslDistributions={wslDistros}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={setAutoRefresh}
        onRefresh={() => refreshAll(true)}
        loading={loading}
        refreshing={refreshing}
      />

      {/* TAB 1: Server Profiles Grid View */}
      {activeTab === 'profiles' && (
        <div className="space-y-4">
          {profileViews.length === 0 && !loading ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
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
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-semibold text-zinc-100">
                  No Saved Server Profiles Yet
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Save your frontend apps, API servers, and workers to start them with one click directly from DevHub without searching through terminals.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
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
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Create Your First Profile
              </button>
            </div>
          ) : visibleProfiles.length === 0 && !loading ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-3">
              <p className="text-xs text-zinc-400">
                No server profiles match your current search or filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilters({ environment: 'all', runtime: 'all', status: 'all' });
                }}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleProfiles.map((view) => (
                <ProfileCard
                  key={view.profile.id}
                  view={view}
                  isStarting={startingProfileIds.has(view.profile.id)}
                  isStopping={view.activePid ? stoppingPids.has(view.activePid) : false}
                  onStart={handleStartProfile}
                  onRestart={handleRestartProfile}
                  onStop={handleStopFromProfile}
                  onEdit={handleOpenEditModal}
                  onDelete={(v) => setProfileToDelete(v)}
                  onInspect={handleInspectProfile}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Live Discovered Servers View */}
      {activeTab === 'active' && (
        <ServerList
          servers={visibleDiscoveredServers}
          totalServersCount={discoveredServers.length}
          loading={loading}
          error={error}
          onRetry={() => refreshAll(true)}
          onInspect={setSelectedServer}
          onStop={(server) => {
            setServerToStop(server);
            setStopError(null);
          }}
          onOpenBrowser={handleOpenBrowser}
          onClearFilters={() => {
            setSearchQuery('');
            setFilters({ environment: 'all', runtime: 'all', status: 'all' });
          }}
          isFiltered={isFiltered}
          stoppingServerPids={stoppingPids}
        />
      )}

      {/* Profile Form Modal (Create / Edit) */}
      {isFormModalOpen && (
        <ProfileFormModal
          initialProfile={profileToEdit}
          wslDistros={wslDistros}
          onSave={handleSaveProfile}
          onClose={() => {
            setIsFormModalOpen(false);
            setProfileToEdit(null);
          }}
          isSaving={isSavingProfile}
        />
      )}

      {/* Delete Profile Confirmation Modal */}
      {profileToDelete && (
        <DeleteProfileModal
          view={profileToDelete}
          onConfirm={handleDeleteProfile}
          onCancel={() => setProfileToDelete(null)}
          isDeleting={isDeletingProfile}
        />
      )}

      {/* Port Conflict Modal */}
      {portConflictError && (
        <PortConflictModal
          error={portConflictError}
          onClose={() => setPortConflictError(null)}
          onInspectOwner={(ownerPid) => {
            const found = discoveredServers.find((s) => s.pid === ownerPid);
            if (found) {
              setSelectedServer(found);
            }
          }}
        />
      )}

      {/* Server Details Modal (for Inspect action) */}
      {selectedServer && (
        <ServerDetailsModal
          server={selectedServer}
          onClose={() => setSelectedServer(null)}
          onOpenBrowser={handleOpenBrowser}
          onStopServer={(server) => {
            setServerToStop(server);
            setStopError(null);
          }}
          isStopping={stoppingPids.has(selectedServer.pid)}
        />
      )}

      {/* Stop Server Confirmation Modal */}
      {serverToStop && (
        <StopConfirmationModal
          server={serverToStop}
          isStopping={isExecutingStop}
          error={stopError}
          onConfirm={handleConfirmStop}
          onCancel={() => {
            setServerToStop(null);
            setStopError(null);
          }}
          onRefresh={async () => {
            setServerToStop(null);
            setStopError(null);
            await refreshAll(true);
          }}
        />
      )}
    </div>
  );
};

export default Servers;
