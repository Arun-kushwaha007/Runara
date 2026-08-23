import type { ThemePreference, ResolvedTheme } from '../types/theme';

export const THEME_STORAGE_KEY = 'devhub_theme_preference';
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'dark';
export const VALID_THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'dark', 'light'] as const;

/**
 * Validates whether a value is a legitimate ThemePreference.
 */
export function isValidThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (VALID_THEME_PREFERENCES as readonly string[]).includes(value);
}

/**
 * Reads the persisted theme preference from local storage with safe default fallback.
 */
export function getStoredThemePreference(): ThemePreference {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return DEFAULT_THEME_PREFERENCE;
    }
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && isValidThemePreference(stored)) {
      return stored;
    }
    return DEFAULT_THEME_PREFERENCE;
  } catch (err) {
    console.warn('Failed to read theme preference from storage, falling back to default:', err);
    return DEFAULT_THEME_PREFERENCE;
  }
}

/**
 * Persists the user's selected theme preference to local storage.
 */
export function saveThemePreference(preference: ThemePreference): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    if (isValidThemePreference(preference)) {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, DEFAULT_THEME_PREFERENCE);
    }
  } catch (err) {
    console.warn('Failed to persist theme preference to storage:', err);
  }
}

/**
 * Detects the host operating system's color scheme preference.
 */
export function getSystemTheme(): ResolvedTheme {
  try {
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
    return 'light';
  } catch {
    return 'dark';
  }
}

/**
 * Resolves a ThemePreference into an active ResolvedTheme ('dark' | 'light').
 */
export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    return getSystemTheme();
  }
  if (preference === 'light') {
    return 'light';
  }
  return 'dark';
}

/**
 * Applies the resolved theme to the DOM root element (attributes, class list, and colorScheme).
 */
export function applyThemeToDocument(resolvedTheme: ResolvedTheme): void {
  if (typeof document === 'undefined' || !document.documentElement) {
    return;
  }
  const root = document.documentElement;
  root.setAttribute('data-theme', resolvedTheme);
  root.classList.remove('dark', 'light');
  root.classList.add(resolvedTheme);
  root.style.colorScheme = resolvedTheme;
}

/**
 * Early initialization function called before React renders to prevent visual flash.
 */
export function initThemeEarly(): ResolvedTheme {
  const preference = getStoredThemePreference();
  const resolved = resolveTheme(preference);
  applyThemeToDocument(resolved);
  return resolved;
}
