import {
  CHROME_HEIGHT,
  MAX_BOARD_WIDTH,
  MIN_BOARD_SIZE,
  computeBoardMetricsWith,
} from '../boardMetrics';

/** Device pixel rounding is a platform concern; whole pixels are fine here. */
const computeBoardMetrics = (width: number, height: number) =>
  computeBoardMetricsWith(width, height, Math.round);

/**
 * Board sizing across real device shapes.
 *
 * The bug these lock down: the board used to be sized from `height * 0.46 + 60`,
 * a budget unrelated to the space the surrounding chrome actually occupies. On a
 * 320x640 device that produced a board taller than the room available, and since
 * the board is centred in a flex parent it overflowed upwards and painted over
 * the score — "BEST" was visibly cut in half.
 */

/** Width, height and a name, in density-independent pixels. */
const DEVICES: readonly { name: string; width: number; height: number }[] = [
  { name: 'small Android (320x640)', width: 320, height: 640 },
  { name: 'common Android (360x800)', width: 360, height: 800 },
  { name: 'iPhone 17 (402x874)', width: 402, height: 874 },
  { name: 'large phone (430x932)', width: 430, height: 932 },
  { name: 'tablet (834x1112)', width: 834, height: 1112 },
];

describe('computeBoardMetrics', () => {
  it.each(DEVICES)('leaves room for the chrome on $name', ({ width, height }) => {
    const { boardSize } = computeBoardMetrics(width, height);
    expect(boardSize).toBeLessThanOrEqual(height - CHROME_HEIGHT);
  });

  it.each(DEVICES)('keeps the board inside the width on $name', ({ width, height }) => {
    const { boardSize } = computeBoardMetrics(width, height);
    expect(boardSize).toBeLessThanOrEqual(width);
  });

  it.each(DEVICES)('stays playable on $name', ({ width, height }) => {
    const { boardSize, cellSize } = computeBoardMetrics(width, height);
    expect(boardSize).toBeGreaterThanOrEqual(MIN_BOARD_SIZE);
    // A cell smaller than this cannot be reliably hit with a fingertip.
    expect(cellSize).toBeGreaterThanOrEqual(20);
  });

  it('never exceeds the tablet cap', () => {
    const { boardSize } = computeBoardMetrics(1200, 1600);
    expect(boardSize).toBeLessThanOrEqual(MAX_BOARD_WIDTH);
  });

  it('grows with the viewport rather than jumping', () => {
    const small = computeBoardMetrics(320, 640).boardSize;
    const medium = computeBoardMetrics(360, 800).boardSize;
    const large = computeBoardMetrics(430, 932).boardSize;
    expect(small).toBeLessThan(medium);
    expect(medium).toBeLessThanOrEqual(large);
  });

  it.each(DEVICES)('fits the grid inside the board on $name', ({ width, height }) => {
    const { boardSize, cellSize, gap } = computeBoardMetrics(width, height);
    // Per-cell rounding can eat into the padding, which is what the padding is
    // for. What must never happen is the grid overflowing the board itself.
    const grid = cellSize * 8 + gap * 7;
    expect(grid).toBeLessThanOrEqual(boardSize);
  });

  it('keeps stride consistent with cell size and gap', () => {
    const { cellSize, cellStride, gap } = computeBoardMetrics(402, 874);
    expect(cellStride).toBe(cellSize + gap);
  });
});
