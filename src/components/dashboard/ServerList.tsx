import React from 'react';
import type { DashboardServer } from '../../types';
import { ServerCard } from './ServerCard';
import { LoadingState } from '../common/LoadingState';
import { ErrorState } from '../common/ErrorState';
import { EmptyState } from '../common/EmptyState';

interface ServerListProps {
  servers: DashboardServer[];
  totalServersCount: number;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onInspect: (server: DashboardServer) => void;
  onStop?: (server: DashboardServer) => void;
  onOpenBrowser?: (url: string) => void;
  onClearFilters: () => void;
  isFiltered: boolean;
  stoppingServerPids?: Set<number>;
}

export const ServerList: React.FC<ServerListProps> = ({
  servers,
  totalServersCount,
  loading,
  error,
  onRetry,
  onInspect,
  onStop,
  onOpenBrowser,
  onClearFilters,
  isFiltered,
  stoppingServerPids,
}) => {
  if (loading && totalServersCount === 0) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />;
  }

  if (servers.length === 0) {
    return (
      <EmptyState
        isFiltered={isFiltered && totalServersCount > 0}
        onClearFilters={onClearFilters}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
        <span>
          Showing <strong className="text-zinc-200">{servers.length}</strong> of{' '}
          <strong className="text-zinc-200">{totalServersCount}</strong> running development{' '}
          {totalServersCount === 1 ? 'server' : 'servers'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {servers.map((server) => (
          <ServerCard
            key={server.id}
            server={server}
            onInspect={onInspect}
            onStop={onStop}
            onOpenBrowser={onOpenBrowser}
            isStopping={stoppingServerPids?.has(server.pid)}
          />
        ))}
      </div>
    </div>
  );
};
