import React, { useEffect, useState, useCallback } from 'react';
import { systemApi } from '../lib/commands';
import type { SystemDiagnostics, SystemInfo } from '../types';
import { useTheme } from '../context/ThemeContext';
import type { ThemePreference } from '../types/theme';
import { Toast, type ToastMessage } from '../components/common/Toast';

export const Settings: React.FC = () => {
  const { themePreference, resolvedTheme, setTheme } = useTheme();

  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState<boolean>(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Settings state (persisted to localStorage)
  const [defaultInterval, setDefaultInterval] = useState<number>(() => {
    const saved = localStorage.getItem('runara_poll_interval');
    return saved ? parseInt(saved, 10) : 3000;
  });

  const [confirmDangerousActions, setConfirmDangerousActions] = useState<boolean>(() => {
    const saved = localStorage.getItem('runara_confirm_danger');
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

  const handleThemeChange = (newTheme: ThemePreference) => {
    setTheme(newTheme);
    setToast({
      type: 'info',
      message: `Theme updated to ${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)}.`,
    });
  };

  const handleIntervalChange = (val: number) => {
    setDefaultInterval(val);
    localStorage.setItem('runara_poll_interval', val.toString());
    setToast({ type: 'info', message: `Default polling interval set to ${val / 1000}s.` });
  };

  const handleConfirmToggle = (val: boolean) => {
    setConfirmDangerousActions(val);
    localStorage.setItem('runara_confirm_danger', val.toString());
    setToast({
      type: 'info',
      message: val
        ? 'Pre-termination safety confirmations enabled.'
        : 'Warning: Direct process termination enabled.',
    });
  };

  const handleResetSettings = () => {
    setTheme('dark');
    setDefaultInterval(3000);
    localStorage.setItem('runara_poll_interval', '3000');
    setConfirmDangerousActions(true);
    localStorage.setItem('runara_confirm_danger', 'true');
    setToast({
      type: 'success',
      message: 'Appearance and application preferences reset to defaults.',
    });
  };

  const themeOptions: {
    id: ThemePreference;
    label: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'dark',
      label: 'Dark Mode',
      description: 'Primary developer-tool appearance (#101010)',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      ),
    },
    {
      id: 'light',
      label: 'Light Mode',
      description: 'High-contrast bright appearance (#F9F9F9)',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      ),
    },
    {
      id: 'system',
      label: 'System Sync',
      description: 'Automatically match operating system scheme',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="3" rx="2" />
          <line x1="8" x2="16" y1="21" y2="21" />
          <line x1="12" x2="12" y1="17" y2="21" />
        </svg>
      ),
    },
  ];

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-app-fg tracking-tight">Settings & Diagnostics</h2>
          <p className="text-app-muted-fg text-xs mt-1">
            Configure application theme appearance, safety behaviors, and inspect host system telemetry.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-app-surface hover:bg-app-surface-hover text-app-muted-fg hover:text-app-fg text-xs font-semibold rounded-lg border border-app-border transition-colors cursor-pointer"
          title="Reset theme and preferences to default"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* 1. Appearance Section */}
      <section aria-labelledby="appearance-settings-title" className="bg-app-surface border border-app-border rounded-xl p-5 space-y-5 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 id="appearance-settings-title" className="text-sm font-semibold text-app-fg flex items-center gap-2">
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
              className="text-blue-500"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10" />
            </svg>
            <span>Appearance & Theme</span>
          </h3>

          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-app-muted text-app-muted-fg border border-app-border-subtle">
            Active: <span className="font-semibold text-app-fg">{resolvedTheme.toUpperCase()}</span>
            {themePreference === 'system' ? ' (System Sync)' : ''}
          </span>
        </div>

        {/* Theme Selection Controls */}
        <div>
          <label className="block text-xs font-semibold text-app-muted-fg mb-2.5">
            Select Visual Theme:
          </label>
          <div
            role="radiogroup"
            aria-label="Theme selection"
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            {themeOptions.map((opt) => {
              const isSelected = themePreference === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleThemeChange(opt.id)}
                  className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                    isSelected
                      ? 'bg-blue-600/10 border-blue-500 text-app-fg shadow-xs ring-1 ring-blue-500'
                      : 'bg-app-bg/50 border-app-border text-app-muted-fg hover:border-app-border-subtle hover:bg-app-surface-hover hover:text-app-fg'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={isSelected ? 'text-blue-500' : 'text-app-muted-fg'}>
                        {opt.icon}
                      </span>
                      <span className="text-xs font-bold text-app-fg">{opt.label}</span>
                    </div>
                    <div
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-blue-500 bg-blue-600' : 'border-app-border bg-app-bg'
                      }`}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                    </div>
                  </div>
                  <p className="text-[11px] text-app-muted-fg leading-relaxed">
                    {opt.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Theme Preview */}
        <div className="pt-2">
          <label className="block text-xs font-semibold text-app-muted-fg mb-2">
            Theme Preview:
          </label>
          <div className="p-4 rounded-xl bg-app-bg border border-app-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-500 text-[10px] font-bold">
                  R
                </div>
                <span className="text-xs font-bold text-app-fg">Runara Control Center</span>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>4 Running Servers</span>
              </span>
            </div>

            <div className="p-3 rounded-lg bg-app-surface border border-app-border flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono text-app-fg">company-api</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-app-muted text-app-muted-fg font-mono">
                    :5000
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-600/10 text-blue-500 font-mono">
                    Node.js
                  </span>
                </div>
                <p className="text-[11px] text-app-muted-fg font-mono">
                  npm run dev -- --port 5000
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-app-muted text-app-muted-fg border border-app-border-subtle">
                  PID 14920
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Preferences & Application Configuration */}
      <section aria-labelledby="preferences-settings-title" className="bg-app-surface border border-app-border rounded-xl p-5 space-y-4 shadow-xs">
        <h3 id="preferences-settings-title" className="text-sm font-semibold text-app-fg flex items-center gap-2">
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
            className="text-app-muted-fg"
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>Application Preferences</span>
        </h3>

        <div className="space-y-3 text-xs">
          {/* Polling Interval */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-2 border-b border-app-border">
            <div>
              <span className="font-semibold text-app-fg">Auto-Refresh Polling Interval</span>
              <p className="text-[11px] text-app-muted-fg">Frequency of background TCP port & process discovery sweeps.</p>
            </div>
            <select
              value={defaultInterval}
              onChange={(e) => handleIntervalChange(parseInt(e.target.value, 10))}
              className="bg-app-input border border-app-border rounded-lg px-3 py-1.5 text-xs text-app-fg focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
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
              <span className="font-semibold text-app-fg">Safety Confirmations</span>
              <p className="text-[11px] text-app-muted-fg">
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
              <div className="w-9 h-5 bg-app-muted border border-app-border peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </section>

      {/* 3. Host & Runtime Environment Information */}
      <section aria-labelledby="app-info-title" className="bg-app-surface border border-app-border rounded-xl p-5 space-y-3 shadow-xs">
        <h3 id="app-info-title" className="text-sm font-semibold text-app-fg flex items-center gap-2">
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
            className="text-blue-500"
          >
            <rect width="20" height="14" x="2" y="3" rx="2" />
            <line x1="8" x2="16" y1="21" y2="21" />
            <line x1="12" x2="12" y1="17" y2="21" />
          </svg>
          <span>Host Environment</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div className="flex justify-between py-1.5 border-b border-app-border">
            <span className="text-app-muted-fg">Operating System</span>
            <span className="font-mono font-semibold text-app-fg">
              {diagnostics?.platform ?? sysInfo?.platform ?? 'Windows'} ({diagnostics?.arch ?? 'x86_64'})
            </span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-app-border">
            <span className="text-app-muted-fg">Application Version</span>
            <span className="font-mono font-semibold text-app-fg">v{diagnostics?.appVersion ?? sysInfo?.version ?? '0.1.0'}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-app-border">
            <span className="text-app-muted-fg">Tauri Shell</span>
            <span className="font-mono text-blue-500">Tauri v{diagnostics?.tauriVersion ?? '2.0'}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-app-border">
            <span className="text-app-muted-fg">Native Core Backend</span>
            <span className="font-mono text-emerald-500 font-semibold">
              {diagnostics?.backend ?? sysInfo?.backend ?? 'Rust'}
            </span>
          </div>
        </div>
      </section>

      {/* 4. Optional Collapsible Diagnostics Section */}
      <section aria-labelledby="diagnostics-title" className="bg-app-surface border border-app-border rounded-xl overflow-hidden shadow-xs">
        <div className="p-5 flex items-center justify-between border-b border-app-border">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDiagnosticsOpen((prev) => !prev)}
              aria-expanded={diagnosticsOpen}
              className="flex items-center gap-2 text-left cursor-pointer focus:outline-hidden"
            >
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
                className={`text-app-muted-fg transition-transform ${diagnosticsOpen ? 'rotate-90' : ''}`}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <h3 id="diagnostics-title" className="text-sm font-semibold text-app-fg flex items-center gap-2">
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
                  className="text-purple-500"
                >
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
                <span>Diagnostics & Subsystem Telemetry</span>
              </h3>
            </button>
          </div>

          <button
            type="button"
            onClick={() => fetchDiagnostics(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-2 px-3 py-1 bg-app-muted hover:bg-app-surface-hover disabled:opacity-50 text-app-fg text-xs font-semibold rounded-lg border border-app-border transition-colors cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
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

        {diagnosticsOpen && (
          <div className="p-5 space-y-5 animate-in fade-in duration-150">
            {/* Persistence & Database */}
            <div className="bg-app-bg/50 border border-app-border rounded-lg p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-app-fg flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>SQLite 3 (Bundled C Engine)</span>
                </span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  {diagnostics?.databaseStatus ?? 'Healthy (SQLite WAL Mode)'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-app-border text-[11px] font-mono">
                <div>
                  <span className="text-app-muted-fg">Schema Version:</span>{' '}
                  <span className="text-app-fg font-semibold">Migration {diagnostics?.databaseSchemaVersion ?? 2}</span>
                </div>
                <div>
                  <span className="text-app-muted-fg">Profiles:</span>{' '}
                  <span className="text-app-fg font-semibold">{diagnostics?.profileCount ?? 0}</span>
                </div>
                <div>
                  <span className="text-app-muted-fg">Projects:</span>{' '}
                  <span className="text-app-fg font-semibold">{diagnostics?.projectCount ?? 0}</span>
                </div>
                <div>
                  <span className="text-app-muted-fg">Listening Ports:</span>{' '}
                  <span className="text-app-fg font-semibold">{diagnostics?.listeningPortsCount ?? 0}</span>
                </div>
              </div>
            </div>

            {/* WSL Subsystem */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-app-fg">WSL (Windows Subsystem for Linux) Subsystem</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    diagnostics?.wslAvailable
                      ? 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30'
                      : 'bg-app-muted text-app-muted-fg border border-app-border'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      diagnostics?.wslAvailable ? 'bg-purple-500 animate-pulse' : 'bg-app-muted-fg'
                    }`}
                  ></span>
                  <span>{diagnostics?.wslAvailable ? 'Active & Available' : 'Not Detected'}</span>
                </span>
              </div>

              {diagnostics?.wslDistributions && diagnostics.wslDistributions.length > 0 ? (
                <div className="border border-app-border rounded-lg overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-app-bg border-b border-app-border text-app-muted-fg font-medium">
                      <tr>
                        <th className="py-2 px-3">Distribution Name</th>
                        <th className="py-2 px-3">State</th>
                        <th className="py-2 px-3">WSL Version</th>
                        <th className="py-2 px-3">Default</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-app-border font-mono">
                      {diagnostics.wslDistributions.map((distro) => (
                        <tr key={distro.name} className="hover:bg-app-surface-hover">
                          <td className="py-2 px-3 text-app-fg font-semibold">{distro.name}</td>
                          <td className="py-2 px-3">
                            {distro.state === 'running' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                <span>Running</span>
                              </span>
                            ) : (
                              <span className="text-app-muted-fg">Stopped</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-app-muted-fg">v{distro.version}</td>
                          <td className="py-2 px-3">
                            {distro.isDefault ? (
                              <span className="px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-500 border border-blue-500/30 text-[10px]">
                                Default
                              </span>
                            ) : (
                              <span className="text-app-muted-fg">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-app-bg border border-app-border text-xs text-app-muted-fg">
                  No WSL distributions currently detected. Runara operates normally in Windows-only mode.
                </div>
              )}
            </div>

            {/* Safety Invariants */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-app-bg border border-app-border rounded-lg space-y-1">
                <span className="font-semibold text-app-fg">Win32 IP Helper API</span>
                <p className="text-[11px] text-app-muted-fg leading-relaxed">
                  Queries <code className="text-blue-500 font-mono">GetExtendedTcpTable</code> directly in kernel memory for sub-millisecond port enumeration without shell parsing overhead.
                </p>
              </div>

              <div className="p-3 bg-app-bg border border-app-border rounded-lg space-y-1">
                <span className="font-semibold text-app-fg">9-Point Process Verification</span>
                <p className="text-[11px] text-app-muted-fg leading-relaxed">
                  Mitigates TOCTOU and PID-reuse vulnerabilities by verifying process name, path, and CWD before any termination.
                </p>
              </div>

              <div className="p-3 bg-app-bg border border-app-border rounded-lg space-y-1">
                <span className="font-semibold text-app-fg">Ancestor Protection Rule</span>
                <p className="text-[11px] text-app-muted-fg leading-relaxed">
                  Prevents accidental termination of parent shells (PowerShell, CMD, Bash) and IDEs (VS Code, Cursor).
                </p>
              </div>

              <div className="p-3 bg-app-bg border border-app-border rounded-lg space-y-1">
                <span className="font-semibold text-app-fg">Environment Isolation</span>
                <p className="text-[11px] text-app-muted-fg leading-relaxed">
                  Composite <code className="text-purple-500 font-mono">(Environment, PID)</code> keys ensure zero cross-environment PID or port collisions.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* About Box */}
      <div className="bg-app-surface/50 border border-app-border rounded-xl p-5 text-xs text-app-muted-fg space-y-2">
        <h4 className="font-semibold text-app-fg">Runara MVP Release (v0.1.0)</h4>
        <p className="leading-relaxed">
          Runara is a native Windows desktop application for managing local development servers across Windows and WSL. Built with Rust, Tauri 2, React 19, TypeScript, and SQLite.
        </p>
        <div className="pt-2 flex flex-wrap gap-4 text-xs font-mono text-app-muted-fg">
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
