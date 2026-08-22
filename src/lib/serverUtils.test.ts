import { describe, it, expect } from 'vitest';
import {
  deriveServerName,
  getBrowserUrl,
  deriveDashboardServers,
  filterServers,
  sortServers,
  annotateWithProfiles,
  getProcessEnvironmentKey,
  formatEnvironmentLabel,
} from './serverUtils';
import type { PortInfo, ProcessIdentity, DashboardServer, ServerProfile } from '../types';

describe('serverUtils', () => {
  describe('environment helpers', () => {
    it('generates consistent environment composite keys', () => {
      expect(getProcessEnvironmentKey({ type: 'windows' }, 18240)).toBe('windows:18240');
      expect(getProcessEnvironmentKey({ type: 'wsl', distro: 'Ubuntu' }, 421)).toBe('wsl:Ubuntu:421');
      expect(getProcessEnvironmentKey({ type: 'wsl', distro: 'Fedora' }, 421)).toBe('wsl:Fedora:421');
    });

    it('formats human-readable environment labels', () => {
      expect(formatEnvironmentLabel({ type: 'windows' })).toBe('Windows');
      expect(formatEnvironmentLabel({ type: 'wsl', distro: 'Ubuntu' })).toBe('WSL / Ubuntu');
      expect(formatEnvironmentLabel({ type: 'wsl', distro: 'Fedora' })).toBe('WSL / Fedora');
    });
  });

  describe('deriveServerName', () => {
    it('extracts workspace directory folder name as primary name', () => {
      expect(
        deriveServerName('C:\\Projects\\company-frontend', 'npm run dev', 'Node.js', 'node.exe')
      ).toBe('company-frontend');

      expect(
        deriveServerName('/home/developer/repos/api-service', 'python main.py', 'Python', 'python')
      ).toBe('api-service');
    });

    it('ignores bare drive roots and falls back to runtime/command', () => {
      expect(
        deriveServerName('C:\\', 'npm run dev', 'Node.js', 'node.exe')
      ).toBe('Node.js Development Server');

      expect(
        deriveServerName('D:/', 'python -m uvicorn', 'Python', 'python.exe')
      ).toBe('Python Development Server');
    });

    it('falls back to runtime when directory is unavailable', () => {
      expect(
        deriveServerName(null, 'npm run dev', 'Node.js', 'node.exe')
      ).toBe('Node.js Development Server');

      expect(
        deriveServerName(undefined, 'python app.py', 'Python', 'python.exe')
      ).toBe('Python Development Server');
    });

    it('falls back to command tokens when runtime is Unknown', () => {
      expect(
        deriveServerName(null, 'vite --port 3000', 'Unknown', 'custom.exe')
      ).toBe('vite --port 3000');
    });

    it('falls back to process name when directory and command are unavailable', () => {
      expect(
        deriveServerName(null, null, 'Unknown', 'custom_daemon.exe')
      ).toBe('custom_daemon.exe');
    });
  });

  describe('getBrowserUrl', () => {
    it('normalizes loopback and wildcard interfaces to localhost', () => {
      expect(getBrowserUrl('0.0.0.0', 3000)).toBe('http://localhost:3000');
      expect(getBrowserUrl('127.0.0.1', 5173)).toBe('http://localhost:5173');
      expect(getBrowserUrl('localhost', 8080)).toBe('http://localhost:8080');
      expect(getBrowserUrl('[::1]', 4000)).toBe('http://localhost:4000');
      expect(getBrowserUrl('::', 5000)).toBe('http://localhost:5000');
    });

    it('preserves specific LAN IP addresses', () => {
      expect(getBrowserUrl('192.168.1.100', 3000)).toBe('http://192.168.1.100:3000');
    });
  });

  describe('deriveDashboardServers', () => {
    const mockIdentities: ProcessIdentity[] = [
      {
        process: {
          pid: 18240,
          parentPid: 17820,
          name: 'node.exe',
          executablePath: 'C:\\Program Files\\nodejs\\node.exe',
          commandLine: 'npm run dev',
          workingDirectory: 'C:\\Projects\\company-frontend',
          status: 'running',
          environment: { type: 'windows' },
        },
        runtime: 'Node.js',
        packageManager: 'npm',
        parent: {
          pid: 17820,
          name: 'npm.cmd',
          commandLine: 'npm run dev',
        },
        processTree: [
          { pid: 17120, name: 'powershell.exe', commandLine: null, isTarget: false, depth: 0 },
          { pid: 17820, name: 'npm.cmd', commandLine: 'npm run dev', isTarget: false, depth: 1 },
          { pid: 18240, name: 'node.exe', commandLine: 'npm run dev', isTarget: true, depth: 2 },
        ],
        listeningPorts: [3000, 3001],
        environment: { type: 'windows' },
      },
      {
        process: {
          pid: 421,
          parentPid: 300,
          name: 'node',
          executablePath: '/usr/bin/node',
          commandLine: 'node server.js',
          workingDirectory: '/home/developer/wsl-api',
          status: 'running',
          environment: { type: 'wsl', distro: 'Ubuntu' },
        },
        runtime: 'Node.js',
        packageManager: 'npm',
        parent: {
          pid: 300,
          name: 'bash',
          commandLine: '-bash',
        },
        processTree: [
          { pid: 300, name: 'bash', commandLine: '-bash', isTarget: false, depth: 0 },
          { pid: 421, name: 'node', commandLine: 'node server.js', isTarget: true, depth: 1 },
        ],
        listeningPorts: [5000],
        environment: { type: 'wsl', distro: 'Ubuntu' },
      },
    ];

    const mockPorts: PortInfo[] = [
      {
        port: 3000,
        pid: 18240,
        protocol: 'tcp',
        address: '127.0.0.1',
        state: 'listening',
        environment: { type: 'windows' },
      },
      {
        port: 3001,
        pid: 18240,
        protocol: 'tcp',
        address: '127.0.0.1',
        state: 'listening',
        environment: { type: 'windows' },
      },
      {
        port: 5000,
        pid: 421,
        protocol: 'tcp',
        address: '0.0.0.0',
        state: 'listening',
        environment: { type: 'wsl', distro: 'Ubuntu' },
      },
      {
        port: 8080,
        pid: 9999, // Unmatched PID on Windows
        protocol: 'tcp',
        address: '0.0.0.0',
        state: 'listening',
        environment: { type: 'windows' },
      },
    ];

    it('groups multi-port processes and distinguishes Windows from WSL', () => {
      const servers = deriveDashboardServers(mockPorts, mockIdentities);

      expect(servers.length).toBe(3);

      const winServer = servers.find((s) => s.id === 'win-18240-3000');
      expect(winServer).toBeDefined();
      expect(winServer?.name).toBe('company-frontend');
      expect(winServer?.runtime).toBe('Node.js');
      expect(winServer?.packageManager).toBe('npm');
      expect(winServer?.primaryPort).toBe(3000);
      expect(winServer?.allPorts).toEqual([3000, 3001]);
      expect(winServer?.environment).toEqual({ type: 'windows' });
      expect(winServer?.environmentLabel).toBe('Windows');
      expect(winServer?.wslDistro).toBeNull();
      expect(winServer?.workingDirectory).toBe('C:\\Projects\\company-frontend');

      const wslServer = servers.find((s) => s.id === 'wsl-Ubuntu-421-5000');
      expect(wslServer).toBeDefined();
      expect(wslServer?.name).toBe('wsl-api');
      expect(wslServer?.runtime).toBe('Node.js');
      expect(wslServer?.primaryPort).toBe(5000);
      expect(wslServer?.environment).toEqual({ type: 'wsl', distro: 'Ubuntu' });
      expect(wslServer?.environmentLabel).toBe('WSL / Ubuntu');
      expect(wslServer?.wslDistro).toBe('Ubuntu');
      expect(wslServer?.workingDirectory).toBe('/home/developer/wsl-api');
    });

    it('handles cross-environment PID collisions correctly without conflation', () => {
      // Windows PID 421 and WSL Ubuntu PID 421
      const winId: ProcessIdentity = {
        process: {
          pid: 421,
          parentPid: null,
          name: 'win_service.exe',
          executablePath: 'C:\\win_service.exe',
          commandLine: null,
          workingDirectory: 'C:\\win_service',
          status: 'running',
          environment: { type: 'windows' },
        },
        runtime: 'Unknown',
        packageManager: 'Unknown',
        parent: null,
        processTree: [{ pid: 421, name: 'win_service.exe', commandLine: null, isTarget: true, depth: 0 }],
        listeningPorts: [8080],
        environment: { type: 'windows' },
      };

      const wslId: ProcessIdentity = {
        process: {
          pid: 421,
          parentPid: null,
          name: 'python3',
          executablePath: '/usr/bin/python3',
          commandLine: 'python3 -m http.server 8000',
          workingDirectory: '/home/user/docs',
          status: 'running',
          environment: { type: 'wsl', distro: 'Ubuntu' },
        },
        runtime: 'Python',
        packageManager: 'Unknown',
        parent: null,
        processTree: [{ pid: 421, name: 'python3', commandLine: null, isTarget: true, depth: 0 }],
        listeningPorts: [8000],
        environment: { type: 'wsl', distro: 'Ubuntu' },
      };

      const collidingPorts: PortInfo[] = [
        {
          port: 8080,
          pid: 421,
          protocol: 'tcp',
          address: '127.0.0.1',
          state: 'listening',
          environment: { type: 'windows' },
        },
        {
          port: 8000,
          pid: 421,
          protocol: 'tcp',
          address: '0.0.0.0',
          state: 'listening',
          environment: { type: 'wsl', distro: 'Ubuntu' },
        },
      ];

      const servers = deriveDashboardServers(collidingPorts, [winId, wslId]);
      expect(servers.length).toBe(2);

      const winServer = servers.find((s) => s.environment.type === 'windows');
      const wslServer = servers.find((s) => s.environment.type === 'wsl');

      expect(winServer?.pid).toBe(421);
      expect(winServer?.primaryPort).toBe(8080);
      expect(winServer?.id).toBe('win-421-8080');

      expect(wslServer?.pid).toBe(421);
      expect(wslServer?.primaryPort).toBe(8000);
      expect(wslServer?.id).toBe('wsl-Ubuntu-421-8000');
    });

    it('handles unmatched or restricted ports gracefully', () => {
      const servers = deriveDashboardServers(mockPorts, mockIdentities);
      const unmatched = servers.find((s) => s.pid === 9999);

      expect(unmatched).toBeDefined();
      expect(unmatched?.name).toBe('Port 8080 (PID 9999)');
      expect(unmatched?.runtime).toBe('Unknown');
      expect(unmatched?.status).toBe('running');
      expect(unmatched?.primaryPort).toBe(8080);
      expect(unmatched?.environmentLabel).toBe('Windows');
    });
  });

  describe('filterServers and sortServers', () => {
    const servers: DashboardServer[] = [
      {
        id: 'win-100-3000',
        name: 'Alpha Frontend',
        status: 'running',
        primaryPort: 3000,
        allPorts: [3000],
        address: '127.0.0.1',
        protocol: 'tcp',
        pid: 100,
        processName: 'node.exe',
        executablePath: null,
        commandLine: 'npm run dev',
        workingDirectory: 'C:\\Projects\\alpha',
        runtime: 'Node.js',
        packageManager: 'npm',
        parent: null,
        processTree: [],
        environment: { type: 'windows' },
        environmentLabel: 'Windows',
        wslDistro: null,
        managed: false,
      },
      {
        id: 'wsl-Ubuntu-200-8000',
        name: 'Beta Backend',
        status: 'running',
        primaryPort: 8000,
        allPorts: [8000],
        address: '0.0.0.0',
        protocol: 'tcp',
        pid: 200,
        processName: 'python3',
        executablePath: null,
        commandLine: 'python3 -m uvicorn main:app',
        workingDirectory: '/home/dev/beta',
        runtime: 'Python',
        packageManager: 'Unknown',
        parent: null,
        processTree: [],
        environment: { type: 'wsl', distro: 'Ubuntu' },
        environmentLabel: 'WSL / Ubuntu',
        wslDistro: 'Ubuntu',
        managed: false,
      },
      {
        id: 'wsl-Fedora-300-9000',
        name: 'Gamma Go Microservice',
        status: 'running',
        primaryPort: 9000,
        allPorts: [9000],
        address: '127.0.0.1',
        protocol: 'tcp',
        pid: 300,
        processName: 'gamma',
        executablePath: null,
        commandLine: './gamma',
        workingDirectory: '/home/fedora/gamma',
        runtime: 'Go',
        packageManager: 'Unknown',
        parent: null,
        processTree: [],
        environment: { type: 'wsl', distro: 'Fedora' },
        environmentLabel: 'WSL / Fedora',
        wslDistro: 'Fedora',
        managed: false,
      },
    ];

    it('filters by search query across multiple fields including distro and environment', () => {
      // By port
      expect(filterServers(servers, '3000', { environment: 'all', runtime: 'all', status: 'all' })).toHaveLength(1);
      // By runtime
      expect(filterServers(servers, 'python', { environment: 'all', runtime: 'all', status: 'all' })).toHaveLength(1);
      // By CWD
      expect(filterServers(servers, 'beta', { environment: 'all', runtime: 'all', status: 'all' })).toHaveLength(1);
      // By WSL distro name
      expect(filterServers(servers, 'ubuntu', { environment: 'all', runtime: 'all', status: 'all' })).toHaveLength(1);
      expect(filterServers(servers, 'fedora', { environment: 'all', runtime: 'all', status: 'all' })).toHaveLength(1);
      // By environment generic keyword
      expect(filterServers(servers, 'wsl', { environment: 'all', runtime: 'all', status: 'all' })).toHaveLength(2);
      expect(filterServers(servers, 'windows', { environment: 'all', runtime: 'all', status: 'all' })).toHaveLength(1);
      // Non-matching
      expect(filterServers(servers, 'nonexistent', { environment: 'all', runtime: 'all', status: 'all' })).toHaveLength(0);
    });

    it('filters by environment filter option (all, windows, wsl, wsl:<distro>)', () => {
      expect(filterServers(servers, '', { environment: 'all', runtime: 'all', status: 'all' })).toHaveLength(3);
      expect(filterServers(servers, '', { environment: 'windows', runtime: 'all', status: 'all' })).toHaveLength(1);
      expect(filterServers(servers, '', { environment: 'wsl', runtime: 'all', status: 'all' })).toHaveLength(2);
      expect(filterServers(servers, '', { environment: 'wsl:Ubuntu', runtime: 'all', status: 'all' })).toHaveLength(1);
      expect(filterServers(servers, '', { environment: 'wsl:Fedora', runtime: 'all', status: 'all' })).toHaveLength(1);
      expect(filterServers(servers, '', { environment: 'wsl:Debian', runtime: 'all', status: 'all' })).toHaveLength(0);
    });

    it('filters by runtime dropdown', () => {
      expect(filterServers(servers, '', { environment: 'all', runtime: 'Node.js', status: 'all' })).toHaveLength(1);
      expect(filterServers(servers, '', { environment: 'all', runtime: 'Go', status: 'all' })).toHaveLength(1);
      expect(filterServers(servers, '', { environment: 'all', runtime: 'Rust', status: 'all' })).toHaveLength(0);
    });

    it('filters by managedStatus filter (all, managed, unmanaged)', () => {
      const mixedServers: DashboardServer[] = [
        { ...servers[0], managed: true, profileId: 'prof-1' },
        { ...servers[1], managed: false },
        { ...servers[2], managed: false },
      ];

      expect(
        filterServers(mixedServers, '', {
          environment: 'all',
          runtime: 'all',
          status: 'all',
          managedStatus: 'all',
        })
      ).toHaveLength(3);

      expect(
        filterServers(mixedServers, '', {
          environment: 'all',
          runtime: 'all',
          status: 'all',
          managedStatus: 'managed',
        })
      ).toHaveLength(1);

      expect(
        filterServers(mixedServers, '', {
          environment: 'all',
          runtime: 'all',
          status: 'all',
          managedStatus: 'unmanaged',
        })
      ).toHaveLength(2);
    });

    it('sorts correctly by port, pid, name, runtime, and environment in both directions', () => {
      const sortedByPortDesc = sortServers(servers, 'port', 'desc');
      expect(sortedByPortDesc[0].primaryPort).toBe(9000);

      const sortedByNameAsc = sortServers(servers, 'name', 'asc');
      expect(sortedByNameAsc[0].name).toBe('Alpha Frontend');

      const sortedByPidDesc = sortServers(servers, 'pid', 'desc');
      expect(sortedByPidDesc[0].pid).toBe(300);

      const sortedByEnvAsc = sortServers(servers, 'environment', 'asc');
      expect(sortedByEnvAsc[0].environmentLabel).toBe('Windows');
      expect(sortedByEnvAsc[1].environmentLabel).toBe('WSL / Fedora');
      expect(sortedByEnvAsc[2].environmentLabel).toBe('WSL / Ubuntu');
    });
  });

  describe('annotateWithProfiles', () => {
    it('annotates servers with matching profile ids and sets managed true', () => {
      const rawServers: DashboardServer[] = [
        {
          id: 'win-100-3000',
          name: 'Alpha Frontend',
          status: 'running',
          primaryPort: 3000,
          allPorts: [3000],
          address: '127.0.0.1',
          protocol: 'tcp',
          pid: 100,
          processName: 'node.exe',
          executablePath: null,
          commandLine: 'npm run dev',
          workingDirectory: 'C:\\Projects\\alpha',
          runtime: 'Node.js',
          packageManager: 'npm',
          parent: null,
          processTree: [],
          environment: { type: 'windows' },
          environmentLabel: 'Windows',
          wslDistro: null,
          managed: false,
        },
      ];

      const profiles: ServerProfile[] = [
        {
          id: 'prof-alpha',
          name: 'Alpha Profile',
          description: null,
          environment: { type: 'windows' },
          workingDirectory: 'C:\\Projects\\alpha',
          command: 'npm run dev',
          expectedPort: 3000,
          expectedHost: null,
          enabled: true,
          createdAt: '2026-08-22T20:00:00Z',
          updatedAt: '2026-08-22T20:00:00Z',
        },
      ];

      const annotated = annotateWithProfiles(rawServers, profiles);
      expect(annotated[0].managed).toBe(true);
      expect(annotated[0].profileId).toBe('prof-alpha');
    });

    it('leaves unmanaged servers with managed false and undefined profileId', () => {
      const rawServers: DashboardServer[] = [
        {
          id: 'win-100-3000',
          name: 'Alpha Frontend',
          status: 'running',
          primaryPort: 3000,
          allPorts: [3000],
          address: '127.0.0.1',
          protocol: 'tcp',
          pid: 100,
          processName: 'node.exe',
          executablePath: null,
          commandLine: 'npm run dev',
          workingDirectory: 'C:\\Projects\\alpha',
          runtime: 'Node.js',
          packageManager: 'npm',
          parent: null,
          processTree: [],
          environment: { type: 'windows' },
          environmentLabel: 'Windows',
          wslDistro: null,
          managed: false,
        },
      ];

      const annotated = annotateWithProfiles(rawServers, []);
      expect(annotated[0].managed).toBe(false);
      expect(annotated[0].profileId).toBeUndefined();
    });
  });
});
