import {
  applyPowerUp,
  consumePowerUp,
  emptyInventory,
  grantPowerUp,
} from '../powerups/powerups';
import { boardToAscii, makeBoard } from './helpers';

describe('applyPowerUp', () => {
  it('bomb clears the 3x3 around the target', () => {
    const board = makeBoard(['####', '####', '####', '####']);
    const result = applyPowerUp(board, 'bomb', { row: 1, col: 1 });
    expect(boardToAscii(result.board)).toEqual(['...#', '...#', '...#', '####']);
    expect(result.clearedCells).toHaveLength(9);
  });

  it('bomb clips correctly at the board edge', () => {
    const board = makeBoard(['####', '####', '####', '####']);
    const result = applyPowerUp(board, 'bomb', { row: 0, col: 0 });
    expect(result.clearedCells).toHaveLength(4);
  });

  it('lightning clears the whole row and column', () => {
    const board = makeBoard(['####', '####', '####', '####']);
    const result = applyPowerUp(board, 'lightning', { row: 2, col: 1 });
    expect(boardToAscii(result.board)).toEqual(['#.##', '#.##', '....', '#.##']);
    expect(result.clearedCells).toHaveLength(7);
  });

  it('ignores already-empty cells', () => {
    const board = makeBoard(['....', '....', '....', '....']);
    const result = applyPowerUp(board, 'bomb', { row: 1, col: 1 });
    expect(result.clearedCells).toHaveLength(0);
  });

  it('does not mutate the input board', () => {
    const board = makeBoard(['####', '####', '####', '####']);
    applyPowerUp(board, 'lightning', { row: 0, col: 0 });
    expect(boardToAscii(board)).toEqual(['####', '####', '####', '####']);
  });
});

describe('inventory', () => {
  it('grants and consumes', () => {
    const inv = grantPowerUp(emptyInventory(), 'bomb', 2);
    expect(inv.bomb).toBe(2);
    const after = consumePowerUp(inv, 'bomb');
    expect(after?.bomb).toBe(1);
  });

  it('refuses to consume what the player does not have', () => {
    expect(consumePowerUp(emptyInventory(), 'lightning')).toBeNull();
  });
});
