import {
  assertBoardIsPlausible,
  assertPayoffIsReachable,
  demoBoard,
  demoTray,
} from '../demoFixture';
import { findCompletedLines } from '../../../game/engine/lines';
import { findValidPlacements, placePiece } from '../../../game/engine/placement';
import type { BlockColorId, Board } from '../../../types';

const COLOR: Record<string, BlockColorId> = {
  a: 'aqua',
  v: 'violet',
  c: 'coral',
  l: 'lime',
  m: 'amber',
  r: 'rose',
  s: 'sky',
  p: 'violet',
};

/** Same ASCII convention as the fixture, so a counter-example reads the same way. */
function build(rows: string[]): Board {
  return rows.map((row) => [...row].map((ch) => (COLOR[ch] ? { colorId: COLOR[ch], power: null } : null)));
}

describe('the board the store screenshots are taken from', () => {
  it('is a state the engine could actually produce', () => {
    expect(() => assertBoardIsPlausible(demoBoard())).not.toThrow();
  });

  it('offers the line clear the tray is composed to promise', () => {
    expect(() => assertPayoffIsReachable(demoBoard(), demoTray())).not.toThrow();
  });

  it('hands the player a full tray', () => {
    expect(demoTray().filter(Boolean)).toHaveLength(3);
  });

  it('puts a bomb in the tray, so the power mechanic is visible', () => {
    const bombs = demoTray().flatMap((piece) => piece?.cells ?? []).filter((cell) => cell.power === 'bomb');
    expect(bombs).toHaveLength(1);
  });
});

describe('the assertions actually reject the mistakes they were written for', () => {
  it('rejects a complete row — it would have cleared before anyone saw it', () => {
    expect(() =>
      assertBoardIsPlausible(
        build(['........', '........', '........', '........', '........', '........', '........', 'llmmrrpp']),
      ),
    ).toThrow(/row 7 is complete/);
  });

  it('rejects a complete column', () => {
    expect(() =>
      assertBoardIsPlausible(build(Array.from({ length: 8 }, () => 'l.......'))),
    ).toThrow(/column 0 is complete/);
  });

  it('rejects a board with no clear available at all', () => {
    // Nothing in the tray can finish a line here, so the shot would show a
    // board mid-slog rather than one about to pay off.
    const flat = build([
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      'll......',
    ]);
    expect(() => assertPayoffIsReachable(flat, demoTray())).toThrow(/no tray piece can clear a line/);
  });
});

describe('the specific promise the tray is composed around', () => {
  // The fixture's first version got this wrong: the domino was annotated as
  // completing row 5, but row 5 was drawn one cell short, so a two-wide piece
  // could not go there. `assertPayoffIsReachable` missed it, because two other
  // tray pieces still happened to clear a column. Only the specific claim
  // catches it.
  it('lets the domino complete row 5, the row it is drawn for', () => {
    const board = demoBoard();
    const domino = demoTray().find((piece) => piece?.shapeId === 'i2-h');
    expect(domino).toBeDefined();

    const clears = findValidPlacements(board, domino!)
      .map((at) => findCompletedLines(placePiece(board, domino!, at.row, at.col).board))
      .filter((lines) => lines.rows.includes(5));

    expect(clears).not.toHaveLength(0);
  });
});
