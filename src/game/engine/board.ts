import { GAME_CONFIG } from '../../constants/config';
import type { Board, CellState, Coord } from '../../types';

export type BoardSize = { rows: number; columns: number };

export function boardSize(board: Board): BoardSize {
  return { rows: board.length, columns: board[0]?.length ?? 0 };
}

export function createEmptyBoard(
  rows: number = GAME_CONFIG.rows,
  columns: number = GAME_CONFIG.columns,
): Board {
  const board: Board = new Array(rows);
  for (let r = 0; r < rows; r += 1) {
    board[r] = new Array<CellState>(columns).fill(null);
  }
  return board;
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}

export function isInside(board: Board, row: number, col: number): boolean {
  return row >= 0 && col >= 0 && row < board.length && col < (board[0]?.length ?? 0);
}

export function getCell(board: Board, row: number, col: number): CellState {
  return isInside(board, row, col) ? board[row][col] : null;
}

export function isOccupied(board: Board, row: number, col: number): boolean {
  return getCell(board, row, col) !== null;
}

export function countFilled(board: Board): number {
  let n = 0;
  for (const row of board) {
    for (const cell of row) if (cell) n += 1;
  }
  return n;
}

export function totalCells(board: Board): number {
  const { rows, columns } = boardSize(board);
  return rows * columns;
}

/** 0 → empty board, 1 → completely full. */
export function occupancy(board: Board): number {
  const total = totalCells(board);
  return total === 0 ? 0 : countFilled(board) / total;
}

export function isEmptyBoard(board: Board): boolean {
  return countFilled(board) === 0;
}

export function filledCoords(board: Board): Coord[] {
  const out: Coord[] = [];
  for (let r = 0; r < board.length; r += 1) {
    for (let c = 0; c < board[r].length; c += 1) {
      if (board[r][c]) out.push({ row: r, col: c });
    }
  }
  return out;
}

/**
 * Flat 0/1 occupancy view. Used to mirror the board onto the UI thread, where
 * gesture worklets need a cheap structure to validate drag previews against.
 */
export function toOccupancyGrid(board: Board): number[] {
  const { rows, columns } = boardSize(board);
  const out = new Array<number>(rows * columns);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < columns; c += 1) {
      out[r * columns + c] = board[r][c] ? 1 : 0;
    }
  }
  return out;
}

export function coordKey(row: number, col: number): string {
  return `${row}:${col}`;
}
