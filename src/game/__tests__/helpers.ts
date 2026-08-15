import type { Board, BlockColorId, CellState, Piece, PieceCell, PowerType } from '../../types';

const POWER_CHARS: Record<string, PowerType> = {
  B: 'bomb',
  L: 'lightning',
  R: 'rainbow',
  F: 'freeze',
  P: 'pulse',
};

function charToCell(ch: string): CellState {
  if (ch === '.') return null;
  if (ch === '#') return { colorId: 'aqua', power: null };
  const power = POWER_CHARS[ch];
  if (power) return { colorId: 'aqua', power };
  throw new Error(`Unknown board char "${ch}"`);
}

/** Build a board from ASCII rows. '.' empty, '#' filled, B/L/R/F/P power tiles. */
export function makeBoard(rows: string[]): Board {
  return rows.map((row) => row.split('').map(charToCell));
}

export function boardToAscii(board: Board): string[] {
  return board.map((row) =>
    row
      .map((cell) => {
        if (!cell) return '.';
        if (!cell.power) return '#';
        const entry = Object.entries(POWER_CHARS).find(([, v]) => v === cell.power);
        return entry ? entry[0] : '#';
      })
      .join(''),
  );
}

export function emptyRows(rows: number, columns: number): string[] {
  return new Array(rows).fill('.'.repeat(columns));
}

let id = 0;

/** Build a piece from ASCII rows using the same characters as {@link makeBoard}. */
export function makePiece(rows: string[], colorId: BlockColorId = 'aqua'): Piece {
  const cells: PieceCell[] = [];
  rows.forEach((row, r) => {
    row.split('').forEach((ch, c) => {
      if (ch === '.') return;
      cells.push({ r, c, power: ch === '#' ? null : (POWER_CHARS[ch] ?? null) });
    });
  });
  id += 1;
  return {
    id: `t${id}`,
    shapeId: 'test',
    cells,
    width: Math.max(...rows.map((r) => r.length)),
    height: rows.length,
    colorId,
  };
}
