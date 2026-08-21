import type {
  PortInfo,
  ProcessIdentity,
  DashboardServer,
  ServerSortField,
  ServerSortDirection,
  ServerFilterOptions,
  Runtime,
} from '../types';

/**
 * Extracts a conservative, developer-friendly display name for a server.
 * Priority order:
 * 1. Working directory project folder name (e.g. "C:\Projects\company-frontend" -> "company-frontend")
 * 2. Command/runtime fallback (e.g. "Node.js Development Server")
 * 3. Process image name (e.g. "node.exe")
 */
export function deriveServerName(
  workingDirectory?: string | null,
  commandLine?: string | null,
  runtime?: Runtime | string | null,
  processName?: string | null
): string {
  // Priority 1: Working directory folder name
  if (workingDirectory && workingDirectory.trim()) {
    const normalized = workingDirectory.replace(/\\/g, '/').replace(/\/+$/, '');
    const segments = normalized.split('/').filter(Boolean);
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      // Exclude bare drive roots (e.g. "C:" or "D:")
      if (!lastSegment.endsWith(':') && lastSegment.length > 0) {
        return lastSegment;
      }
    }
  }

  // Priority 2: Runtime + command inference fallback
  if (runtime && runtime !== 'Unknown') {
    return `${runtime} Development Server`;
  }

  if (commandLine && commandLine.trim()) {
    const trimmed = commandLine.trim();
    // Return brief command preview if reasonable
    const firstTokens = trimmed.split(/\s+/).slice(0, 3).join(' ');
    if (firstTokens.length > 0 && firstTokens.length < 30) {
      return firstTokens;
    }
  }

  // Priority 3: Process name fallback
  if (processName && processName.trim()) {
    return processName;
  }

  return 'Unknown Server';
}

/**
 * Translates an IP address and port into a sensible browser URL.
 * Normalizes loopback and wildcard interfaces (0.0.0.0, 127.0.0.1, [::1], [::]) to localhost.
 */
export function getBrowserUrl(address: string, port: number): string {
  const cleanAddr = address.replace(/^\[|\]$/g, '').trim().toLowerCase();
  
  if (
    cleanAddr === '0.0.0.0' ||
    cleanAddr === '127.0.0.1' ||
    cleanAddr === 'localhost' ||
    cleanAddr === '::' ||
    cleanAddr === '::1' ||
    cleanAddr === ''
  ) {
    return `http://localhost:${port}`;
  }

  // If already an IPv6 or explicit LAN IPv4 address
  if (address.includes(':')) {
    return `http://[${cleanAddr}]:${port}`;
  }

  return `http://${address}:${port}`;
}

/**
 * Derives a unified list of DashboardServer views from listening ports and process identities in O(P + S) time.
 * Groups multiple listening ports under the owning process identity.
 */
