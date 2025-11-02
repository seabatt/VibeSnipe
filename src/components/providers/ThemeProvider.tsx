'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Sun, Monitor, Moon } from 'lucide-react';
import { useTheme as useThemeStore, useThemeInit } from '@/stores/useTheme';
import { useTokens } from '@/hooks/useTokens';

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
  const [mounted, setMounted] = useState(false);
  const storeTheme = useThemeInit();
  const { setTheme: setStoreTheme } = useThemeStore();

  // Determine resolved theme from preference
  const getResolvedTheme = (pref: Theme): 'dark' | 'light' => {
    if (!mounted) return 'dark';
    if (pref === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return pref;
  };

  useEffect(() => {
    setMounted(true);
    // Load theme preference from localStorage
    const stored = localStorage.getItem('theme-preference') as Theme | null;
    if (stored && ['dark', 'light', 'auto'].includes(stored)) {
      setThemeState(stored);
      const resolved = stored === 'auto' 
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : stored;
      setResolvedTheme(resolved);
      setStoreTheme(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    } else {
      // Default to auto
      const resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      setResolvedTheme(resolved);
      setStoreTheme(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    }
  }, [setStoreTheme]);

  useEffect(() => {
    if (!mounted) return;
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
  }, [theme, setStoreTheme, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (mounted) {
      localStorage.setItem('theme-preference', newTheme);
      const resolved = newTheme === 'auto'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : newTheme;
      setResolvedTheme(resolved);
      setStoreTheme(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    }
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

// ThemeToggle component - matches Figma exactly
export function ThemeToggle() {
  const { theme, setTheme } = useThemeContext();
  const [isMobile, setIsMobile] = useState(false);
  const tokens = useTokens();
  const colors = tokens.colors;
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const options: Theme[] = ['light', 'auto', 'dark'];

  return (
    <div style={{ 
      display: 'flex',
      backgroundColor: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: `${tokens.radius.md}px`,
      padding: `${tokens.space.xs}px`,
      gap: `${tokens.space.xs}px`,
    }}>
      {options.map((mode) => (
        <button
          key={mode}
          onClick={() => setTheme(mode)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: `${tokens.space.xs}px`,
            padding: `${tokens.space.xs}px ${tokens.space.md}px`,
            backgroundColor: theme === mode ? colors.bg : 'transparent',
            border: theme === mode ? `1px solid ${colors.border}` : '1px solid transparent',
            borderRadius: `${tokens.space.sm}px`,
            color: theme === mode ? colors.textPrimary : colors.textSecondary,
            fontSize: `${tokens.type.sizes.xs}px`,
            cursor: 'pointer',
            transition: 'all 150ms ease-in-out',
          }}
          onMouseEnter={(e) => {
            if (theme !== mode) {
              e.currentTarget.style.backgroundColor = colors.surfaceAlt;
            }
          }}
          onMouseLeave={(e) => {
            if (theme !== mode) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          {mode === 'light' && <Sun size={12} />}
          {mode === 'auto' && <Monitor size={12} />}
          {mode === 'dark' && <Moon size={12} />}
          <span>{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
        </button>
      ))}
    </div>
  );
}

