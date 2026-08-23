import type { DashboardServer } from '../types/server';
import type { AdoptionDraft } from '../types/adoption';
import { deriveServerName } from './serverUtils';

/**
 * Attempts to extract a meaningful startup command from a raw process command line.
 *
 * Background: The process command (e.g. "node.exe C:\vite\bin\vite.js")
 * is NOT the same as the original startup command (e.g. "npm run dev").
 * Runara cannot always reconstruct the exact human-typed command.
 *
 * Heuristic rules applied:
 * 1. Shell wrappers (cmd.exe /c, powershell.exe -Command, bash -lc) — strip wrapper, extract inner
 * 2. npm/yarn/pnpm/cargo/python/go/dotnet run commands — use verbatim
 * 3. Bare "node.exe <path>" invocations — keep but label as detected process command
 * 4. Everything else — keep verbatim with a disclaimer shown in the UI
 *
 * The result is ALWAYS user-editable in the adoption form.
 */
export function inferStartCommand(commandLine: string | null): string {
  if (!commandLine || !commandLine.trim()) {
    return '';
  }

  const cmd = commandLine.trim();

  // Strip common shell wrappers to expose the inner command
  const shellWrappers = [
    /^cmd\.exe\s+\/[cC]\s+/i,
    /^cmd\s+\/[cC]\s+/i,
    /^powershell(?:\.exe)?\s+(?:-Command|-c)\s+/i,
    /^pwsh(?:\.exe)?\s+(?:-Command|-c)\s+/i,
    /^bash\s+(?:-lc?|--login\s+-c)\s+/i,
    /^sh\s+-c\s+/i,
    /^wsl\.exe\s+(?:-e\s+)?/i,
  ];

  for (const wrapper of shellWrappers) {
    const match = cmd.match(wrapper);
    if (match) {
      // Remove surrounding quotes from inner command if present
      const inner = cmd.slice(match[0].length).replace(/^['"]|['"]$/g, '').trim();
      if (inner) return inner;
    }
  }

  // Common development tool launch patterns — use verbatim
  const devPatterns = [
    /^npm\s+run\s+/i,
    /^npm\s+start\b/i,
    /^yarn\s+run\s+/i,
    /^yarn\s+dev\b/i,
    /^pnpm\s+run\s+/i,
    /^pnpm\s+dev\b/i,
    /^npx\s+/i,
    /^cargo\s+run\b/i,
    /^python(?:3)?\s+-m\s+/i,
    /^go\s+run\b/i,
    /^dotnet\s+run\b/i,
    /^java\s+-jar\s+/i,
    /^uvicorn\s+/i,
    /^flask\s+run\b/i,
    /^django-admin\s+/i,
    /^rails\s+server\b/i,
    /^bundle\s+exec\s+/i,
    /^mix\s+phx\./i,
    /^vite\b/i,
    /^next\s+/i,
    /^nuxt\s+/i,
    /^svelte-kit\s+/i,
  ];

  for (const pattern of devPatterns) {
    if (pattern.test(cmd)) {
      return cmd;
    }
  }

  // Return the raw command line — user can correct it in the form
  return cmd;
}

/**
 * Determines the expected port for the adoption draft.
 *
 * Rules:
 * - Single port → use it directly
 * - Multiple ports → return undefined (user must choose in the form)
 * - No ports → return undefined
 *
 * The UI shows all detected ports as options when undefined is returned.
 */
export function inferExpectedPort(allPorts: number[]): number | undefined {
  if (allPorts.length === 1) {
    return allPorts[0];
  }
  // Multiple or zero ports — require explicit selection
  return undefined;
}

/**
 * Normalizes an address for display in the adoption form.
 * Returns empty string for wildcard/loopback addresses (they are too common to be meaningful).
 */
export function inferExpectedHost(address: string): string {
  const addr = address.trim().toLowerCase();
  if (
    addr === '0.0.0.0' ||
    addr === '::' ||
    addr === '' ||
    addr === '*'
  ) {
    return '';
  }
  return address;
}

/**
 * Builds an AdoptionDraft from a discovered DashboardServer.
 *
 * This is the canonical entry point for the adoption flow.
 * All fields are prefilled from discovery data and are editable in the form.
 * The draft is NEVER persisted — only the final SaveProfile call persists.
 *
 * The `profiles` parameter is used to check for duplicates but does NOT affect
 * the draft's field values.
 *
 * @param server   - The running DashboardServer being adopted
 * @returns        A fully prefilled AdoptionDraft for the adoption form
 */
export function buildAdoptionDraft(server: DashboardServer): AdoptionDraft {
  const name = deriveServerName(
    server.workingDirectory,
    server.commandLine,
    server.runtime,
    server.processName
  );

  const command = inferStartCommand(server.commandLine);
  const expectedPort = inferExpectedPort(server.allPorts);
  const expectedHost = inferExpectedHost(server.address);

  return {
    sourceServerId: server.id,
    name,
    environment: server.environment,
    workingDirectory: server.workingDirectory ?? '',
    command,
    expectedPort,
    expectedHost: expectedHost || undefined,
    allDetectedPorts: [...server.allPorts],
    description: undefined,
  };
}
