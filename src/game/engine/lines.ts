import type {
  Board,
  ClearOutcome,
  CompletedLines,
  Coord,
  PowerTrigger,
  PowerType,
} from '../../types';
import { boardSize, cloneBoard, coordKey, countFilled } from './board';

/** Rows and columns that are completely filled. */
export function findCompletedLines(board: Board): CompletedLines {
  const { rows, columns } = boardSize(board);
  const fullRows: number[] = [];
  const fullCols: number[] = [];

  for (let r = 0; r < rows; r += 1) {
    let full = true;
    for (let c = 0; c < columns; c += 1) {
      if (board[r][c] === null) {
        full = false;
        break;
      }
    }
    if (full) fullRows.push(r);
  }

  for (let c = 0; c < columns; c += 1) {
    let full = true;
    for (let r = 0; r < rows; r += 1) {
      if (board[r][c] === null) {
        full = false;
        break;
      }
    }
    if (full) fullCols.push(c);
  }

  return { rows: fullRows, cols: fullCols };
}

export function countLines(lines: CompletedLines): number {
  return lines.rows.length + lines.cols.length;
}

/** Cells covered by the given complete lines, de-duplicated. */
export function lineCoords(board: Board, lines: CompletedLines): Coord[] {
  const { rows, columns } = boardSize(board);
  const seen = new Set<string>();
  const out: Coord[] = [];
  const push = (row: number, col: number) => {
    const key = coordKey(row, col);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ row, col });
  };
  for (const r of lines.rows) for (let c = 0; c < columns; c += 1) push(r, c);
  for (const c of lines.cols) for (let r = 0; r < rows; r += 1) push(r, c);
  return out;
}

/** Cells a bomb tile destroys: the 3x3 neighbourhood around it. */
function bombArea(board: Board, origin: Coord): Coord[] {
  const { rows, columns } = boardSize(board);
  const out: Coord[] = [];
  for (let r = origin.row - 1; r <= origin.row + 1; r += 1) {
    for (let c = origin.col - 1; c <= origin.col + 1; c += 1) {
      if (r < 0 || c < 0 || r >= rows || c >= columns) continue;
      out.push({ row: r, col: c });
    }
  }
  return out;
}

/** Cells a lightning tile destroys: its full row and column. */
function lightningArea(board: Board, origin: Coord): Coord[] {
  const { rows, columns } = boardSize(board);
  const out: Coord[] = [];
  for (let c = 0; c < columns; c += 1) out.push({ row: origin.row, col: c });
  for (let r = 0; r < rows; r += 1) out.push({ row: r, col: origin.col });
  return out;
}

const AREA_POWERS: ReadonlySet<PowerType> = new Set<PowerType>(['bomb', 'lightning']);

/**
 * Resolve a turn's clears: complete lines first, then any power tiles caught in
 * them, cascading into power tiles those destroy. Cascades are bounded by the
 * board size, so this always terminates.
 */
export function resolveClears(board: Board, lines: CompletedLines): ClearOutcome {
  const cleared = new Set<string>();
  const clearedCells: Coord[] = [];
  const triggers: PowerTrigger[] = [];

  const markCleared = (coord: Coord): boolean => {
    const key = coordKey(coord.row, coord.col);
    if (cleared.has(key)) return false;
    if (board[coord.row][coord.col] === null) return false;
    cleared.add(key);
    clearedCells.push(coord);
    return true;
  };

  // Queue of cells whose power effect still needs to fire.
  const pending: Coord[] = [];

  for (const coord of lineCoords(board, lines)) {
    if (markCleared(coord)) pending.push(coord);
  }

  while (pending.length > 0) {
    const coord = pending.shift() as Coord;
    const cell = board[coord.row][coord.col];
    if (!cell || !cell.power) continue;

    const power = cell.power;
    const affected: Coord[] = [];

    if (AREA_POWERS.has(power)) {
      const area = power === 'bomb' ? bombArea(board, coord) : lightningArea(board, coord);
      for (const target of area) {
        if (target.row === coord.row && target.col === coord.col) continue;
        if (markCleared(target)) {
          affected.push(target);
          pending.push(target);
        }
      }
    }

    triggers.push({ type: power, origin: coord, affected });
  }

  const next = cloneBoard(board);
  for (const coord of clearedCells) {
    next[coord.row][coord.col] = null;
  }

  return {
    board: next,
    clearedCells,
    lines,
    triggers,
    perfectClear: clearedCells.length > 0 && countFilled(next) === 0,
  };
}

/** Convenience: detect and resolve in one step. */
export function clearLines(board: Board): ClearOutcome {
  return resolveClears(board, findCompletedLines(board));
}
