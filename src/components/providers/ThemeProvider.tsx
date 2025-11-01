'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useTheme as useThemeStore, useThemeInit } from '@/stores/useTheme';

type Theme = 'dark' | 'light' | 'auto';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'dark' | 'light';
  setTheme: (theme: Theme) => void;
}

const ThemeContextInternal = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('auto');
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');
  const storeTheme = useThemeInit();
  const { setTheme: setStoreTheme } = useThemeStore();

  // Determine resolved theme from preference
  const getResolvedTheme = (pref: Theme): 'dark' | 'light' => {
    if (pref === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return pref;
  };

  useEffect(() => {
    // Load theme preference from localStorage
    const stored = localStorage.getItem('theme-preference') as Theme | null;
    if (stored && ['dark', 'light', 'auto'].includes(stored)) {
      setThemeState(stored);
      const resolved = getResolvedTheme(stored);
      setResolvedTheme(resolved);
      setStoreTheme(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    } else {
      // Default to auto
      const resolved = getResolvedTheme('auto');
      setResolvedTheme(resolved);
      setStoreTheme(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    }
  }, [setStoreTheme]);

  useEffect(() => {
    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        const resolved = e.matches ? 'dark' : 'light';
        setResolvedTheme(resolved);
        setStoreTheme(resolved);
        document.documentElement.setAttribute('data-theme', resolved);
      };
      
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      setResolvedTheme(theme);
      setStoreTheme(theme);
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme, setStoreTheme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme-preference', newTheme);
    const resolved = getResolvedTheme(newTheme);
    setResolvedTheme(resolved);
    setStoreTheme(resolved);
  };

  return (
    <ThemeContextInternal.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContextInternal.Provider>
  );
}

export function useThemeContext() {
  const context = useContext(ThemeContextInternal);
  if (!context) {
    throw new Error('useThemeContext must be used within ThemeProvider');
  }
  return context;
}

// ThemeToggle component
export function ThemeToggle() {
  const { theme, setTheme } = useThemeContext();
  const options: Theme[] = ['light', 'auto', 'dark'];
  const labels: Record<Theme, string> = {
    light: '☀️ Light',
    auto: '🔄 Auto',
    dark: '🌙 Dark',
  };

  return (
    <div className="flex items-center gap-4 border rounded-md p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
      {options.map((option) => (
        <button
          key={option}
          onClick={() => setTheme(option)}
          className={`px-12 py-4 text-sm font-medium rounded-md transition-colors duration-fast ${
            theme === option
              ? 'text-text-primary'
              : 'text-text-secondary'
          }`}
          style={{
            backgroundColor: theme === option ? 'var(--surface-alt)' : 'transparent',
            color: theme === option ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => {
            if (theme !== option) {
              e.currentTarget.style.backgroundColor = 'var(--surface-alt)';
            }
          }}
          onMouseLeave={(e) => {
            if (theme !== option) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}

