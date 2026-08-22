/**
 * Domain model representing an individual directory entry in a directory listing.
 */
export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isHidden: boolean;
}

/**
 * Domain model representing the result of listing a directory inside an environment.
 */
export interface DirectoryListing {
  currentPath: string;
  parentPath: string | null;
  entries: DirectoryEntry[];
}

/**
 * Result of validating a directory path against an execution environment.
 */
export interface PathValidationResult {
  isValid: boolean;
  error: string | null;
  resolvedPath: string | null;
}
