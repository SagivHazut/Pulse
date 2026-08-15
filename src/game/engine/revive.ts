import { REVIVE_CONFIG } from '../../constants/config';
import type { Board, Coord } from '../../types';
import { defaultRng, type Rng } from '../../utils/rng';
import { boardSize, cloneBoard, countFilled } from './board';

export type ReviveResult = {
  board: Board;
  clearedCells: Coord[];
  /** Fraction of previously occupied tiles that were removed. */
  ratio: number;
};

type LineRef = { kind: 'row' | 'col'; index: number; filled: number };

function densestLine(board: Board): LineRef | null {
  const { rows, columns } = boardSize(board);
  let best: LineRef | null = null;

  for (let r = 0; r < rows; r += 1) {
    let filled = 0;
    for (let c = 0; c < columns; c += 1) if (board[r][c]) filled += 1;
    if (filled > 0 && (!best || filled > best.filled)) best = { kind: 'row', index: r, filled };
  }
  for (let c = 0; c < columns; c += 1) {
    let filled = 0;
    for (let r = 0; r < rows; r += 1) if (board[r][c]) filled += 1;
    if (filled > 0 && (!best || filled > best.filled)) best = { kind: 'col', index: c, filled };
  }
  return best;
}

/**
 * Clear roughly 20–30% of the occupied tiles after a rewarded revive.
 *
 * Rather than punching random holes, this repeatedly empties the densest row or
 * column. That guarantees contiguous open space, so the player lands back in a
 * board they can actually play instead of a sieve.
 */
export function reviveBoard(board: Board, rng: Rng = defaultRng): ReviveResult {
  const occupied = countFilled(board);
  if (occupied === 0) return { board: cloneBoard(board), clearedCells: [], ratio: 0 };

  const ratio =
    REVIVE_CONFIG.clearRatioMin +
    rng() * (REVIVE_CONFIG.clearRatioMax - REVIVE_CONFIG.clearRatioMin);
  const target = Math.max(1, Math.round(occupied * ratio));

  const next = cloneBoard(board);
  const clearedCells: Coord[] = [];
  const { rows, columns } = boardSize(board);

  while (clearedCells.length < target) {
    const line = densestLine(next);
    if (!line) break;
    if (line.kind === 'row') {
      for (let c = 0; c < columns; c += 1) {
        if (next[line.index][c]) {
          next[line.index][c] = null;
          clearedCells.push({ row: line.index, col: c });
        }
      }
    } else {
      for (let r = 0; r < rows; r += 1) {
        if (next[r][line.index]) {
          next[r][line.index] = null;
          clearedCells.push({ row: r, col: line.index });
        }
      }
    }
  }

  return { board: next, clearedCells, ratio: clearedCells.length / occupied };
}
