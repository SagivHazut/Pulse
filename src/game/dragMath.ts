/**
 * Drag geometry and validity, shared between the gesture worklet and the tests.
 *
 * These run on the UI thread during a drag, which is exactly why they live here
 * as small pure functions: the coordinate conversion is the one part of the drag
 * that cannot be checked by looking at it, so it gets checked by tests instead.
 *
 * The `'worklet'` directive is a plain string literal to Node, so the same code
 * is testable without any React Native runtime.
 */

/** A piece tile reduced to what the worklet needs: position and wildcard flag. */
export type DragCell = { r: number; c: number; wild: number };

export type GridGeometry = {
  /** Screen position of the top-left corner of cell (0, 0). */
  originX: number;
  originY: number;
  /** Cell size plus gap. */
  stride: number;
};

export type PieceGeometry = {
  /** Rendered size of the piece at board scale, including internal gaps. */
  width: number;
  height: number;
};

/**
 * Which cell the piece's top-left tile is hovering, given the centre of the
 * dragged piece in screen coordinates. Rounding (not flooring) means the piece
 * snaps to the nearest cell, so a drop that is slightly off still lands where
 * the player meant.
 */
export function cellUnderPiece(
  centerX: number,
  centerY: number,
  piece: PieceGeometry,
  grid: GridGeometry,
): { row: number; col: number } {
  'worklet';
  return {
    row: Math.round((centerY - piece.height / 2 - grid.originY) / grid.stride),
    col: Math.round((centerX - piece.width / 2 - grid.originX) / grid.stride),
  };
}

/** Inverse of {@link cellUnderPiece}: where the piece centre must be to hit a cell. */
export function pieceCenterForCell(
  row: number,
  col: number,
  piece: PieceGeometry,
  grid: GridGeometry,
): { x: number; y: number } {
  'worklet';
  return {
    x: grid.originX + col * grid.stride + piece.width / 2,
    y: grid.originY + row * grid.stride + piece.height / 2,
  };
}

/**
 * Validity check against a flat 0/1 board mirror.
 *
 * Mirrors `canPlacePiece` in the engine, including the rainbow wildcard rule —
 * the two are kept in step by `dragMath.test.ts`, which asserts they agree.
 */
export function canPlaceOnGrid(
  occupancy: readonly number[],
  rows: number,
  columns: number,
  cells: readonly DragCell[],
  row: number,
  col: number,
): boolean {
  'worklet';
  for (let i = 0; i < cells.length; i += 1) {
    const r = row + cells[i].r;
    const c = col + cells[i].c;
    if (r < 0 || c < 0 || r >= rows || c >= columns) return false;
    if (occupancy[r * columns + c] === 1 && cells[i].wild === 0) return false;
  }
  return true;
}

/** True when the target is far enough from the board that no preview should show. */
export function isOffBoard(
  row: number,
  col: number,
  rows: number,
  columns: number,
  margin = 2,
): boolean {
  'worklet';
  return row < -margin || col < -margin || row > rows + margin - 1 || col > columns + margin - 1;
}
