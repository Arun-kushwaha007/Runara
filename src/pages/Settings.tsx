import React, { useEffect, useState } from 'react';
import { systemApi } from '../lib/commands';
import type { SystemInfo } from '../types';

const Settings: React.FC = () => {
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    systemApi.getSystemInfo().then(setSysInfo).catch(console.error);
  }, []);

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col space-y-6 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">Settings & Diagnostics</h2>
        <p className="text-zinc-400 text-xs mt-1">
          System diagnostics, runtime engine configuration, and environment properties.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Environment Info */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
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
              className="text-blue-400"
            >
              <rect width="20" height="14" x="2" y="3" rx="2" />
              <line x1="8" x2="16" y1="21" y2="21" />
              <line x1="12" x2="12" y1="17" y2="21" />
            </svg>
            <span>Host Environment</span>
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-zinc-800/60">
              <span className="text-zinc-500">Platform</span>
              <span className="font-mono text-zinc-200">{sysInfo?.platform ?? 'Windows'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800/60">
              <span className="text-zinc-500">Application</span>
              <span className="font-mono text-zinc-200">{sysInfo?.app ?? 'DevHub'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800/60">
              <span className="text-zinc-500">Version</span>
              <span className="font-mono text-zinc-200">v{sysInfo?.version ?? '0.1.0'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-zinc-500">Backend Core</span>
              <span className="font-mono text-emerald-400">{sysInfo?.backend ?? 'Rust'}</span>
            </div>
          </div>
        </div>

        {/* Discovery Engine */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
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
              className="text-emerald-400"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 14 14" />
            </svg>
            <span>Discovery Engines</span>
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-zinc-800/60">
              <span className="text-zinc-500">TCP Port Enumeration</span>
              <span className="font-mono text-blue-300">Win32 IP Helper (GetExtendedTcpTable)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800/60">
              <span className="text-zinc-500">Process & PEB Inspection</span>
              <span className="font-mono text-blue-300">sysinfo + Toolhelp Snapshot</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800/60">
              <span className="text-zinc-500">Process Identity Engine</span>
              <span className="font-mono text-emerald-400">ProcessIdentityService (M3)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-zinc-500">WSL Engine</span>
              <span className="font-mono text-zinc-500">Milestone 6 (Planned)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Product Roadmap Note */}
      <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-xl p-5 text-xs text-zinc-400 space-y-2">
        <h4 className="font-semibold text-zinc-300">Milestone Status</h4>
        <p className="text-zinc-400 leading-relaxed">
          Milestone 4 (Server Dashboard) is currently active. Future milestones will introduce process lifecycle control (Stop / Restart in Milestone 5), WSL distribution inspection (Milestone 6), and saved server profiles with one-click launching (Milestone 7).
        </p>
      </div>
    </div>
  );
};

export default Settings;
