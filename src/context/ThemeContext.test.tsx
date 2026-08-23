import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from './ThemeContext';
import { THEME_STORAGE_KEY } from '../lib/theme';

const TestComponent = () => {
  const { themePreference, resolvedTheme, setThemePreference } = useTheme();

  return (
    <div>
      <div data-testid="pref">{themePreference}</div>
      <div data-testid="resolved">{resolvedTheme}</div>
      <button onClick={() => setThemePreference('light')}>Set Light</button>
      <button onClick={() => setThemePreference('dark')}>Set Dark</button>
      <button onClick={() => setThemePreference('system')}>Set System</button>
    </div>
  );
};

describe('ThemeContext & ThemeProvider (Milestone 14)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.style.colorScheme = '';

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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default "dark" theme when localStorage is empty', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('pref').textContent).toBe('dark');
    expect(screen.getByTestId('resolved').textContent).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('initializes with stored theme preference from localStorage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('pref').textContent).toBe('light');
    expect(screen.getByTestId('resolved').textContent).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('updates theme preference and document root attributes on user change', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    await user.click(screen.getByText('Set Light'));

    expect(screen.getByTestId('pref').textContent).toBe('light');
    expect(screen.getByTestId('resolved').textContent).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    await user.click(screen.getByText('Set Dark'));

    expect(screen.getByTestId('pref').textContent).toBe('dark');
    expect(screen.getByTestId('resolved').textContent).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('responds to live system media query updates in "system" mode', async () => {
    let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((event, handler) => {
        if (event === 'change') {
          mediaListener = handler as (e: MediaQueryListEvent) => void;
        }
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList));

    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    await user.click(screen.getByText('Set System'));

    expect(screen.getByTestId('pref').textContent).toBe('system');
    expect(screen.getByTestId('resolved').textContent).toBe('dark');

    // Simulate OS toggling to light mode
    if (mediaListener) {
      act(() => {
        mediaListener!({ matches: false } as MediaQueryListEvent);
      });

      expect(screen.getByTestId('resolved').textContent).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    }
  });

  it('throws an error when useTheme is called outside ThemeProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow('useTheme must be used within a ThemeProvider');
    consoleError.mockRestore();
  });
});
