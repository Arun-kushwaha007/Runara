import { describe, it, expect } from 'vitest';
import {
  inferStartCommand,
  inferExpectedPort,
  inferExpectedHost,
  buildAdoptionDraft,
} from './adoptionDraft';
import type { DashboardServer } from '../types/server';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeServer(overrides: Partial<DashboardServer> = {}): DashboardServer {
  return {
    id: 'win-18240-3000',
    name: 'test-server',
    status: 'running',
    primaryPort: 3000,
    allPorts: [3000],
    address: '127.0.0.1',
    protocol: 'tcp',
    pid: 18240,
    processName: 'node.exe',
    executablePath: null,
    commandLine: 'npm run dev',
    workingDirectory: 'C:\\Projects\\frontend',
    runtime: 'Node.js',
    packageManager: 'npm',
    parent: null,
    processTree: [],
    environment: { type: 'windows' },
    environmentLabel: 'Windows',
    wslDistro: null,
    managed: false,
    ...overrides,
  };
}

// ─── inferStartCommand ────────────────────────────────────────────────────────

describe('inferStartCommand', () => {
  it('returns empty string for null command', () => {
    expect(inferStartCommand(null)).toBe('');
  });

  it('returns empty string for blank command', () => {
    expect(inferStartCommand('   ')).toBe('');
  });

  it('preserves npm run dev verbatim', () => {
    expect(inferStartCommand('npm run dev')).toBe('npm run dev');
  });

  it('preserves cargo run verbatim', () => {
    expect(inferStartCommand('cargo run')).toBe('cargo run');
  });

  it('preserves python -m uvicorn verbatim', () => {
    expect(inferStartCommand('python -m uvicorn main:app --reload')).toBe(
      'python -m uvicorn main:app --reload'
    );
  });

  it('preserves npx commands verbatim', () => {
    expect(inferStartCommand('npx vite')).toBe('npx vite');
  });

  it('strips cmd.exe /c wrapper', () => {
    expect(inferStartCommand('cmd.exe /c npm run dev')).toBe('npm run dev');
  });

  it('strips cmd.exe /C wrapper (case insensitive)', () => {
    expect(inferStartCommand('cmd.exe /C yarn dev')).toBe('yarn dev');
  });

  it('strips powershell.exe -Command wrapper', () => {
    expect(inferStartCommand('powershell.exe -Command npm run dev')).toBe('npm run dev');
  });

  it('strips bash -lc wrapper', () => {
    expect(inferStartCommand('bash -lc "python -m uvicorn main:app"')).toBe(
      'python -m uvicorn main:app'
    );
  });

  it('keeps raw node.exe command verbatim', () => {
    expect(inferStartCommand('node.exe server.js')).toBe('node.exe server.js');
  });

  it('keeps unknown commands verbatim', () => {
    expect(inferStartCommand('custom-daemon --port 3000')).toBe('custom-daemon --port 3000');
  });

  it('preserves go run verbatim', () => {
    expect(inferStartCommand('go run main.go')).toBe('go run main.go');
  });

  it('preserves dotnet run verbatim', () => {
    expect(inferStartCommand('dotnet run')).toBe('dotnet run');
  });
});

// ─── inferExpectedPort ────────────────────────────────────────────────────────

describe('inferExpectedPort', () => {
  it('returns the single port when only one port is detected', () => {
    expect(inferExpectedPort([3000])).toBe(3000);
  });

  it('returns undefined for multiple ports (user must choose)', () => {
    expect(inferExpectedPort([3000, 5173])).toBeUndefined();
    expect(inferExpectedPort([3000, 5173, 8080])).toBeUndefined();
  });

  it('returns undefined when no ports', () => {
    expect(inferExpectedPort([])).toBeUndefined();
  });
});

// ─── inferExpectedHost ────────────────────────────────────────────────────────

describe('inferExpectedHost', () => {
  it('returns empty string for 0.0.0.0 (wildcard)', () => {
    expect(inferExpectedHost('0.0.0.0')).toBe('');
  });

  it('returns empty string for :: (IPv6 wildcard)', () => {
    expect(inferExpectedHost('::')).toBe('');
  });

  it('returns the host for specific addresses', () => {
    expect(inferExpectedHost('127.0.0.1')).toBe('127.0.0.1');
    expect(inferExpectedHost('192.168.1.5')).toBe('192.168.1.5');
  });

  it('returns empty string for empty address', () => {
    expect(inferExpectedHost('')).toBe('');
  });
});

// ─── buildAdoptionDraft ───────────────────────────────────────────────────────

describe('buildAdoptionDraft', () => {
  it('builds a draft with correct sourceServerId', () => {
    const server = makeServer({ id: 'win-18240-3000' });
    const draft = buildAdoptionDraft(server);
    expect(draft.sourceServerId).toBe('win-18240-3000');
  });

  it('derives name from workingDirectory', () => {
    const server = makeServer({ workingDirectory: 'C:\\Projects\\company-frontend' });
    const draft = buildAdoptionDraft(server);
    expect(draft.name).toBe('company-frontend');
  });

  it('uses process name as fallback name when no directory and unknown runtime', () => {
    const server = makeServer({ workingDirectory: null, commandLine: null, runtime: 'Unknown' });
    const draft = buildAdoptionDraft(server);
    expect(draft.name).toBe('node.exe');
  });

  it('preserves environment from the server', () => {
    const server = makeServer({ environment: { type: 'wsl', distro: 'Ubuntu' } });
    const draft = buildAdoptionDraft(server);
    expect(draft.environment).toEqual({ type: 'wsl', distro: 'Ubuntu' });
  });

  it('sets workingDirectory from server', () => {
    const server = makeServer({ workingDirectory: 'C:\\Projects\\frontend' });
    const draft = buildAdoptionDraft(server);
    expect(draft.workingDirectory).toBe('C:\\Projects\\frontend');
  });

  it('uses empty string when workingDirectory is null', () => {
    const server = makeServer({ workingDirectory: null });
    const draft = buildAdoptionDraft(server);
    expect(draft.workingDirectory).toBe('');
  });

  it('sets expectedPort for single-port server', () => {
    const server = makeServer({ allPorts: [3000] });
    const draft = buildAdoptionDraft(server);
    expect(draft.expectedPort).toBe(3000);
  });

  it('leaves expectedPort undefined for multi-port server', () => {
    const server = makeServer({ allPorts: [3000, 5173] });
    const draft = buildAdoptionDraft(server);
    expect(draft.expectedPort).toBeUndefined();
  });

  it('sets allDetectedPorts from server', () => {
    const server = makeServer({ allPorts: [3000, 5173] });
    const draft = buildAdoptionDraft(server);
    expect(draft.allDetectedPorts).toEqual([3000, 5173]);
  });

  it('normalizes 0.0.0.0 host to undefined (empty host)', () => {
    const server = makeServer({ address: '0.0.0.0' });
    const draft = buildAdoptionDraft(server);
    expect(draft.expectedHost).toBeUndefined();
  });

  it('preserves specific host addresses', () => {
    const server = makeServer({ address: '127.0.0.1' });
    const draft = buildAdoptionDraft(server);
    expect(draft.expectedHost).toBe('127.0.0.1');
  });

  it('strips cmd.exe wrapper from command line', () => {
    const server = makeServer({ commandLine: 'cmd.exe /c npm run dev' });
    const draft = buildAdoptionDraft(server);
    expect(draft.command).toBe('npm run dev');
  });

  it('uses empty command when commandLine is null', () => {
    const server = makeServer({ commandLine: null });
    const draft = buildAdoptionDraft(server);
    expect(draft.command).toBe('');
  });
});