export function deriveDashboardServers(
  ports: PortInfo[],
  identities: ProcessIdentity[]
): DashboardServer[] {
  // Step 1: Index Process Identities by PID in O(P) time
  const identityMap = new Map<number, ProcessIdentity>();
  for (const id of identities) {
    identityMap.set(id.process.pid, id);
  }

  // Step 2: Group listening ports by PID in O(S) time
  const portsByPid = new Map<number, PortInfo[]>();
  for (const port of ports) {
    const list = portsByPid.get(port.pid) ?? [];
    list.push(port);
    portsByPid.set(port.pid, list);
  }

  const servers: DashboardServer[] = [];

  // Step 3: For each unique PID with listening ports, construct a DashboardServer
  for (const [pid, portList] of portsByPid.entries()) {
    const identity = identityMap.get(pid);

    // Sort ports numerically ascending
    const sortedPortNumbers = portList
      .map((p) => p.port)
      .sort((a, b) => a - b);
    const uniquePortNumbers = Array.from(new Set(sortedPortNumbers));

    const primaryPort = uniquePortNumbers[0] ?? 0;
    const primaryPortInfo = portList.find((p) => p.port === primaryPort) ?? portList[0];

    if (identity) {
      // Merge identity's listening ports with any freshly discovered ports
      const allPorts = Array.from(
        new Set([...uniquePortNumbers, ...identity.listeningPorts])
      ).sort((a, b) => a - b);

      const name = deriveServerName(
        identity.process.workingDirectory,
        identity.process.commandLine,
        identity.runtime,
        identity.process.name
      );

      servers.push({
        id: `win-${pid}-${primaryPort}`,
        name,
        status: 'running',
        primaryPort,
        allPorts: allPorts.length > 0 ? allPorts : [primaryPort],
        address: primaryPortInfo.address,
        protocol: primaryPortInfo.protocol,
        pid,
        processName: identity.process.name,
        executablePath: identity.process.executablePath ?? null,
        commandLine: identity.process.commandLine ?? null,
        workingDirectory: identity.process.workingDirectory ?? null,
        runtime: identity.runtime,
        packageManager: identity.packageManager,
        parent: identity.parent ?? null,
        processTree: identity.processTree,
        environment: 'windows',
        wslDistro: null,
      });
    } else {
      // Endpoint with restricted or exited process
      servers.push({
        id: `win-unmatched-${pid}-${primaryPort}`,
        name: `Port ${primaryPort} (PID ${pid})`,
        status: 'running',
        primaryPort,
        allPorts: uniquePortNumbers,
        address: primaryPortInfo.address,
        protocol: primaryPortInfo.protocol,
        pid,
        processName: `Unknown (PID ${pid})`,
        executablePath: null,
        commandLine: null,
        workingDirectory: null,
        runtime: 'Unknown',
        packageManager: 'Unknown',
        parent: null,
        processTree: [
          {
            pid,
            name: `PID ${pid} (Access Restricted or Exited)`,
            commandLine: null,
            isTarget: true,
            depth: 0,
          },
        ],
        environment: 'windows',
        wslDistro: null,
      });
    }
  }

  return servers;
}

/**
 * Applies search and filter criteria to the server list.
 */
export function filterServers(
  servers: DashboardServer[],
  searchQuery: string,
  filters: ServerFilterOptions
): DashboardServer[] {
  let result = servers;

  // Environment filter
  if (filters.environment !== 'all') {
    result = result.filter((s) => s.environment === filters.environment);
  }

  // Runtime filter
  if (filters.runtime !== 'all') {
    result = result.filter((s) => s.runtime === filters.runtime);
  }

  // Status filter
  if (filters.status !== 'all') {
    result = result.filter((s) => s.status === filters.status);
  }

  // Client-side search across multiple fields
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    result = result.filter((s) => {
      const matchName = s.name.toLowerCase().includes(q);
      const matchPrimaryPort = s.primaryPort.toString().includes(q);
      const matchAllPorts = s.allPorts.some((p) => p.toString().includes(q));
      const matchPid = s.pid.toString().includes(q);
      const matchProcess = s.processName.toLowerCase().includes(q);
      const matchRuntime = s.runtime.toLowerCase().includes(q);
      const matchPkgMgr = s.packageManager.toLowerCase().includes(q);
      const matchCmd = s.commandLine ? s.commandLine.toLowerCase().includes(q) : false;
      const matchCwd = s.workingDirectory ? s.workingDirectory.toLowerCase().includes(q) : false;
      const matchAddress = s.address.toLowerCase().includes(q);

      return (
        matchName ||
        matchPrimaryPort ||
        matchAllPorts ||
        matchPid ||
        matchProcess ||
        matchRuntime ||
        matchPkgMgr ||
        matchCmd ||
        matchCwd ||
        matchAddress
      );
    });
  }

  return result;
}

/**
 * Sorts the servers list deterministically.
 */
export function sortServers(
  servers: DashboardServer[],
  sortField: ServerSortField,
  sortDirection: ServerSortDirection
): DashboardServer[] {
  return [...servers].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'port':
        comparison = a.primaryPort - b.primaryPort;
        break;
      case 'pid':
        comparison = a.pid - b.pid;
        break;
      case 'name':
        comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        break;
      case 'runtime':
        comparison = a.runtime.localeCompare(b.runtime);
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });
}
