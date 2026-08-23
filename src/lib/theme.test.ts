import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  THEME_STORAGE_KEY,
  getStoredThemePreference,
  saveThemePreference,
  getSystemTheme,
  resolveTheme,
  applyThemeToDocument,
  initThemeEarly,
} from './theme';

describe('Theme Lib Functions (Milestone 14)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.style.colorScheme = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getStoredThemePreference', () => {
    it('returns "dark" by default if nothing is stored in localStorage', () => {
      expect(getStoredThemePreference()).toBe('dark');
    });

    it('returns "light" when stored in localStorage', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
      expect(getStoredThemePreference()).toBe('light');
    });

    it('returns "system" when stored in localStorage', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'system');
      expect(getStoredThemePreference()).toBe('system');
    });

    it('safely falls back to "dark" on invalid or corrupted storage values', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'neon-purple');
      expect(getStoredThemePreference()).toBe('dark');
    });
  });

  describe('saveThemePreference', () => {
    it('stores the valid theme preference in localStorage', () => {
      saveThemePreference('light');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

      saveThemePreference('system');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');

      saveThemePreference('dark');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    });
  });

  describe('getSystemTheme and resolveTheme', () => {
    it('resolves dark theme when OS prefers dark mode', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('dark'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as MediaQueryList));

      expect(getSystemTheme()).toBe('dark');
      expect(resolveTheme('system')).toBe('dark');
      expect(resolveTheme('dark')).toBe('dark');
      expect(resolveTheme('light')).toBe('light');
    });

    it('resolves light theme when OS prefers light mode in system preference', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as MediaQueryList));

      expect(getSystemTheme()).toBe('light');
      expect(resolveTheme('system')).toBe('light');
      expect(resolveTheme('dark')).toBe('dark');
      expect(resolveTheme('light')).toBe('light');
    });
  });

  describe('applyThemeToDocument', () => {
    it('applies dark theme to document root data-theme, class, and style.colorScheme', () => {
      applyThemeToDocument('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);
      expect(document.documentElement.style.colorScheme).toBe('dark');
    });

    it('applies light theme to document root data-theme, class, and style.colorScheme', () => {
      applyThemeToDocument('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(document.documentElement.style.colorScheme).toBe('light');
    });
  });

  describe('initThemeEarly', () => {
    it('synchronously reads preference and configures DOM root without throwing', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
      initThemeEarly();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(document.documentElement.classList.contains('light')).toBe(true);
    });
  });
});
