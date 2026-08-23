import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { controlApi, profileApi, unifiedApi, wslApi } from '../lib/commands';
import type {
  DashboardServer,
  ProcessTarget,
  ProcessControlError,
  ServerProfileView,
  ServerProfile,
  CreateProfileRequest,
  UpdateProfileRequest,
  StartError,
  WslDistribution,
} from '../types';
import { deriveDashboardServers, annotateWithProfiles } from '../lib/serverUtils';
import { ProfileCard } from '../components/profiles/ProfileCard';
import { ProfileFormModal } from '../components/profiles/ProfileFormModal';
import { DeleteProfileModal } from '../components/profiles/DeleteProfileModal';
import { PortConflictModal } from '../components/profiles/PortConflictModal';
import { ServerDetailsModal } from '../components/dashboard/ServerDetailsModal';
import { StopConfirmationModal } from '../components/dashboard/StopConfirmationModal';
import { Toast, type ToastMessage } from '../components/common/Toast';
import { openUrl } from '@tauri-apps/plugin-opener';

export const Profiles: React.FC = () => {
  // Server Profiles State
  const [profileViews, setProfileViews] = useState<ServerProfileView[]>([]);
  const [wslDistros, setWslDistros] = useState<WslDistribution[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [envFilter, setEnvFilter] = useState<'all' | 'windows' | 'wsl'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'stopped' | 'error'>('all');

  // Active in-flight start operations
  const [startingProfileIds, setStartingProfileIds] = useState<Set<string>>(new Set());

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [profileToEdit, setProfileToEdit] = useState<ServerProfile | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  const [profileToDelete, setProfileToDelete] = useState<ServerProfileView | null>(null);
  const [isDeletingProfile, setIsDeletingProfile] = useState<boolean>(false);

  const [portConflictError, setPortConflictError] = useState<StartError | null>(null);

  // Live Discovered Servers State (for Inspection modal)
  const [discoveredServers, setDiscoveredServers] = useState<DashboardServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<DashboardServer | null>(null);
  const [serverToStop, setServerToStop] = useState<DashboardServer | null>(null);
  const [stopError, setStopError] = useState<ProcessControlError | string | null>(null);
  const [isExecutingStop, setIsExecutingStop] = useState<boolean>(false);
  const [stoppingPids, setStoppingPids] = useState<Set<number>>(new Set());

  // Toast Notification
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((type: 'success' | 'warning' | 'info' | 'error', message: string, details?: string) => {
    setToast({ type, message, details });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast]);

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
          console.warn('Failed to load unified snapshot:', err);
          return null;
        }),
        wslApi.getWslDistributions().catch((err) => {
          console.warn('Failed to load WSL distros:', err);
          return [] as WslDistribution[];
        }),
      ]);

      setProfileViews(fetchedViews);
      setWslDistros(distros);

      if (snapshot) {
        const rawServers = deriveDashboardServers(snapshot.ports, snapshot.identities);
        const rawProfiles = fetchedViews.map((v) => v.profile);
        const annotated = annotateWithProfiles(rawServers, rawProfiles);
        setDiscoveredServers(annotated);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast('error', `Failed to refresh server profiles: ${msg}`);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, [showToast]);

  // Initial load
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Auto-refresh interval (3s)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      refreshAll(false);
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshAll]);

  // Filtered Profiles
  const filteredProfiles = useMemo(() => {
    return profileViews.filter((pv) => {
      // Env Filter
      if (envFilter === 'windows' && pv.profile.environment.type !== 'windows') return false;
      if (envFilter === 'wsl' && pv.profile.environment.type !== 'wsl') return false;

      // Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'running' && pv.status !== 'running') return false;
        if (statusFilter === 'stopped' && pv.status !== 'stopped') return false;
        if (statusFilter === 'error' && pv.status !== 'error') return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = pv.profile.name.toLowerCase().includes(q);
        const matchesCmd = pv.profile.command.toLowerCase().includes(q);
        const matchesCwd = pv.profile.workingDirectory.toLowerCase().includes(q);
        const matchesPort = pv.profile.expectedPort ? pv.profile.expectedPort.toString().includes(q) : false;
        const matchesDistro =
          pv.profile.environment.type === 'wsl' && pv.profile.environment.distro
            ? pv.profile.environment.distro.toLowerCase().includes(q)
            : false;
        if (!matchesName && !matchesCmd && !matchesCwd && !matchesPort && !matchesDistro) {
          return false;
        }
      }

      return true;
    });
  }, [profileViews, envFilter, statusFilter, searchQuery]);

  // Metrics
  const runningCount = profileViews.filter((p) => p.status === 'running').length;
  const windowsCount = profileViews.filter((p) => p.profile.environment.type === 'windows').length;
  const wslCount = profileViews.filter((p) => p.profile.environment.type === 'wsl').length;

  // Actions
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
      if (profileToEdit) {
        await profileApi.updateProfile(req as UpdateProfileRequest);
        showToast('success', `Profile '${req.name}' updated successfully.`);
      } else {
        await profileApi.createProfile(req as CreateProfileRequest);
        showToast('success', `Profile '${req.name}' created successfully.`);
      }
      setIsFormModalOpen(false);
      setProfileToEdit(null);
      await refreshAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast('error', `Failed to save profile: ${msg}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleOpenDeleteModal = (profileView: ServerProfileView) => {
    setProfileToDelete(profileView);
    setIsDeletingProfile(false);
  };

  const handleDeleteProfile = async () => {
    if (!profileToDelete) return;
    setIsDeletingProfile(true);
    try {
      await profileApi.deleteProfile(profileToDelete.profile.id);
      showToast('success', `Profile '${profileToDelete.profile.name}' deleted.`);
      setProfileToDelete(null);
      await refreshAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast('error', `Failed to delete profile: ${msg}`);
    } finally {
      setIsDeletingProfile(false);
    }
  };

  const handleStartProfile = async (profileId: string) => {
    setStartingProfileIds((prev) => new Set(prev).add(profileId));
    try {
      const result = await profileApi.startProfile(profileId);
      showToast('success', result.message || 'Server started successfully.');
      await refreshAll();
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err) {
        const startErr = err as StartError;
        if (startErr.code === 'PORT_ALREADY_IN_USE') {
          setPortConflictError(startErr);
          return;
        }
      }
      const msg = err instanceof Error ? err.message : String(err);
      showToast('error', `Failed to start server: ${msg}`);
    } finally {
      setStartingProfileIds((prev) => {
        const next = new Set(prev);
        next.delete(profileId);
        return next;
      });
    }
  };

  const handleRestartProfile = async (profileId: string) => {
    setStartingProfileIds((prev) => new Set(prev).add(profileId));
    try {
      const result = await profileApi.restartProfile(profileId);
      showToast('success', result.message || 'Server restarted successfully.');
      await refreshAll();
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err) {
        const startErr = err as StartError;
        if (startErr.code === 'PORT_ALREADY_IN_USE') {
          setPortConflictError(startErr);
          return;
        }
      }
      const msg = err instanceof Error ? err.message : String(err);
      showToast('error', `Failed to restart server: ${msg}`);
    } finally {
      setStartingProfileIds((prev) => {
        const next = new Set(prev);
        next.delete(profileId);
        return next;
      });
    }
  };

  const handleInspectLiveServer = (server: DashboardServer) => {
    setSelectedServer(server);
  };

  const handleOpenStopModal = (server: DashboardServer) => {
    setServerToStop(server);
    setStopError(null);
    setIsExecutingStop(false);
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
      environment: serverToStop.environment ?? { type: 'windows' },
    };

    setIsExecutingStop(true);
    setStopError(null);
    setStoppingPids((prev) => new Set(prev).add(serverToStop.pid));

    try {
      const result = force
        ? await controlApi.forceStopServer(target)
        : await controlApi.stopServer(target);

      if (result.status === 'stopped') {
        showToast('success', result.message);
        setServerToStop(null);
        setSelectedServer(null);
        await refreshAll();
      } else {
        setStopError(result.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStopError(msg || 'An unexpected error occurred while stopping the process.');
    } finally {
      setIsExecutingStop(false);
      setStoppingPids((prev) => {
        const next = new Set(prev);
        if (serverToStop) next.delete(serverToStop.pid);
        return next;
      });
    }
  };

  const handleOpenBrowser = async (url: string) => {
    try {
      await openUrl(url);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 text-app-fg">
      {/* Header with Title & Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-app-fg tracking-tight flex items-center gap-2.5">
            <span>Server Profiles</span>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-app-muted text-app-muted-fg border border-app-border">
              {profileViews.length}
            </span>
          </h2>
          <p className="text-xs text-app-muted-fg mt-1">
            Persistent configurations for launching, monitoring, and organizing local development servers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => refreshAll(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-2 px-3 py-2 bg-app-muted hover:bg-app-surface-hover disabled:opacity-50 text-app-fg text-xs font-semibold rounded-lg border border-app-border transition-colors cursor-pointer"
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
              className={refreshing ? 'animate-spin' : ''}
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-md transition-colors cursor-pointer"
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
            <span>New Server Profile</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-app-surface border border-app-border rounded-xl p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-app-muted-fg">Total Profiles</span>
            <div className="text-xl font-bold font-mono text-app-fg mt-0.5">{profileViews.length}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-app-muted border border-app-border flex items-center justify-center text-app-muted-fg">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
              <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
              <line x1="6" x2="6.01" y1="6" y2="6" />
              <line x1="6" x2="6.01" y1="18" y2="18" />
            </svg>
          </div>
        </div>

        <div className="bg-app-surface border border-app-border rounded-xl p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-app-muted-fg">Running</span>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">{runningCount}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
        </div>

        <div className="bg-app-surface border border-app-border rounded-xl p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-app-muted-fg">Windows</span>
            <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5">{windowsCount}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="14" x="2" y="3" rx="2" />
              <line x1="8" x2="16" y1="21" y2="21" />
              <line x1="12" x2="12" y1="17" y2="21" />
            </svg>
          </div>
        </div>

        <div className="bg-app-surface border border-app-border rounded-xl p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-app-muted-fg">WSL</span>
            <div className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-0.5">{wslCount}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          </div>
        </div>
      </div>

      {/* Toolbar / Search & Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-app-surface border border-app-border rounded-xl p-3.5 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-app-muted-fg">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search profiles by name, command, port (e.g. 3000), directory..."
            className="w-full bg-app-input border border-app-border focus:border-blue-500 rounded-lg pl-9 pr-8 py-2 text-xs text-app-fg placeholder:text-app-muted-fg focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-app-muted-fg hover:text-app-fg cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Environment Filter */}
          <div className="flex items-center gap-1 bg-app-bg border border-app-border rounded-lg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setEnvFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                envFilter === 'all' ? 'bg-app-muted text-app-fg font-semibold border border-app-border' : 'text-app-muted-fg hover:text-app-fg'
              }`}
            >
              All Envs
            </button>
            <button
              type="button"
              onClick={() => setEnvFilter('windows')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                envFilter === 'windows' ? 'bg-blue-600/20 text-blue-600 dark:text-blue-300 border border-blue-500/40 font-semibold' : 'text-app-muted-fg hover:text-app-fg'
              }`}
            >
              Windows
            </button>
            <button
              type="button"
              onClick={() => setEnvFilter('wsl')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                envFilter === 'wsl' ? 'bg-purple-600/20 text-purple-600 dark:text-purple-300 border border-purple-500/40 font-semibold' : 'text-app-muted-fg hover:text-app-fg'
              }`}
            >
              WSL
            </button>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'running' | 'stopped' | 'error')}
            className="bg-app-input border border-app-border rounded-lg px-2.5 py-1.5 text-xs text-app-fg focus:outline-hidden cursor-pointer"
          >
            <option value="all" className="bg-app-surface text-app-fg">All Statuses</option>
            <option value="running" className="bg-app-surface text-emerald-600 dark:text-emerald-400">Running</option>
            <option value="stopped" className="bg-app-surface text-app-muted-fg">Stopped</option>
            <option value="error" className="bg-app-surface text-red-600 dark:text-red-400">Error</option>
          </select>

          {/* Auto Refresh Toggle */}
          <label className="flex items-center gap-1.5 text-xs text-app-muted-fg cursor-pointer bg-app-input border border-app-border px-2.5 py-1.5 rounded-lg select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded bg-app-surface border-app-border text-blue-600 focus:ring-0"
            />
            <span>Auto (3s)</span>
          </label>
        </div>
      </div>

      {/* Profile Card Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-app-surface border border-app-border rounded-xl p-5 space-y-4 animate-pulse">
              <div className="h-5 bg-app-muted rounded w-1/2"></div>
              <div className="h-8 bg-app-muted rounded w-1/3"></div>
              <div className="space-y-2 pt-2 border-t border-app-border">
                <div className="h-3.5 bg-app-muted rounded w-4/5"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="border border-dashed border-app-border rounded-2xl p-12 text-center bg-app-surface/40 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-app-muted border border-app-border flex items-center justify-center text-app-muted-fg mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
              <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
              <line x1="6" x2="6.01" y1="6" y2="6" />
              <line x1="6" x2="6.01" y1="18" y2="18" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-app-fg">
            {searchQuery || envFilter !== 'all' || statusFilter !== 'all'
              ? 'No matching server profiles'
              : 'No Server Profiles created yet'}
          </h3>
          <p className="text-xs text-app-muted-fg mt-1 max-w-sm">
            {searchQuery || envFilter !== 'all' || statusFilter !== 'all'
              ? 'No profiles matched your search or filter settings. Try adjusting or clearing your filters.'
              : 'Create a Server Profile to save startup commands, paths, and ports for quick one-click launching and project grouping.'}
          </p>
          {searchQuery || envFilter !== 'all' || statusFilter !== 'all' ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setEnvFilter('all');
                setStatusFilter('all');
              }}
              className="mt-4 px-3.5 py-1.5 bg-app-muted hover:bg-app-surface-hover text-app-fg text-xs font-semibold rounded-lg border border-app-border transition-colors cursor-pointer"
            >
              Clear filters
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Create Server Profile
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProfiles.map((pv) => (
            <ProfileCard
              key={pv.profile.id}
              view={pv}
              onStart={handleStartProfile}
              onRestart={handleRestartProfile}
              onStop={() => {
                if (pv.activePid) {
                  const matchingServer = discoveredServers.find(
                    (s) =>
                      s.pid === pv.activePid &&
                      ((pv.profile.environment.type === 'windows' && (!s.environment || s.environment.type === 'windows')) ||
                        (pv.profile.environment.type === 'wsl' && s.environment?.type === 'wsl' && s.environment.distro === pv.profile.environment.distro))
                  );
                  if (matchingServer) {
                    handleOpenStopModal(matchingServer);
                  }
                }
              }}
              onEdit={handleOpenEditModal}
              onDelete={handleOpenDeleteModal}
              onInspect={() => {
                if (pv.activePid) {
                  const matchingServer = discoveredServers.find(
                    (s) =>
                      s.pid === pv.activePid &&
                      ((pv.profile.environment.type === 'windows' && (!s.environment || s.environment.type === 'windows')) ||
                        (pv.profile.environment.type === 'wsl' && s.environment?.type === 'wsl' && s.environment.distro === pv.profile.environment.distro))
                  );
                  if (matchingServer) {
                    handleInspectLiveServer(matchingServer);
                  }
                }
              }}
              isStarting={startingProfileIds.has(pv.profile.id)}
            />
          ))}
        </div>
      )}

      {/* Modals Suite */}
      {isFormModalOpen && (
        <ProfileFormModal
          initialProfile={profileToEdit}
          wslDistros={wslDistros}
          isSaving={isSavingProfile}
          onSave={handleSaveProfile}
          onClose={() => {
            setIsFormModalOpen(false);
            setProfileToEdit(null);
          }}
        />
      )}

      {profileToDelete && (
        <DeleteProfileModal
          view={profileToDelete}
          isDeleting={isDeletingProfile}
          onConfirm={handleDeleteProfile}
          onCancel={() => setProfileToDelete(null)}
        />
      )}

      {portConflictError && (
        <PortConflictModal
          error={portConflictError}
          onClose={() => setPortConflictError(null)}
          onInspectOwner={(pid) => {
            setPortConflictError(null);
            const ownerServer = discoveredServers.find((s) => s.pid === pid);
            if (ownerServer) {
              setSelectedServer(ownerServer);
            }
          }}
        />
      )}

      {selectedServer && (
        <ServerDetailsModal
          server={selectedServer}
          onClose={() => setSelectedServer(null)}
          onOpenBrowser={handleOpenBrowser}
          onStopServer={handleOpenStopModal}
          isStopping={stoppingPids.has(selectedServer.pid)}
        />
      )}

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
          onRefresh={() => refreshAll(true)}
        />
      )}

      {/* Toast */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
};

export default Profiles;
