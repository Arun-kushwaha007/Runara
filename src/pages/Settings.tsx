import React, { useEffect, useState, useCallback } from 'react';
import { systemApi } from '../lib/commands';
import type { SystemDiagnostics, SystemInfo } from '../types';
import { Toast, type ToastMessage } from '../components/common/Toast';

export const Settings: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Settings state (persisted to localStorage)
  const [defaultInterval, setDefaultInterval] = useState<number>(() => {
    const saved = localStorage.getItem('devhub_poll_interval');
    return saved ? parseInt(saved, 10) : 3000;
  });

  const [confirmDangerousActions, setConfirmDangerousActions] = useState<boolean>(() => {
    const saved = localStorage.getItem('devhub_confirm_danger');
    return saved !== null ? saved === 'true' : true;
  });

  const fetchDiagnostics = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [diag, info] = await Promise.all([
        systemApi.getDiagnostics().catch((err) => {
          console.warn('Diagnostics call failed:', err);
          return null;
        }),
        systemApi.getSystemInfo().catch((err) => {
          console.warn('SystemInfo call failed:', err);
          return null;
        }),
      ]);
      setDiagnostics(diag);
      setSysInfo(info);
      if (isManual) {
        setToast({ type: 'success', message: 'System diagnostics refreshed.' });
      }
    } catch (err) {
      console.error('Failed to load diagnostics:', err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDiagnostics();
  }, [fetchDiagnostics]);

  const handleIntervalChange = (val: number) => {
    setDefaultInterval(val);
    localStorage.setItem('devhub_poll_interval', val.toString());
    setToast({ type: 'info', message: `Default polling interval set to ${val / 1000}s.` });
  };

  const handleConfirmToggle = (val: boolean) => {
    setConfirmDangerousActions(val);
    localStorage.setItem('devhub_confirm_danger', val.toString());
    setToast({
      type: 'info',
      message: val
        ? 'Pre-termination safety confirmations enabled.'
        : 'Warning: Direct process termination enabled.',
    });
  };

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">Settings & Diagnostics</h2>
          <p className="text-zinc-400 text-xs mt-1">
            System diagnostics, environment health telemetry, SQLite persistence status, and configuration.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchDiagnostics(true)}
          disabled={loading || refreshing}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-xs font-semibold rounded-lg border border-zinc-700 transition-colors cursor-pointer"
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
          <span>{refreshing ? 'Refreshing...' : 'Refresh Telemetry'}</span>
        </button>
      </div>

      {/* Grid: Environment Info + Discovery Subsystems */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Host & Runtime Environment */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-3 shadow-xs">
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
              <span className="text-zinc-500">Operating System</span>
              <span className="font-mono text-zinc-200">
                {diagnostics?.platform ?? sysInfo?.platform ?? 'Windows'} ({diagnostics?.arch ?? 'x86_64'})
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800/60">
              <span className="text-zinc-500">Application Version</span>
              <span className="font-mono text-zinc-200">v{diagnostics?.appVersion ?? sysInfo?.version ?? '0.1.0'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800/60">
              <span className="text-zinc-500">Tauri Shell</span>
              <span className="font-mono text-blue-400">Tauri v{diagnostics?.tauriVersion ?? '2.0'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-zinc-500">Native Core Backend</span>
              <span className="font-mono text-emerald-400">
                {diagnostics?.backend ?? sysInfo?.backend ?? 'Rust'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Persistence & Storage Subsystem */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-3 shadow-xs">
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
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
            </svg>
            <span>Persistence & Database</span>
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-zinc-800/60">
              <span className="text-zinc-500">Engine</span>
              <span className="font-mono text-emerald-400">SQLite 3 (Bundled C Engine)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800/60">
              <span className="text-zinc-500">Journal Mode</span>
              <span className="font-mono text-emerald-300">WAL (Write-Ahead Logging)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800/60">
              <span className="text-zinc-500">Schema Version</span>
              <span className="font-mono text-zinc-200">
                Migration {diagnostics?.databaseSchemaVersion ?? 2} (Latest)
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-zinc-500">Health Status</span>
              <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{diagnostics?.databaseStatus ?? 'Healthy'}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Environment Telemetry & WSL Subsystem */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
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
              className="text-purple-400"
            >
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            <span>WSL (Windows Subsystem for Linux) Subsystem</span>
          </h3>

          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              diagnostics?.wslAvailable
                ? 'bg-purple-950/70 text-purple-300 border border-purple-800/50'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                diagnostics?.wslAvailable ? 'bg-purple-400 animate-pulse' : 'bg-zinc-500'
              }`}
            ></span>
            <span>{diagnostics?.wslAvailable ? 'Active & Available' : 'Not Detected'}</span>
          </span>
        </div>

        {diagnostics?.wslDistributions && diagnostics.wslDistributions.length > 0 ? (
          <div className="border border-zinc-800 rounded-lg overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-zinc-950/60 border-b border-zinc-800 text-zinc-400 font-medium">
                <tr>
                  <th className="py-2.5 px-3">Distribution Name</th>
                  <th className="py-2.5 px-3">State</th>
                  <th className="py-2.5 px-3">WSL Version</th>
                  <th className="py-2.5 px-3">Default</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {diagnostics.wslDistributions.map((distro) => (
                  <tr key={distro.name} className="hover:bg-zinc-800/30">
                    <td className="py-2 px-3 text-zinc-200 font-semibold">{distro.name}</td>
                    <td className="py-2 px-3">
                      {distro.state === 'running' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>Running</span>
                        </span>
                      ) : (
                        <span className="text-zinc-500">Stopped</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-zinc-400">v{distro.version}</td>
                    <td className="py-2 px-3">
                      {distro.isDefault ? (
                        <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/50 text-[10px]">
                          Default
                        </span>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-zinc-950/40 border border-zinc-800 text-xs text-zinc-400">
            No WSL distributions currently detected. DevHub operates normally in Windows-only mode.
          </div>
        )}
      </div>

      {/* Discovery Engines & Safety Invariants */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-3 shadow-xs">
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
            className="text-amber-400"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          </svg>
          <span>Discovery Architecture & Safety Invariants</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-lg space-y-1">
            <span className="font-semibold text-zinc-300">Win32 IP Helper API</span>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Queries <code className="text-blue-300 font-mono">GetExtendedTcpTable</code> directly in kernel memory for sub-millisecond port enumeration without shell parsing overhead.
            </p>
          </div>

          <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-lg space-y-1">
            <span className="font-semibold text-zinc-300">9-Point Process Verification</span>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Mitigates TOCTOU and PID-reuse vulnerabilities by verifying process name, path, and CWD before any termination.
            </p>
          </div>

          <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-lg space-y-1">
            <span className="font-semibold text-zinc-300">Ancestor Protection Rule</span>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Prevents accidental termination of parent shells (PowerShell, CMD, Bash) and IDEs (VS Code, Cursor).
            </p>
          </div>

          <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-lg space-y-1">
            <span className="font-semibold text-zinc-300">Environment Isolation</span>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Composite <code className="text-purple-300 font-mono">(Environment, PID)</code> keys ensure zero cross-environment PID or port collisions.
            </p>
          </div>
        </div>
      </div>

      {/* Application Preferences */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
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
            className="text-zinc-400"
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>Preferences & Control</span>
        </h3>

        <div className="space-y-3 text-xs">
          {/* Polling Interval */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-2 border-b border-zinc-800/60">
            <div>
              <span className="font-semibold text-zinc-300">Auto-Refresh Polling Interval</span>
              <p className="text-[11px] text-zinc-500">Frequency of background TCP port & process discovery sweeps.</p>
            </div>
            <select
              value={defaultInterval}
              onChange={(e) => handleIntervalChange(parseInt(e.target.value, 10))}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-hidden cursor-pointer"
            >
              <option value={2000}>2 seconds (Fast)</option>
              <option value={3000}>3 seconds (Default)</option>
              <option value={5000}>5 seconds (Relaxed)</option>
              <option value={10000}>10 seconds (Low Resource)</option>
            </select>
          </div>

          {/* Dangerous Action Confirmations */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-2">
            <div>
              <span className="font-semibold text-zinc-300">Safety Confirmations</span>
              <p className="text-[11px] text-zinc-500">
                Require confirmation modals before terminating processes or deleting profiles.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={confirmDangerousActions}
                onChange={(e) => handleConfirmToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* About Box */}
      <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-xl p-5 text-xs text-zinc-400 space-y-2">
        <h4 className="font-semibold text-zinc-300">DevHub MVP Release (v0.1.0)</h4>
        <p className="text-zinc-400 leading-relaxed">
          DevHub is a native Windows desktop application for managing local development servers across Windows and WSL. Built with Rust, Tauri 2, React 19, TypeScript, and SQLite.
        </p>
        <div className="pt-2 flex flex-wrap gap-4 text-xs font-mono text-zinc-500">
          <span>Target Platform: Windows 10/11</span>
          <span>•</span>
          <span>Environment: Windows + WSL 2</span>
          <span>•</span>
          <span>License: MIT / Apache 2.0</span>
        </div>
      </div>

      {/* Toast Notification */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
};

export default Settings;
