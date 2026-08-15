import { REVIVE_CONFIG } from '../../constants/config';
import { createRng } from '../../utils/rng';
import { countFilled, createEmptyBoard } from '../engine/board';
import { hasValidPlacement } from '../engine/placement';
import { reviveBoard } from '../engine/revive';
import { makeBoard, makePiece } from './helpers';

const JAMMED = makeBoard([
  '########',
  '########',
  '########',
  '#######.',
  '########',
  '########',
  '########',
  '#.######',
]);

describe('reviveBoard', () => {
  it('clears roughly a fifth to a third of the occupied tiles', () => {
    for (let seed = 0; seed < 25; seed += 1) {
      const before = countFilled(JAMMED);
      const result = reviveBoard(JAMMED, createRng(seed));
      const removed = before - countFilled(result.board);

      expect(removed).toBe(result.clearedCells.length);
      expect(removed / before).toBeGreaterThanOrEqual(REVIVE_CONFIG.clearRatioMin * 0.75);
      expect(removed / before).toBeLessThanOrEqual(REVIVE_CONFIG.clearRatioMax * 1.5);
    }
  });

  it('opens contiguous space so the board is playable again', () => {
    const result = reviveBoard(JAMMED, createRng(3));
    // A 4-long bar could not fit before; after a revive it can.
    expect(hasValidPlacement(JAMMED, makePiece(['####']))).toBe(false);
    expect(hasValidPlacement(result.board, makePiece(['####']))).toBe(true);
  });

  it('does not mutate the input board', () => {
    const before = countFilled(JAMMED);
    reviveBoard(JAMMED, createRng(9));
    expect(countFilled(JAMMED)).toBe(before);
  });

  it('is a no-op on an empty board', () => {
    const result = reviveBoard(createEmptyBoard(), createRng(1));
    expect(result.clearedCells).toHaveLength(0);
    expect(result.ratio).toBe(0);
  });
});
