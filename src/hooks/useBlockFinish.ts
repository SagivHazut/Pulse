import { usePlayerStore } from '../stores/usePlayerStore';
import { getFinish, type BlockFinish } from '../theme/finishes';

/**
 * The player's chosen block finish.
 *
 * Read directly by `Tile` rather than threaded down through the board, tray and
 * drag layer. The selector returns a stable object for a given id, so the 64
 * board tiles only re-render when the finish actually changes.
 */
export function useBlockFinish(): BlockFinish {
  return usePlayerStore((s) => getFinish(s.selectedFinish));
}
