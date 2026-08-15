import { countFilled } from '../engine/board';
import { clearLines, countLines, findCompletedLines, resolveClears } from '../engine/lines';
import { boardToAscii, makeBoard } from './helpers';

describe('findCompletedLines', () => {
  it('finds a full row', () => {
    const board = makeBoard(['####', '#...', '....', '....']);
    expect(findCompletedLines(board)).toEqual({ rows: [0], cols: [] });
  });

  it('finds a full column', () => {
    const board = makeBoard(['#...', '#...', '#...', '#...']);
    expect(findCompletedLines(board)).toEqual({ rows: [], cols: [0] });
  });

  it('finds nothing on a board with gaps', () => {
    const board = makeBoard(['###.', '#...', '....', '....']);
    expect(findCompletedLines(board)).toEqual({ rows: [], cols: [] });
  });

  it('finds several rows and columns at once', () => {
    const board = makeBoard(['####', '####', '#..#', '#..#']);
    const lines = findCompletedLines(board);
    expect(lines.rows).toEqual([0, 1]);
    expect(lines.cols).toEqual([0, 3]);
    expect(countLines(lines)).toBe(4);
  });
});

describe('resolveClears', () => {
  it('removes exactly the cells on complete lines', () => {
    const board = makeBoard(['####', '#...', '#...', '#...']);
    const outcome = resolveClears(board, findCompletedLines(board));

    expect(boardToAscii(outcome.board)).toEqual(['....', '....', '....', '....']);
    expect(outcome.clearedCells).toHaveLength(7);
    expect(outcome.perfectClear).toBe(true);
  });

  it('leaves untouched cells in place', () => {
    const board = makeBoard(['####', '.#..', '....', '....']);
    const outcome = clearLines(board);
    expect(boardToAscii(outcome.board)).toEqual(['....', '.#..', '....', '....']);
    expect(outcome.perfectClear).toBe(false);
  });

  it('detonates a bomb caught in a clear', () => {
    // Row 0 completes; the bomb at (0,1) takes out the 3x3 around it.
    const board = makeBoard(['#B##', '###.', '....', '....']);
    const outcome = clearLines(board);

    expect(boardToAscii(outcome.board)).toEqual(['....', '....', '....', '....']);
    const bombTrigger = outcome.triggers.find((t) => t.type === 'bomb');
    expect(bombTrigger).toBeDefined();
    expect(bombTrigger?.origin).toEqual({ row: 0, col: 1 });
  });

  it('fires lightning across the full row and column', () => {
    const board = makeBoard(['##L#', '..#.', '..#.', '..#.']);
    const outcome = clearLines(board);
    expect(countFilled(outcome.board)).toBe(0);
    expect(outcome.triggers.some((t) => t.type === 'lightning')).toBe(true);
  });

  it('cascades a bomb into a power tile that was not on a completed line', () => {
    // Only row 0 completes. The bomb at (0,1) reaches the lightning at (1,1),
    // which then fires across its own row and column.
    const board = makeBoard(['#B##', '.L..', '#...', '...#']);
    const outcome = clearLines(board);

    expect(outcome.triggers.map((t) => t.type)).toEqual(
      expect.arrayContaining(['bomb', 'lightning']),
    );
    expect(boardToAscii(outcome.board)).toEqual(['....', '....', '#...', '...#']);
  });

  it('records rainbow and freeze triggers without destroying extra cells', () => {
    const board = makeBoard(['#R#F', '....', '....', '....']);
    const outcome = clearLines(board);
    const kinds = outcome.triggers.map((t) => t.type).sort();
    expect(kinds).toEqual(['freeze', 'rainbow']);
    for (const trigger of outcome.triggers) {
      expect(trigger.affected).toHaveLength(0);
    }
  });

  it('does nothing when there are no complete lines', () => {
    const board = makeBoard(['#...', '....', '....', '....']);
    const outcome = clearLines(board);
    expect(outcome.clearedCells).toHaveLength(0);
    expect(outcome.perfectClear).toBe(false);
    expect(boardToAscii(outcome.board)).toEqual(boardToAscii(board));
  });
});
