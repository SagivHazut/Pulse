import type { Board, Coord, PowerUpInventory, PowerUpKind, PowerType } from '../../types';
import { boardSize, cloneBoard, coordKey } from '../engine/board';

export const POWER_UP_KINDS: readonly PowerUpKind[] = ['bomb', 'lightning', 'shuffle'];

export const POWER_UP_META: Record<
  PowerUpKind,
  { label: string; glyph: string; hint: string; needsTarget: boolean }
> = {
  bomb: {
    label: 'Bomb',
    glyph: '✸',
    hint: 'Tap a cell to blast a 3×3 area',
    needsTarget: true,
  },
  lightning: {
    label: 'Bolt',
    glyph: '⚡︎',
    hint: 'Tap a cell to clear its row and column',
    needsTarget: true,
  },
  shuffle: {
    label: 'Refresh',
    glyph: '↻',
    hint: 'Swap your three pieces for new ones',
    needsTarget: false,
  },
};

export const POWER_TILE_META: Record<
  PowerType,
  { label: string; glyph: string; description: string }
> = {
  bomb: { label: 'Bomb', glyph: '✸', description: 'Blasts the cells around it when cleared' },
  lightning: { label: 'Bolt', glyph: '⚡︎', description: 'Clears its whole row and column' },
  rainbow: { label: 'Prism', glyph: '◆', description: 'Wildcard — can overlap a filled cell' },
  freeze: { label: 'Freeze', glyph: '❄︎', description: 'Protects your combo for an extra turn' },
  pulse: { label: 'Pulse', glyph: '◉', description: 'Fills the Pulse meter instantly' },
};

export function emptyInventory(): PowerUpInventory {
  return { bomb: 0, lightning: 0, shuffle: 0 };
}

export function grantPowerUp(
  inventory: PowerUpInventory,
  kind: PowerUpKind,
  amount = 1,
): PowerUpInventory {
  return { ...inventory, [kind]: inventory[kind] + amount };
}

export function consumePowerUp(
  inventory: PowerUpInventory,
  kind: PowerUpKind,
): PowerUpInventory | null {
  if (inventory[kind] <= 0) return null;
  return { ...inventory, [kind]: inventory[kind] - 1 };
}

export type PowerUpResult = {
  board: Board;
  clearedCells: Coord[];
};

/**
 * Apply a player-triggered power-up to the board. Returns the affected cells so
 * the UI can play the same burst animation a line clear uses.
 */
export function applyPowerUp(board: Board, kind: PowerUpKind, target: Coord): PowerUpResult {
  const { rows, columns } = boardSize(board);
  const seen = new Set<string>();
  const clearedCells: Coord[] = [];
  const next = cloneBoard(board);

  const destroy = (row: number, col: number) => {
    if (row < 0 || col < 0 || row >= rows || col >= columns) return;
    const key = coordKey(row, col);
    if (seen.has(key)) return;
    seen.add(key);
    if (next[row][col] === null) return;
    next[row][col] = null;
    clearedCells.push({ row, col });
  };

  if (kind === 'bomb') {
    for (let r = target.row - 1; r <= target.row + 1; r += 1) {
      for (let c = target.col - 1; c <= target.col + 1; c += 1) destroy(r, c);
    }
  } else if (kind === 'lightning') {
    for (let c = 0; c < columns; c += 1) destroy(target.row, c);
    for (let r = 0; r < rows; r += 1) destroy(r, target.col);
  }

  return { board: next, clearedCells };
}
