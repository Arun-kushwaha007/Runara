import React, { useEffect, useState } from 'react';
import { getSystemInfo } from '../lib/commands';
import type { SystemInfo } from '../types';

const Dashboard: React.FC = () => {
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSystemInfo()
      .then(info => {
        setSysInfo(info);
        setError(null);
      })
      .catch(err => {
        console.error('Failed to get system info:', err);
        setError(String(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Hero Section */}
      <section>
        <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">DevHub</h2>
        <p className="text-zinc-400 mt-1">Local Development Control Center</p>
      </section>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { title: 'Running Servers', subtitle: 'No servers detected' },
          { title: 'Windows', subtitle: 'Not scanning' },
          { title: 'WSL', subtitle: 'Not scanning' },
          { title: 'Listening Ports', subtitle: 'Not scanning' },
        ].map((card, i) => (
          <div key={i} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-5 flex flex-col">
            <span className="text-sm font-medium text-zinc-300">{card.title}</span>
            <div className="mt-2 text-3xl font-light text-zinc-500">&mdash;</div>
            <span className="mt-auto pt-4 text-xs text-zinc-500">{card.subtitle}</span>
          </div>
        ))}
      </section>

      {/* Empty State */}
      <section>
        <div className="border border-dashed border-zinc-700/50 rounded-xl p-8 text-center bg-zinc-900/20">
          <p className="text-sm text-zinc-400">Detected development servers will appear here.</p>
          <p className="text-xs text-zinc-500 mt-2">Process and port discovery will be implemented in upcoming milestones.</p>
        </div>
      </section>

      {/* System Status */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">System Status</h3>
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-5">
          {loading ? (
            <div className="text-sm text-zinc-400 flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-zinc-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Fetching system information...
            </div>
          ) : error ? (
            <div className="text-sm text-red-400 bg-red-950/30 p-3 rounded-lg border border-red-900/50">
              Error: {error}
            </div>
          ) : sysInfo ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              <div>
                <div className="text-xs text-zinc-500">App</div>
                <div className="text-sm text-zinc-200 mt-1 font-medium">{sysInfo.app}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Version</div>
                <div className="text-sm text-zinc-200 mt-1 font-medium">{sysInfo.version}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Backend</div>
                <div className="text-sm text-zinc-200 mt-1 font-medium">{sysInfo.backend}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Status</div>
                <div className="text-sm text-zinc-200 mt-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  {sysInfo.status}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Platform</div>
                <div className="text-sm text-zinc-200 mt-1 font-medium">{sysInfo.platform}</div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
