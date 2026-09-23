/**
 * The board and hand behind the demo screenshots — pure, so it can be tested.
 *
 * Split out of `demoSeed.ts` because that module reaches for `expo-constants`
 * and the storage layer, neither of which loads under the plain-Node test
 * runner. The composition is the part that has actually been wrong twice, so it
 * is the part that needs a test.
 */
import { GAME_CONFIG } from '../../constants/config';
import { countLines, findCompletedLines } from '../../game/engine/lines';
import { findValidPlacements, placePiece } from '../../game/engine/placement';
import { SHAPES } from '../../game/pieces/shapes';
import type { BlockColorId, Board, Piece } from '../../types';

/**
 * A board worth photographing.
 *
 * Authored as ASCII for the same reason the piece shapes are — it is the only
 * way to see the composition while editing it. Each letter is a block colour;
 * '.' is empty.
 *
 * Shaped deliberately: dense along the bottom and left so the grid reads as
 * "a run in progress" rather than a random scatter, with the lower rows a tile
 * or two short of clearing. A board about to pay off sells the mechanic; a
 * half-empty one sells nothing.
 *
 * Row 5 is drawn exactly two short so the domino in the tray fits it — see
 * {@link assertPayoffIsReachable}. Getting that wrong is invisible in the ASCII
 * and obvious in the screenshot.
 *
 * **No row or column may be complete.** A full line clears the instant it forms,
 * so a seeded board containing one is a state the game could never produce —
 * and it is exactly the kind of detail that makes a store screenshot look
 * staged. {@link assertBoardIsPlausible} asserts it rather than trusting the art.
 */
const DEMO_BOARD = [
  '........',
  '........',
  '...vv...',
  '..avvc..',
  '..aaccs.',
  'lla..csp',
  'llaar.sp',
  'llmmrrp.',
];

const COLOR_BY_LETTER: Record<string, BlockColorId> = {
  a: 'aqua',
  v: 'violet',
  c: 'coral',
  l: 'lime',
  m: 'amber',
  r: 'rose',
  s: 'sky',
  p: 'violet',
};

/**
 * Would the engine ever allow this board to exist?
 *
 * Only the completeness rule is checked, because it is the only one a hand-drawn
 * board can plausibly break. Throwing is the point: a silently impossible board
 * ships to a store listing, where it is someone else's job to notice.
 *
 * Unguarded by `__DEV__` on purpose — the only caller is already dev-only, and a
 * guard here would make the tests below pass without ever running the check.
 */
export function assertBoardIsPlausible(board: Board): void {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;

  for (let row = 0; row < rows; row += 1) {
    if (board[row]?.every((cell) => cell !== null)) {
      throw new Error(`demoSeed: row ${row} is complete — it would have cleared.`);
    }
  }
  for (let col = 0; col < cols; col += 1) {
    if (board.every((line) => line[col] !== null)) {
      throw new Error(`demoSeed: column ${col} is complete — it would have cleared.`);
    }
  }
}

/**
 * Can a piece in the tray actually clear a line from this board?
 *
 * The board and the tray are authored separately, so any claim that a given
 * piece "completes row 5" is only as true as whoever last edited the ASCII.
 *
 * This is the weaker of the two checks: it only asks whether *some* piece can
 * clear *some* line, which is what makes the screenshot show a board on the
 * verge rather than a board mid-slog. The first version of this fixture passed
 * it while still being wrong — the domino it advertised as the payoff faced a
 * one-cell gap and could not be played there at all, even though two other
 * pieces happened to clear a column. The specific promise is pinned by the
 * tests, not here.
 *
 * Checked by playing every legal placement of every tray piece, because that is
 * the only answer the engine itself would accept.
 */
export function assertPayoffIsReachable(board: Board, tray: readonly (Piece | null)[]): void {
  const reachable = tray.some((piece) => {
    if (!piece) return false;
    return findValidPlacements(board, piece).some((at) => {
      const played = placePiece(board, piece, at.row, at.col);
      return countLines(findCompletedLines(played.board)) > 0;
    });
  });

  if (!reachable) {
    throw new Error(
      'demoSeed: no tray piece can clear a line — the screenshot promises a payoff the board does not offer.',
    );
  }
}

export function demoBoard(): Board {
  return Array.from({ length: GAME_CONFIG.rows }, (_, row) =>
    Array.from({ length: GAME_CONFIG.columns }, (_, col) => {
      const letter = DEMO_BOARD[row]?.[col] ?? '.';
      const colorId = COLOR_BY_LETTER[letter];
      return colorId ? { colorId, power: null } : null;
    }),
  );
}

/** A full hand, so the tray never photographs half-empty. */
export function demoTray(): (Piece | null)[] {
  const wanted: { shapeId: string; colorId: BlockColorId; power?: 'bomb' }[] = [
    // Exactly fills the two-cell gap in row 5 — the payoff the board is set
    // up for, and the reason that row is drawn two short rather than one. A
    // one-cell gap would have made this piece unplayable there, which is the
    // opposite of what the shot needs to show.
    { shapeId: 'i2-h', colorId: 'aqua' },
    // A bomb tile, so the power-block mechanic is visible in the shot.
    { shapeId: 't-down', colorId: 'rose', power: 'bomb' },
    { shapeId: 'l-b', colorId: 'sky' },
  ];

  return wanted.map((want, index) => {
    const shape = SHAPES.find((candidate) => candidate.id === want.shapeId);
    if (!shape) return null;
    return {
      id: `demo-${index}`,
      shapeId: shape.id,
      cells: shape.cells.map((cell, i) => ({
        r: cell.r,
        c: cell.c,
        power: want.power && i === 1 ? want.power : null,
      })),
      width: shape.width,
      height: shape.height,
      colorId: want.colorId,
    };
  });
}
