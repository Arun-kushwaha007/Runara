import { describe, it, expect } from 'vitest';
import {
  normalizePath,
  isProfileMatch,
  associateServerWithProfile,
} from './profileAssociation';
import type { DashboardServer } from '../types/server';
import type { ServerProfile } from '../types/profile';

// ─── Minimal fixtures ────────────────────────────────────────────────────────

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
    commandLine: 'node server.js',
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

function makeProfile(overrides: Partial<ServerProfile> = {}): ServerProfile {
  return {
    id: 'prof-1',
    name: 'Company Frontend',
    description: null,
    environment: { type: 'windows' },
    workingDirectory: 'C:\\Projects\\frontend',
    command: 'npm run dev',
    expectedPort: 3000,
    expectedHost: null,
    enabled: true,
    createdAt: '2026-08-22T20:00:00Z',
    updatedAt: '2026-08-22T20:00:00Z',
    ...overrides,
  };
}

// ─── normalizePath ────────────────────────────────────────────────────────────

describe('normalizePath', () => {
  it('converts backslashes to forward slashes', () => {
    expect(normalizePath('C:\\Projects\\Frontend')).toBe('c:/projects/frontend');
  });

  it('lowercases the path', () => {
    expect(normalizePath('/Home/Dev/API')).toBe('/home/dev/api');
  });

  it('trims trailing slashes', () => {
    expect(normalizePath('/home/dev/api/')).toBe('/home/dev/api');
    expect(normalizePath('C:\\Projects\\')).toBe('c:/projects');
  });

  it('handles already-normalized paths', () => {
    expect(normalizePath('c:/projects/frontend')).toBe('c:/projects/frontend');
  });
});

// ─── isProfileMatch ───────────────────────────────────────────────────────────

describe('isProfileMatch', () => {
  it('matches Windows server to Windows profile by port + directory', () => {
    const server = makeServer();
    const profile = makeProfile();
    expect(isProfileMatch(server, profile)).toBe(true);
  });

  it('does not match when directory differs', () => {
    const server = makeServer({ workingDirectory: 'C:\\Projects\\backend' });
    const profile = makeProfile({ workingDirectory: 'C:\\Projects\\frontend' });
    expect(isProfileMatch(server, profile)).toBe(false);
  });

  it('does not match when port differs (profile expects 3000, server on 3001)', () => {
    const server = makeServer({ primaryPort: 3001, allPorts: [3001] });
    const profile = makeProfile({ expectedPort: 3000 });
    expect(isProfileMatch(server, profile)).toBe(false);
  });

  it('does not match when environment types differ', () => {
    const server = makeServer({
      environment: { type: 'wsl', distro: 'Ubuntu' },
      wslDistro: 'Ubuntu',
    });
    const profile = makeProfile({ environment: { type: 'windows' } });
    expect(isProfileMatch(server, profile)).toBe(false);
  });

  it('does not match WSL server to WSL profile with different distro', () => {
    const server = makeServer({
      environment: { type: 'wsl', distro: 'Ubuntu' },
      wslDistro: 'Ubuntu',
    });
    const profile = makeProfile({ environment: { type: 'wsl', distro: 'Fedora' } });
    expect(isProfileMatch(server, profile)).toBe(false);
  });

  it('matches WSL server to WSL profile with same distro', () => {
    const server = makeServer({
      environment: { type: 'wsl', distro: 'Fedora' },
      wslDistro: 'Fedora',
      workingDirectory: '/home/dev/api',
      primaryPort: 5000,
      allPorts: [5000],
    });
    const profile = makeProfile({
      environment: { type: 'wsl', distro: 'Fedora' },
      workingDirectory: '/home/dev/api',
      expectedPort: 5000,
    });
    expect(isProfileMatch(server, profile)).toBe(true);
  });

  it('matches when profile has no expectedPort (directory-only match)', () => {
    const server = makeServer({ primaryPort: 9999, allPorts: [9999] });
    const profile = makeProfile({ expectedPort: null });
    expect(isProfileMatch(server, profile)).toBe(true);
  });

  it('matches when server listens on multiple ports including expectedPort', () => {
    const server = makeServer({ primaryPort: 3000, allPorts: [3000, 5173] });
    const profile = makeProfile({ expectedPort: 5173 });
    expect(isProfileMatch(server, profile)).toBe(true);
  });

  it('does not match when same command but different directories', () => {
    const server = makeServer({ workingDirectory: 'C:\\Projects\\backend' });
    const profile = makeProfile({ workingDirectory: 'C:\\Projects\\frontend', expectedPort: null });
    expect(isProfileMatch(server, profile)).toBe(false);
  });

  it('normalizes path comparison (backslash vs forward slash)', () => {
    const server = makeServer({ workingDirectory: 'C:/Projects/Frontend' });
    const profile = makeProfile({ workingDirectory: 'C:\\Projects\\frontend' });
    expect(isProfileMatch(server, profile)).toBe(true);
  });
});

