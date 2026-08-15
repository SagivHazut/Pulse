import { toOccupancyGrid } from '../engine/board';
import { canPlacePiece } from '../engine/placement';
import {
  canPlaceOnGrid,
  cellUnderPiece,
  isOffBoard,
  pieceCenterForCell,
  type DragCell,
  type GridGeometry,
} from '../dragMath';
import { makeBoard, makePiece } from './helpers';

/**
 * Geometry measured from the running app at 375pt wide: an 8x8 board whose
 * cell (0,0) sits at (25, 132.5) with 38.5pt cells and a 3pt gap.
 */
const GRID: GridGeometry = { originX: 25, originY: 132.5, stride: 41.5 };
const CELL = 38.5;
const GAP = 3;

const sized = (w: number, h: number) => ({
  width: w * CELL + (w - 1) * GAP,
  height: h * CELL + (h - 1) * GAP,
});

describe('cellUnderPiece', () => {
  it('maps a piece centred on a cell to that cell', () => {
    const piece = sized(1, 1);
    const center = pieceCenterForCell(3, 5, piece, GRID);
    expect(cellUnderPiece(center.x, center.y, piece, GRID)).toEqual({ row: 3, col: 5 });
  });

  it('round-trips every cell of the board for pieces of every size', () => {
    for (let w = 1; w <= 5; w += 1) {
      for (let h = 1; h <= 5; h += 1) {
        const piece = sized(w, h);
        for (let row = 0; row <= 8 - h; row += 1) {
          for (let col = 0; col <= 8 - w; col += 1) {
            const center = pieceCenterForCell(row, col, piece, GRID);
            expect(cellUnderPiece(center.x, center.y, piece, GRID)).toEqual({ row, col });
          }
        }
      }
    }
  });

  it('snaps to the nearest cell rather than flooring', () => {
    const piece = sized(2, 2);
    const center = pieceCenterForCell(4, 4, piece, GRID);
    // Nearly half a cell off in each direction still resolves to (4,4).
    const nudge = GRID.stride * 0.45;
    expect(cellUnderPiece(center.x + nudge, center.y - nudge, piece, GRID)).toEqual({
      row: 4,
      col: 4,
    });
    expect(cellUnderPiece(center.x - nudge, center.y + nudge, piece, GRID)).toEqual({
      row: 4,
      col: 4,
    });
  });

  it('moves to the next cell once past the halfway point', () => {
    const piece = sized(1, 1);
    const center = pieceCenterForCell(2, 2, piece, GRID);
    expect(cellUnderPiece(center.x + GRID.stride * 0.6, center.y, piece, GRID).col).toBe(3);
    expect(cellUnderPiece(center.x, center.y - GRID.stride * 0.6, piece, GRID).row).toBe(1);
  });

  it('reports negative cells when the piece is dragged above or left of the board', () => {
    const piece = sized(1, 1);
    const target = cellUnderPiece(GRID.originX - 100, GRID.originY - 100, piece, GRID);
    expect(target.row).toBeLessThan(0);
    expect(target.col).toBeLessThan(0);
  });
});

describe('isOffBoard', () => {
  it('accepts cells on and just around the board', () => {
    expect(isOffBoard(0, 0, 8, 8)).toBe(false);
    expect(isOffBoard(7, 7, 8, 8)).toBe(false);
    expect(isOffBoard(-1, 4, 8, 8)).toBe(false);
  });

  it('rejects targets far from the board', () => {
    expect(isOffBoard(-6, 3, 8, 8)).toBe(true);
    expect(isOffBoard(3, 20, 8, 8)).toBe(true);
  });
});

describe('canPlaceOnGrid', () => {
  const board = makeBoard([
    '..##....',
    '..##....',
    '........',
    '....###.',
    '........',
    '........',
    '........',
    '.......#',
  ]);
  const grid = toOccupancyGrid(board);

  const toDragCells = (cells: { r: number; c: number; power: string | null }[]): DragCell[] =>
    cells.map((c) => ({ r: c.r, c: c.c, wild: c.power === 'rainbow' ? 1 : 0 }));

  /**
   * The worklet must never disagree with the engine — a preview that says "yes"
   * where `placePiece` throws would be a dropped piece and a lost turn.
   */
  it('agrees with the engine for every piece at every position', () => {
    const pieces = [
      makePiece(['#']),
      makePiece(['##']),
      makePiece(['###']),
      makePiece(['#', '#', '#']),
      makePiece(['##', '##']),
      makePiece(['###', '###', '###']),
      makePiece(['.#.', '###']),
      makePiece(['#R#']),
      makePiece(['R#']),
    ];

    for (const piece of pieces) {
      const cells = toDragCells(piece.cells);
      for (let row = -2; row < 10; row += 1) {
        for (let col = -2; col < 10; col += 1) {
          const fromWorklet = canPlaceOnGrid(grid, 8, 8, cells, row, col);
          const fromEngine = canPlacePiece(board, piece, row, col);
          expect({ row, col, shape: piece.shapeId, valid: fromWorklet }).toEqual({
            row,
            col,
            shape: piece.shapeId,
            valid: fromEngine,
          });
        }
      }
    }
  });

  it('honours the rainbow wildcard over an occupied cell', () => {
    const wild: DragCell[] = [{ r: 0, c: 0, wild: 1 }];
    const solid: DragCell[] = [{ r: 0, c: 0, wild: 0 }];
    expect(canPlaceOnGrid(grid, 8, 8, wild, 0, 2)).toBe(true);
    expect(canPlaceOnGrid(grid, 8, 8, solid, 0, 2)).toBe(false);
  });
});
