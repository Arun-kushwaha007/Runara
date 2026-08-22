import type { DashboardServer } from '../types/server';
import type { ServerProfile } from '../types/profile';
import type { ProfileAssociation } from '../types/adoption';

/**
 * Normalizes a filesystem path for consistent comparison across operating systems.
 * Converts backslashes to forward slashes, lowercases, trims trailing slash.
 *
 * Examples:
 *   "C:\\Projects\\Frontend" → "c:/projects/frontend"
 *   "/home/dev/api/"        → "/home/dev/api"
 */
export function normalizePath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
    .toLowerCase();
}

/**
 * Tests whether a single profile is a candidate match for the given server.
 *
 * Matching rules (ALL must be satisfied for a match):
 *
 * Rule 1: Environment type must match (windows↔windows, wsl↔wsl)
 * Rule 2: For WSL — distro must match exactly (Ubuntu ≠ Fedora)
 * Rule 3: If profile has expectedPort — server's allPorts must include it
 * Rule 4: If BOTH have workingDirectory — normalized paths must match
 *
 * A profile without expectedPort falls back to directory-only matching.
 * A profile without workingDirectory omits rule 4 (broader match).
 *
 * Why port alone is insufficient: two servers on the same machine can
 * temporarily share a port number across restarts. Directory anchors intent.
 *
 * Why directory alone is insufficient: the same repo can run on different ports
 * (e.g. dev=3000, preview=4173). Profile B with port 3001 must not match a server
 * on port 3000 even if directory matches.
 */
export function isProfileMatch(
  server: DashboardServer,
  profile: ServerProfile
): boolean {
  // Rule 1: environment type must match
  if (server.environment.type !== profile.environment.type) {
    return false;
  }

  // Rule 2: WSL distro must match exactly
  if (
    server.environment.type === 'wsl' &&
    profile.environment.type === 'wsl' &&
    server.environment.distro !== profile.environment.distro
  ) {
    return false;
  }

  // Rule 3: if profile specifies an expected port, server must be listening on it
  if (profile.expectedPort != null) {
    if (!server.allPorts.includes(profile.expectedPort)) {
      return false;
    }
  }

  // Rule 4: if both have working directories, they must match (normalized)
  if (profile.workingDirectory && server.workingDirectory) {
    if (normalizePath(profile.workingDirectory) !== normalizePath(server.workingDirectory)) {
      return false;
    }
  }

  return true;
}

/**
 * Associates a DashboardServer with saved ServerProfiles.
 *
 * Returns:
 * - managed: true + profileId   → exactly one profile matches
 * - managed: false + ambiguous  → multiple profiles match with equal confidence
 * - managed: false              → no profile matches (server is unmanaged)
 *
 * Ambiguity handling: when multiple profiles match, the server is treated as
 * unmanaged until the user resolves the conflict. The candidateIds list lets
 * the UI display which profiles are contending.
 *
 * This function is intentionally deterministic — no scoring, no ML, no heuristics
 * beyond the rules in isProfileMatch.
 */
export function associateServerWithProfile(
  server: DashboardServer,
  profiles: ServerProfile[]
): ProfileAssociation {
  const matches = profiles.filter((p) => isProfileMatch(server, p));

  if (matches.length === 0) {
    return { managed: false };
  }

  if (matches.length === 1) {
    return { managed: true, profileId: matches[0].id };
  }

  // Multiple profiles matched — ambiguous; do not guess
  return {
    managed: false,
    ambiguous: true,
    candidateIds: matches.map((p) => p.id),
  };
}
