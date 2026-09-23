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

/**
 * Which cell a tap inside the grid landed on.
 *
 * `locationX/Y` are relative to the view that received the touch, and the
 * targeting overlay is already inset by the board padding — the cells inside it
 * start at `0`, not at `padding`. Subtracting the padding a second time shifted
 * the whole hit grid by 8dp, about a fifth of a cell: taps near a cell's left or
 * top edge detonated a power-up on the neighbour, and the first 8dp of the grid
 * resolved to -1 and were swallowed.
 *
 * Returns null when the tap is outside the grid.
 */
export function cellUnderTap(
  locationX: number,
  locationY: number,
  cellStride: number,
  rows: number,
  columns: number,
): { row: number; col: number } | null {
  if (!(cellStride > 0)) return null;
  const col = Math.floor(locationX / cellStride);
  const row = Math.floor(locationY / cellStride);
  if (row < 0 || col < 0 || row >= rows || col >= columns) return null;
  return { row, col };
}

/**
 * Should a fly-home animation's completion hand the piece back to the tray?
 *
 * A piece dropped with no placement animates back to its slot, and the drag
 * layer only lets go when that animation lands. Two things can make that
 * callback wrong to act on:
 *
 *  - **It was cancelled.** Assigning to the position shared values stops the
 *    spring, and Reanimated still calls back, with `finished === false`. The
 *    only thing that assigns them is a new drag's `track()`, so a cancelled
 *    flight always means a live drag has taken the layer over. It owns the
 *    cleanup now; doing it here hides the piece the player is holding.
 *  - **Another piece owns the layer.** `session` is bumped on every pickup;
 *    `dragId` is the session this flight belongs to.
 *
 * `finished` is what catches a re-grab of the *same* piece, which the session
 * check alone cannot: `dragId` lives on the piece, and the new drag's `onBegin`
 * has already bumped it by the time this runs, so both sides read the new
 * session and the check passes. Measured on an iPhone 17:
 * `finished=false session=4 dragId=4` — the guard agreeing with itself while
 * the player drags an invisible piece.
 */
export function shouldReleaseDragLayer(
  finished: boolean,
  session: number,
  dragId: number,
): boolean {
  'worklet';
  return finished && session === dragId;
}
