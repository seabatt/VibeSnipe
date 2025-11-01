import { useThemeContext } from '@/components/providers/ThemeProvider';
import * as tokens from '@/styles/tokens';

export function useTokens() {
  const { resolvedTheme } = useThemeContext();
  const themeColors = tokens.color[resolvedTheme];
  
  return {
    colors: {
      ...themeColors,
      semantic: tokens.color.semantic,
    },
    space: tokens.space,
    radius: tokens.radius,
    type: tokens.type,
    elevation: tokens.elevation,
    motion: tokens.motion,
    theme: resolvedTheme,
  };
}

