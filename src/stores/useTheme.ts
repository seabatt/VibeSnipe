import { create } from 'zustand';
import { useEffect } from 'react';

type Theme = 'dark' | 'light';

interface ThemeStore {
  theme: Theme;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
}

export const useTheme = create<ThemeStore>((set) => ({
  theme: 'dark', // Default, will be updated on mount
  toggle: () => {
    set((state) => {
      const newTheme = state.theme === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
      }
      return { theme: newTheme };
    });
  },
  setTheme: (theme: Theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    }
    set({ theme });
  },
}));

// Hook to initialize theme on mount
export function useThemeInit() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme;
    const initialTheme = stored || 'dark';
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
  }, [setTheme]);

  return theme;
}
