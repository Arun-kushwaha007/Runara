import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { identityApi, portApi } from '../lib/commands';
import type { ProcessIdentity, PortInfo, DashboardServer } from '../types';
import { deriveDashboardServers, filterServers, sortServers } from '../lib/serverUtils';
import { ServerList } from '../components/dashboard/ServerList';
import { ServerDetailsModal } from '../components/dashboard/ServerDetailsModal';
import { ServerToolbar } from '../components/dashboard/ServerToolbar';
import { openUrl } from '@tauri-apps/plugin-opener';

const Servers: React.FC = () => {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [identities, setIdentities] = useState<ProcessIdentity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedServer, setSelectedServer] = useState<DashboardServer | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);

  const [filters, setFilters] = useState({
    environment: 'all',
    runtime: 'all',
    status: 'all',
  });
  const [sortField, setSortField] = useState<'port' | 'pid' | 'name' | 'runtime'>('port');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const refreshServers = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [fetchedPorts, fetchedIdentities] = await Promise.all([
        portApi.getListeningPorts(),
        identityApi.getProcessIdentities(),
      ]);
      setPorts(fetchedPorts);
      setIdentities(fetchedIdentities);
      setError(null);
    } catch (err) {
      console.error('Failed to discover servers:', err);
      setError(
        typeof err === 'string'
          ? err
          : 'Unable to inspect local development servers.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refreshServers();
  }, [refreshServers]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      refreshServers();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshServers]);

  const allServers = useMemo(() => {
    return deriveDashboardServers(ports, identities);
  }, [ports, identities]);

  const availableRuntimes = useMemo(() => {
    const set = new Set(allServers.map((s) => s.runtime).filter((r) => r !== 'Unknown'));
    return Array.from(set);
  }, [allServers]);

  const visibleServers = useMemo(() => {
    const filtered = filterServers(allServers, searchQuery, filters);
    return sortServers(filtered, sortField, sortDirection);
  }, [allServers, searchQuery, filters, sortField, sortDirection]);

  const isFiltered =
    searchQuery.trim() !== '' ||
    filters.environment !== 'all' ||
    filters.runtime !== 'all' ||
    filters.status !== 'all';

  const handleOpenBrowser = async (url: string) => {
    try {
      await openUrl(url);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">
            Running Development Servers
          </h2>
          <p className="text-zinc-400 text-xs mt-1">
            Dedicated view of all detected active server processes, bound endpoints, and repository workspaces.
          </p>
        </div>
      </div>

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
        availableRuntimes={availableRuntimes}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={setAutoRefresh}
        onRefresh={() => refreshServers(true)}
        loading={loading}
        refreshing={refreshing}
      />

      <ServerList
        servers={visibleServers}
        totalServersCount={allServers.length}
        loading={loading}
        error={error}
        onRetry={() => refreshServers(true)}
        onInspect={setSelectedServer}
        onOpenBrowser={handleOpenBrowser}
        onClearFilters={() => {
          setSearchQuery('');
          setFilters({ environment: 'all', runtime: 'all', status: 'all' });
        }}
        isFiltered={isFiltered}
      />

      {selectedServer && (
        <ServerDetailsModal
          server={selectedServer}
          onClose={() => setSelectedServer(null)}
          onOpenBrowser={handleOpenBrowser}
        />
      )}
    </div>
  );
};

export default Servers;
