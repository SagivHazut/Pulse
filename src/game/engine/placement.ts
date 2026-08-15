import type { Board, Coord, Piece, TraySlot } from '../../types';
import { boardSize, cloneBoard, isInside } from './board';

/**
 * Can `piece` sit with its local (0,0) at board (row, col)?
 * Pure and allocation-free — this runs inside the drag loop's validity check.
 *
 * Rainbow tiles are wildcards: they may be dropped on top of an occupied cell,
 * which is what lets them complete formations nothing else can reach.
 */
export function canPlacePiece(board: Board, piece: Piece, row: number, col: number): boolean {
  const { rows, columns } = boardSize(board);
  for (let i = 0; i < piece.cells.length; i += 1) {
    const cell = piece.cells[i];
    const r = row + cell.r;
    const c = col + cell.c;
    if (r < 0 || c < 0 || r >= rows || c >= columns) return false;
    if (board[r][c] !== null && cell.power !== 'rainbow') return false;
  }
  return true;
}

export type PlacementResult = {
  board: Board;
  tilesPlaced: number;
  cells: Coord[];
};

/**
 * Returns a new board with the piece written in. Caller must have validated with
 * {@link canPlacePiece} first; this throws rather than corrupting the board.
 */
export function placePiece(board: Board, piece: Piece, row: number, col: number): PlacementResult {
  if (!canPlacePiece(board, piece, row, col)) {
    throw new Error(`Invalid placement of ${piece.shapeId} at ${row},${col}`);
  }
  const next = cloneBoard(board);
  const cells: Coord[] = [];
  for (const cell of piece.cells) {
    const r = row + cell.r;
    const c = col + cell.c;
    next[r][c] = { colorId: piece.colorId, power: cell.power };
    cells.push({ row: r, col: c });
  }
  return { board: next, tilesPlaced: piece.cells.length, cells };
}

/** Every origin where the piece fits. */
export function findValidPlacements(board: Board, piece: Piece): Coord[] {
  const { rows, columns } = boardSize(board);
  const out: Coord[] = [];
  for (let r = 0; r <= rows - piece.height; r += 1) {
    for (let c = 0; c <= columns - piece.width; c += 1) {
      if (canPlacePiece(board, piece, r, c)) out.push({ row: r, col: c });
    }
  }
  return out;
}

export function hasValidPlacement(board: Board, piece: Piece): boolean {
  const { rows, columns } = boardSize(board);
  for (let r = 0; r <= rows - piece.height; r += 1) {
    for (let c = 0; c <= columns - piece.width; c += 1) {
      if (canPlacePiece(board, piece, r, c)) return true;
    }
  }
  return false;
}

/** All pieces still in hand that can be placed somewhere. */
export function findPlaceablePieces(board: Board, tray: readonly TraySlot[]): Piece[] {
  const out: Piece[] = [];
  for (const slot of tray) {
    if (slot && hasValidPlacement(board, slot)) out.push(slot);
  }
  return out;
}

/**
 * Game over means: pieces remain in hand, and not one of them fits anywhere.
 * An empty hand is never game over — the hand refills first.
 */
export function isGameOver(board: Board, tray: readonly TraySlot[]): boolean {
  const remaining = tray.filter((p): p is Piece => p !== null);
  if (remaining.length === 0) return false;
  return !remaining.some((piece) => hasValidPlacement(board, piece));
}

/**
 * Snap a free-floating pixel origin to the nearest grid origin the piece fits in.
 * Returns null when nothing within `tolerance` cells works.
 */
export function snapToNearestValid(
  board: Board,
  piece: Piece,
  row: number,
  col: number,
  tolerance = 1,
): Coord | null {
  if (canPlacePiece(board, piece, row, col)) return { row, col };
  let best: Coord | null = null;
  let bestDist = Infinity;
  for (let dr = -tolerance; dr <= tolerance; dr += 1) {
    for (let dc = -tolerance; dc <= tolerance; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (!isInside(board, r, c)) continue;
      if (!canPlacePiece(board, piece, r, c)) continue;
      const dist = dr * dr + dc * dc;
      if (dist < bestDist) {
        bestDist = dist;
        best = { row: r, col: c };
      }
    }
  }
  return best;
}
