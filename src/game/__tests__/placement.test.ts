import { createEmptyBoard, occupancy } from '../engine/board';
import {
  canPlacePiece,
  findPlaceablePieces,
  findValidPlacements,
  hasValidPlacement,
  isGameOver,
  placePiece,
  snapToNearestValid,
} from '../engine/placement';
import { makeBoard, makePiece } from './helpers';

describe('canPlacePiece', () => {
  it('accepts a piece on empty space', () => {
    const board = createEmptyBoard(4, 4);
    expect(canPlacePiece(board, makePiece(['##']), 0, 0)).toBe(true);
    expect(canPlacePiece(board, makePiece(['##']), 3, 2)).toBe(true);
  });

  it('rejects a piece that runs off the board', () => {
    const board = createEmptyBoard(4, 4);
    const piece = makePiece(['###']);
    expect(canPlacePiece(board, piece, 0, 2)).toBe(false);
    expect(canPlacePiece(board, piece, 4, 0)).toBe(false);
    expect(canPlacePiece(board, piece, -1, 0)).toBe(false);
    expect(canPlacePiece(board, piece, 0, -1)).toBe(false);
  });

  it('rejects a piece overlapping an occupied cell', () => {
    const board = makeBoard(['..#.', '....', '....', '....']);
    expect(canPlacePiece(board, makePiece(['###']), 0, 0)).toBe(false);
    expect(canPlacePiece(board, makePiece(['###']), 1, 0)).toBe(true);
  });

  it('lets a rainbow tile overlap a filled cell', () => {
    const board = makeBoard(['.#..', '....', '....', '....']);
    expect(canPlacePiece(board, makePiece(['#R#']), 0, 0)).toBe(true);
    // The non-wild tiles still cannot overlap.
    expect(canPlacePiece(board, makePiece(['R##']), 0, 1)).toBe(true);
    expect(canPlacePiece(board, makePiece(['##R']), 0, 0)).toBe(false);
  });
});

describe('placePiece', () => {
  it('writes the piece without mutating the source board', () => {
    const board = createEmptyBoard(4, 4);
    const result = placePiece(board, makePiece(['##', '.#']), 1, 1);

    expect(result.tilesPlaced).toBe(3);
    expect(result.cells).toEqual([
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 2, col: 2 },
    ]);
    expect(result.board[1][1]).not.toBeNull();
    expect(board[1][1]).toBeNull();
    expect(occupancy(board)).toBe(0);
  });

  it('carries power tiles onto the board', () => {
    const board = createEmptyBoard(4, 4);
    const result = placePiece(board, makePiece(['#B']), 0, 0);
    expect(result.board[0][0]?.power).toBeNull();
    expect(result.board[0][1]?.power).toBe('bomb');
  });

  it('throws rather than corrupting the board on an invalid placement', () => {
    const board = makeBoard(['#...', '....', '....', '....']);
    expect(() => placePiece(board, makePiece(['##']), 0, 0)).toThrow();
  });
});

describe('valid move search', () => {
  it('lists every origin the piece fits at', () => {
    const board = createEmptyBoard(3, 3);
    expect(findValidPlacements(board, makePiece(['##', '##']))).toHaveLength(4);
  });

  it('reports no placements on a full board', () => {
    const board = makeBoard(['###', '###', '###']);
    expect(hasValidPlacement(board, makePiece(['#']))).toBe(false);
    expect(findValidPlacements(board, makePiece(['#']))).toHaveLength(0);
  });

  it('filters the hand down to placeable pieces', () => {
    const board = makeBoard(['##.', '###', '###']);
    const fits = makePiece(['#']);
    const doesNot = makePiece(['##']);
    expect(findPlaceablePieces(board, [fits, doesNot, null]).map((p) => p.id)).toEqual([fits.id]);
  });
});

describe('isGameOver', () => {
  it('is false while any piece fits', () => {
    const board = makeBoard(['##.', '###', '###']);
    expect(isGameOver(board, [makePiece(['#']), makePiece(['####'])])).toBe(false);
  });

  it('is true when nothing in hand fits', () => {
    const board = makeBoard(['##.', '###', '###']);
    expect(isGameOver(board, [makePiece(['##']), makePiece(['#', '#'])])).toBe(true);
  });

  it('is false for an empty hand — the hand refills first', () => {
    const board = makeBoard(['###', '###', '###']);
    expect(isGameOver(board, [null, null, null])).toBe(false);
  });
});

describe('snapToNearestValid', () => {
  it('returns the exact origin when it already fits', () => {
    const board = createEmptyBoard(4, 4);
    expect(snapToNearestValid(board, makePiece(['#']), 2, 2)).toEqual({ row: 2, col: 2 });
  });

  it('nudges to an adjacent origin when blocked', () => {
    const board = makeBoard(['....', '..#.', '....', '....']);
    expect(snapToNearestValid(board, makePiece(['#']), 1, 2)).not.toBeNull();
  });

  it('gives up when nothing nearby fits', () => {
    const board = makeBoard(['####', '####', '####', '####']);
    expect(snapToNearestValid(board, makePiece(['#']), 1, 1)).toBeNull();
  });
});
