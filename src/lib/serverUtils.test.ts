import { describe, it, expect } from 'vitest';
import {
  deriveServerName,
  getBrowserUrl,
  deriveDashboardServers,
  filterServers,
  sortServers,
} from './serverUtils';
import type { PortInfo, ProcessIdentity, DashboardServer } from '../types';

describe('serverUtils', () => {
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
      },
    ];

    const mockPorts: PortInfo[] = [
      {
        port: 3000,
        pid: 18240,
        protocol: 'tcp',
        address: '127.0.0.1',
        state: 'listening',
      },
      {
        port: 3001,
        pid: 18240,
        protocol: 'tcp',
        address: '127.0.0.1',
        state: 'listening',
      },
      {
        port: 8080,
        pid: 9999, // Unmatched PID
        protocol: 'tcp',
        address: '0.0.0.0',
        state: 'listening',
      },
    ];

    it('groups multi-port processes into a single cohesive DashboardServer', () => {
      const servers = deriveDashboardServers(mockPorts, mockIdentities);

      expect(servers.length).toBe(2);

      const nodeServer = servers.find((s) => s.pid === 18240);
      expect(nodeServer).toBeDefined();
      expect(nodeServer?.name).toBe('company-frontend');
      expect(nodeServer?.runtime).toBe('Node.js');
      expect(nodeServer?.packageManager).toBe('npm');
      expect(nodeServer?.primaryPort).toBe(3000);
      expect(nodeServer?.allPorts).toEqual([3000, 3001]);
      expect(nodeServer?.environment).toBe('windows');
      expect(nodeServer?.workingDirectory).toBe('C:\\Projects\\company-frontend');
      expect(nodeServer?.processTree.length).toBe(3);
    });

    it('handles unmatched or restricted ports gracefully', () => {
      const servers = deriveDashboardServers(mockPorts, mockIdentities);
      const unmatched = servers.find((s) => s.pid === 9999);

      expect(unmatched).toBeDefined();
      expect(unmatched?.name).toBe('Port 8080 (PID 9999)');
      expect(unmatched?.runtime).toBe('Unknown');
      expect(unmatched?.status).toBe('running');
      expect(unmatched?.primaryPort).toBe(8080);
    });
  });

  describe('filterServers and sortServers', () => {
    const servers: DashboardServer[] = [
      {
        id: 'win-1-3000',
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
        environment: 'windows',
      },
      {
        id: 'win-2-8000',
        name: 'Beta Backend',
        status: 'running',
        primaryPort: 8000,
        allPorts: [8000],
        address: '0.0.0.0',
        protocol: 'tcp',
        pid: 200,
        processName: 'python.exe',
        executablePath: null,
        commandLine: 'python -m uvicorn main:app',
        workingDirectory: 'C:\\Projects\\beta',
        runtime: 'Python',
        packageManager: 'Unknown',
        parent: null,
        processTree: [],
        environment: 'windows',
      },
    ];

    it('filters by search query across multiple fields', () => {
      // By port
      expect(filterServers(servers, '3000', { environment: 'all', runtime: 'all', status: 'all' })).toHaveLength(1);
      // By runtime
      expect(filterServers(servers, 'python', { environment: 'all', runtime: 'all', status: 'all' })).toHaveLength(1);
      // By CWD
      expect(filterServers(servers, 'beta', { environment: 'all', runtime: 'all', status: 'all' })).toHaveLength(1);
      // By command
      expect(filterServers(servers, 'uvicorn', { environment: 'all', runtime: 'all', status: 'all' })).toHaveLength(1);
      // Non-matching
      expect(filterServers(servers, 'nonexistent', { environment: 'all', runtime: 'all', status: 'all' })).toHaveLength(0);
    });

    it('filters by runtime dropdown', () => {
      expect(filterServers(servers, '', { environment: 'all', runtime: 'Node.js', status: 'all' })).toHaveLength(1);
      expect(filterServers(servers, '', { environment: 'all', runtime: 'Go', status: 'all' })).toHaveLength(0);
    });

    it('sorts correctly by port, pid, name, runtime in both directions', () => {
      const sortedByPortDesc = sortServers(servers, 'port', 'desc');
      expect(sortedByPortDesc[0].primaryPort).toBe(8000);

      const sortedByNameAsc = sortServers(servers, 'name', 'asc');
      expect(sortedByNameAsc[0].name).toBe('Alpha Frontend');

      const sortedByPidDesc = sortServers(servers, 'pid', 'desc');
      expect(sortedByPidDesc[0].pid).toBe(200);
    });
  });
});
