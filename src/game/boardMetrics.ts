import { ANIMATION, GAME_CONFIG } from '../constants/config';
import { SHAPES } from './pieces/shapes';
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
 *
 * Raise this whenever chrome is added above or below the board. It last moved
 * from 396 when the score block gained a bottom margin — without the bump the
 * board would have reclaimed exactly the gap that margin was added to create.
 */
export const CHROME_HEIGHT = 420;

/** Below this the grid stops being playable, so overflow is the lesser evil. */
export const MIN_BOARD_SIZE = 220;

/**
 * Height the inline tutorial card is budgeted at.
 *
 * Measured at 115dp, plus the one extra `styles.lower` flex gap that mounting it
 * also costs (SPACING.sm = 12), rounded up so the longest step ("Chain it",
 * whose body wraps to a second line) still fits.
 *
 * This is a **constant on purpose**, and it is what the card reports rather than
 * its own measured height — see `canReserveHeight` and `tutorialReserve`. The
 * card's text changes length from step to step, so a measured reservation would
 * resize the board mid-run, under the player's hand, at the exact moment a clear
 * animation is playing.
 */
export const TUTORIAL_CARD_HEIGHT = 132;

/**
 * Whether a transient panel of `panelHeight` can be given its own space without
 * pushing the board below the playable floor.
 *
 * On a 320x640 device the chrome and a playable board already account for the
 * whole screen, so a ~110dp tutorial card cannot be laid out beside them: the
 * choice is a covered board or a board with 15dp cells. The caller uses this to
 * pick — reserve space where it fits, overlay where it does not, and never let
 * the panel squeeze the column and push the board over the score.
 *
 * **`panelHeight` must be a constant, never a measured height.** The panel is
 * laid out differently depending on the answer — a tall card inline, a short
 * pill floating — so feeding its measured height back in closes a loop:
 *
 *     measure tall card (132) -> "no room" -> render short pill
 *     measure short pill (43) -> "room!"   -> render tall card -> ...
 *
 * That oscillates once per frame for every screen between
 * `CHROME_HEIGHT + MIN_BOARD_SIZE + pillHeight` and
 * `CHROME_HEIGHT + MIN_BOARD_SIZE + cardHeight` — 683dp to 771dp, i.e. most
 * budget Android phones (360x720, 360x740, 412x732), during the tutorial that
 * every new player sees. Measured live at 360x720: 39 flips in 40 frames.
 *
 * Callers should prefer `tutorialReserve`, which cannot be passed the wrong
 * thing.
 */
export function canReserveHeight(height: number, panelHeight: number): boolean {
  return height - CHROME_HEIGHT - panelHeight >= MIN_BOARD_SIZE;
}

/**
 * How much height the board gives up for the tutorial card: all of it, or none.
 *
 * The whole decision is a pure function of the viewport and one boolean, so the
 * reserve decision, the reserved amount and the card's own layout cannot
 * disagree with each other. Reserving exactly what `canReserveHeight` was asked
 * about is the point — reserving a *measured* height that differs from the
 * budgeted one is how the board ends up overflowing the score.
 */
export function tutorialReserve(height: number, cardVisible: boolean): number {
  if (!cardVisible) return 0;
  return canReserveHeight(height, TUTORIAL_CARD_HEIGHT) ? TUTORIAL_CARD_HEIGHT : 0;
}

export type BoardMetrics = {
  boardSize: number;
  cellSize: number;
  cellStride: number;
  padding: number;
  gap: number;
  traySlotSize: number;
  /**
   * Scale a piece is drawn at while it sits in the tray, relative to board
   * cells. The design value, shrunk only where the longest piece would not fit
   * its slot at that value.
   */
  trayScale: number;
  screenWidth: number;
  screenHeight: number;
  isCompact: boolean;
  isTablet: boolean;
};

/** Rounds to whole device pixels. Injected so this module stays platform-free. */
export type RoundFn = (value: number) => number;

/** Longest run of cells in any shape, across or down. Five, for the I5 bars. */
const LONGEST_PIECE_SPAN = Math.max(...SHAPES.map((shape) => Math.max(shape.width, shape.height)));

/**
 * The largest tray scale, up to the design value, at which every piece fits
 * inside its slot.
 *
 * The slot is sized from the screen width and the piece from the board's cell
 * size, and nothing tied the two together. At a fixed 0.58 a five-block bar
 * overhung its slot by 20pt on every iPhone and by 49pt on a 13" iPad, where it
 * painted over the Pulse meter and the power-up row.
 */
function fitTrayScale(cellSize: number, slotSize: number): number {
  const span = LONGEST_PIECE_SPAN * cellSize + (LONGEST_PIECE_SPAN - 1) * CELL_GAP;
  return Math.min(ANIMATION.trayScale, slotSize / span);
}

export function computeBoardMetricsWith(
  width: number,
  height: number,
  round: RoundFn,
  /**
   * Extra height claimed by something transient, currently the tutorial card.
   * Passing it here shrinks the board instead of letting the card overlap it —
   * the card exists to point at the board, so covering it defeats the purpose.
   */
  reserved = 0,
): BoardMetrics {
  const isTablet = Math.min(width, height) >= 600;
  const horizontalInset = isTablet ? SPACING.xl : SPACING.md;

  const available = Math.min(width - horizontalInset * 2, MAX_BOARD_WIDTH);
  // What is genuinely left once the surrounding chrome has taken its share. On
  // roomy screens the width limit still wins, so this only bites where it must.
  const heightBudget = height - CHROME_HEIGHT - Math.max(0, reserved);
  const boardSize = round(Math.max(MIN_BOARD_SIZE, Math.min(available, heightBudget)));

  const inner = boardSize - BOARD_PADDING * 2 - CELL_GAP * (GAME_CONFIG.columns - 1);
  const cellSize = round(inner / GAME_CONFIG.columns);
  const cellStride = cellSize + CELL_GAP;

  const traySlotSize = round(Math.min((width - horizontalInset * 2) / 3.4, 132));
  const trayScale = fitTrayScale(cellSize, traySlotSize);

  return {
    boardSize,
    cellSize,
    cellStride,
    padding: BOARD_PADDING,
    gap: CELL_GAP,
    traySlotSize,
    trayScale,
    screenWidth: width,
    screenHeight: height,
    isCompact: height < 700,
    isTablet,
  };
}
