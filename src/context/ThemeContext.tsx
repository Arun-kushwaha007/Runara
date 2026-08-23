import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { ThemePreference, ResolvedTheme, ThemeContextValue } from '../types/theme';
import {
  getStoredThemePreference,
  saveThemePreference,
  resolveTheme,
  applyThemeToDocument,
} from '../lib/theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultPreference?: ThemePreference;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultPreference,
}) => {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => {
    if (defaultPreference) return defaultPreference;
    return getStoredThemePreference();
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(themePreference)
  );

  // Synchronize document attribute and class whenever resolvedTheme changes
  useEffect(() => {
    applyThemeToDocument(resolvedTheme);
  }, [resolvedTheme]);

  // Set up live OS system theme listener when themePreference is 'system'
  useEffect(() => {
    if (themePreference !== 'system') {
      const currentResolved = resolveTheme(themePreference);
      setResolvedTheme(currentResolved);
      return;
    }

    // Resolve initial system theme
    setResolvedTheme(resolveTheme('system'));

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      const newSystemResolved: ResolvedTheme = e.matches ? 'dark' : 'light';
      setResolvedTheme(newSystemResolved);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleMediaChange);
      return () => mediaQuery.removeEventListener('change', handleMediaChange);
    } else if (typeof (mediaQuery as any).addListener === 'function') {
      (mediaQuery as any).addListener(handleMediaChange);
      return () => (mediaQuery as any).removeListener(handleMediaChange);
    }
  }, [themePreference]);

  const setTheme = useCallback((newPreference: ThemePreference) => {
    setThemePreferenceState(newPreference);
    saveThemePreference(newPreference);
    const newResolved = resolveTheme(newPreference);
    setResolvedTheme(newResolved);
    applyThemeToDocument(newResolved);
  }, []);

  const contextValue = useMemo<ThemeContextValue>(
    () => ({
      themePreference,
      resolvedTheme,
      setTheme,
      setThemePreference: setTheme,
    }),
    [themePreference, resolvedTheme, setTheme]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
