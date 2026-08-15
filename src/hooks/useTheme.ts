import { usePlayerStore } from '../stores/usePlayerStore';
import { getTheme, type Theme } from '../theme/themes';

/** The player's active theme. Re-renders only when the selection changes. */
export function useTheme(): Theme {
  return usePlayerStore((s) => getTheme(s.selectedTheme));
}
