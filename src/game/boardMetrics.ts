import { GAME_CONFIG } from '../constants/config';
import { SPACING } from '../theme/tokens';

/**
 * Board geometry, derived from the viewport.
 *
 * Pure and React-Native-free so it can be unit-tested on plain Node, like the
 * rest of the game's decision logic. `src/utils/layout.ts` wraps this with the
 * platform's pixel rounding; nothing else should call it directly.
 */

export const BOARD_PADDING = 8;
export const CELL_GAP = 3;
/** Board never grows past this, so tablets get a comfortable board, not a wall. */
export const MAX_BOARD_WIDTH = 520;

/**
 * Vertical space the board may never claim: status bar and header, the score and
 * best line, the Pulse meter, the piece tray, and the power-up bar.
 *
 * This replaced a `height * 0.46 + 60` guess that overshot on short screens.
 * Because the board is centred inside a flex parent, an oversized board does not
 * clip — it overflows *upwards* and paints over the score, which on a 320x640
 * device sliced the "BEST" line in half.
 */
export const CHROME_HEIGHT = 396;

/** Below this the grid stops being playable, so overflow is the lesser evil. */
export const MIN_BOARD_SIZE = 220;

export type BoardMetrics = {
  boardSize: number;
  cellSize: number;
  cellStride: number;
  padding: number;
  gap: number;
  /** Piece size inside a tray slot. */
  trayCellSize: number;
  traySlotSize: number;
  screenWidth: number;
  screenHeight: number;
  isCompact: boolean;
  isTablet: boolean;
};

/** Rounds to whole device pixels. Injected so this module stays platform-free. */
export type RoundFn = (value: number) => number;

export function computeBoardMetricsWith(
  width: number,
  height: number,
  round: RoundFn,
): BoardMetrics {
  const isTablet = Math.min(width, height) >= 600;
  const horizontalInset = isTablet ? SPACING.xl : SPACING.md;

  const available = Math.min(width - horizontalInset * 2, MAX_BOARD_WIDTH);
  // What is genuinely left once the surrounding chrome has taken its share. On
  // roomy screens the width limit still wins, so this only bites where it must.
  const heightBudget = height - CHROME_HEIGHT;
  const boardSize = round(Math.max(MIN_BOARD_SIZE, Math.min(available, heightBudget)));

  const inner = boardSize - BOARD_PADDING * 2 - CELL_GAP * (GAME_CONFIG.columns - 1);
  const cellSize = round(inner / GAME_CONFIG.columns);
  const cellStride = cellSize + CELL_GAP;

  const traySlotSize = round(Math.min((width - horizontalInset * 2) / 3.4, 132));
  // Tray pieces are drawn at ~58% of board scale so a 5-long bar still fits.
  const trayCellSize = round(cellSize * 0.58);

  return {
    boardSize,
    cellSize,
    cellStride,
    padding: BOARD_PADDING,
    gap: CELL_GAP,
    trayCellSize,
    traySlotSize,
    screenWidth: width,
    screenHeight: height,
    isCompact: height < 700,
    isTablet,
  };
}