// ─── associateServerWithProfile ───────────────────────────────────────────────

describe('associateServerWithProfile', () => {
  it('returns unmanaged when no profiles', () => {
    const result = associateServerWithProfile(makeServer(), []);
    expect(result).toEqual({ managed: false });
  });

  it('returns managed with profileId when exactly one profile matches', () => {
    const server = makeServer();
    const profile = makeProfile({ id: 'prof-abc' });
    const result = associateServerWithProfile(server, [profile]);
    expect(result).toEqual({ managed: true, profileId: 'prof-abc' });
  });

  it('returns unmanaged when no profile matches', () => {
    const server = makeServer({ workingDirectory: 'C:\\Projects\\backend' });
    const profile = makeProfile({ workingDirectory: 'C:\\Projects\\frontend' });
    const result = associateServerWithProfile(server, [profile]);
    expect(result).toEqual({ managed: false });
  });

  it('returns ambiguous when multiple profiles match', () => {
    const server = makeServer({ allPorts: [3000, 3001], primaryPort: 3000 });
    // Both profiles match: same dir, no port constraint
    const profileA = makeProfile({ id: 'prof-A', expectedPort: null });
    const profileB = makeProfile({ id: 'prof-B', expectedPort: null });
    const result = associateServerWithProfile(server, [profileA, profileB]);
    expect(result.managed).toBe(false);
    expect(result.ambiguous).toBe(true);
    expect(result.candidateIds).toContain('prof-A');
    expect(result.candidateIds).toContain('prof-B');
  });

  it('disambiguates two profiles with same dir by port', () => {
    const server = makeServer({ primaryPort: 3001, allPorts: [3001] });
    const profileA = makeProfile({ id: 'prof-A', expectedPort: 3000 }); // port mismatch
    const profileB = makeProfile({ id: 'prof-B', expectedPort: 3001 }); // port matches
    const result = associateServerWithProfile(server, [profileA, profileB]);
    expect(result).toEqual({ managed: true, profileId: 'prof-B' });
  });

  it('does not associate WSL Ubuntu server with WSL Fedora profile', () => {
    const server = makeServer({
      environment: { type: 'wsl', distro: 'Ubuntu' },
      wslDistro: 'Ubuntu',
    });
    const profile = makeProfile({ environment: { type: 'wsl', distro: 'Fedora' } });
    const result = associateServerWithProfile(server, [profile]);
    expect(result).toEqual({ managed: false });
  });

  it('does not associate when only port matches but directory does not', () => {
    const server = makeServer({ workingDirectory: 'C:\\Projects\\backend', allPorts: [3000] });
    const profile = makeProfile({ workingDirectory: 'C:\\Projects\\frontend', expectedPort: 3000 });
    const result = associateServerWithProfile(server, [profile]);
    expect(result).toEqual({ managed: false });
  });
});
