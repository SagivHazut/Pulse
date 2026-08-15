import { GAME_CONFIG, POWER_BLOCK_CONFIG } from '../../constants/config';
import { createRng } from '../../utils/rng';
import { createEmptyBoard } from '../engine/board';
import { hasValidPlacement } from '../engine/placement';
import { generatePieces, handHasPower, resetPieceIds } from '../generators/pieceGenerator';
import { makeBoard } from './helpers';

beforeEach(() => resetPieceIds());

describe('generatePieces', () => {
  it('deals a full hand', () => {
    const hand = generatePieces(createEmptyBoard(), { rng: createRng(1) });
    expect(hand).toHaveLength(GAME_CONFIG.handSize);
    for (const piece of hand) {
      expect(piece.cells.length).toBeGreaterThan(0);
      expect(piece.width).toBeGreaterThan(0);
      expect(piece.height).toBeGreaterThan(0);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = generatePieces(createEmptyBoard(), { rng: createRng(42) });
    resetPieceIds();
    const b = generatePieces(createEmptyBoard(), { rng: createRng(42) });
    expect(a.map((p) => p.shapeId)).toEqual(b.map((p) => p.shapeId));
    expect(a.map((p) => p.colorId)).toEqual(b.map((p) => p.colorId));
  });

  it('gives unique ids to every piece', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      for (const piece of generatePieces(createEmptyBoard(), { rng: createRng(i) })) {
        expect(ids.has(piece.id)).toBe(false);
        ids.add(piece.id);
      }
    }
  });

  it('keeps at least one placeable piece while the board has room', () => {
    // A board with only isolated single cells free: nothing but a 1x1 fits.
    const board = makeBoard([
      '.#.#.#.#',
      '########',
      '.#.#.#.#',
      '########',
      '.#.#.#.#',
      '########',
      '.#.#.#.#',
      '#####...',
    ]);
    for (let seed = 0; seed < 30; seed += 1) {
      const hand = generatePieces(board, { rng: createRng(seed) });
      expect(hand.some((piece) => hasValidPlacement(board, piece))).toBe(true);
    }
  });

  it('never exceeds the power-block cap per hand', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const hand = generatePieces(createEmptyBoard(), { rng: createRng(seed) });
      const powerPieces = hand.filter((p) => p.cells.some((c) => c.power !== null));
      expect(powerPieces.length).toBeLessThanOrEqual(POWER_BLOCK_CONFIG.maxPerHand);
      for (const piece of powerPieces) {
        expect(piece.cells.filter((c) => c.power !== null)).toHaveLength(1);
      }
    }
  });

  it('produces no power tiles when they are disallowed', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const hand = generatePieces(createEmptyBoard(), {
        rng: createRng(seed),
        allowPower: false,
      });
      expect(handHasPower(hand)).toBe(false);
    }
  });

  it('still deals a hand on a nearly full board, even an unplayable one', () => {
    const board = makeBoard([
      '########',
      '########',
      '########',
      '########',
      '########',
      '########',
      '########',
      '#######.',
    ]);
    const hand = generatePieces(board, { rng: createRng(7) });
    expect(hand).toHaveLength(GAME_CONFIG.handSize);
  });

  it('favours larger shapes as the run goes on', () => {
    const tiles = (round: number) => {
      let total = 0;
      for (let seed = 0; seed < 400; seed += 1) {
        for (const piece of generatePieces(createEmptyBoard(), {
          rng: createRng(seed),
          round,
        })) {
          total += piece.cells.length;
        }
      }
      return total;
    };
    expect(tiles(40)).toBeGreaterThan(tiles(0));
  });
});
