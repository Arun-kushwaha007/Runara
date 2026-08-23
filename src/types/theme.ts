export type ThemePreference = 'system' | 'dark' | 'light';

export type ResolvedTheme = 'dark' | 'light';

export interface ThemeContextValue {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  setThemePreference: (theme: ThemePreference) => void;
}
