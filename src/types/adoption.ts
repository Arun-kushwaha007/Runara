import type { Environment } from './environment';
import type { ServerProfile } from './profile';

/**
 * Transient model capturing the user-editable fields for adopting a running server.
 * Never persisted to SQLite — only lives during the adoption flow until the user saves.
 *
 * The environment field is derived from the discovered server and is read-only
 * during adoption. Only profile configuration fields are editable.
 */
export interface AdoptionDraft {
  /** ID of the source DashboardServer this draft was built from */
  sourceServerId: string;
  /** Prefilled display name (user-editable) */
  name: string;
  /** Derived from discovered server — read-only during adoption */
  environment: Environment;
  /** Working directory path (user-editable, prefilled from discovery) */
  workingDirectory: string;
  /**
   * Startup command (user-editable, prefilled from process command line).
   * NOTE: The discovered process command may differ from the original startup command
   * (e.g. "node.exe server.js" vs the original "npm run dev"). The user should
   * review and correct this field before saving.
   */
  command: string;
  /**
   * Expected listening port.
   * undefined when multiple ports detected (user must explicitly choose).
   * null means "no expected port" (valid — matching falls back to working directory).
   */
  expectedPort?: number | null;
  /** Expected host binding (e.g. '127.0.0.1'). Empty string = any */
  expectedHost?: string;
  /** All ports currently listened on by the source process (for multi-port selection UI) */
  allDetectedPorts: number[];
  /** Optional description or notes */
  description?: string;
}

/**
 * Result of associating a DashboardServer with saved ServerProfiles.
 * Computed dynamically at render time — never stored in the database.
 *
 * If managed = true and profileId is set: exactly one profile matched.
 * If ambiguous = true: multiple profiles matched with equal confidence; user must resolve.
 * If managed = false and not ambiguous: no profile matches; server is unmanaged.
 */
export interface ProfileAssociation {
  /** Whether a matching profile was found */
  managed: boolean;
  /** ID of the matched ServerProfile, if exactly one profile matched */
  profileId?: string;
  /** True when multiple profiles match the server with equal confidence */
  ambiguous?: boolean;
  /** All candidate profile IDs when ambiguous */
  candidateIds?: string[];
}

/**
 * Result of duplicate profile detection before creating an adopted profile.
 * Returned by the backend command find_duplicate_profiles.
 */
export interface DuplicateProfileResult {
  hasDuplicates: boolean;
  duplicates: ServerProfile[];
}
