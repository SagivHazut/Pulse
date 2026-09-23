import {
  CHROME_HEIGHT,
  MAX_BOARD_WIDTH,
  MIN_BOARD_SIZE,
  TUTORIAL_CARD_HEIGHT,
  canReserveHeight,
  computeBoardMetricsWith,
  tutorialReserve,
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

  /**
   * The tutorial card sits in the layout between the board and the tray. Before
   * this was reserved, the board kept its full size and the card covered the
   * lower rows — while instructing the player to drag a piece onto them.
   */
  describe('with the tutorial card visible', () => {
    const TUTORIAL_HEIGHT = 100;

    it.each(DEVICES)('shrinks the board to make room on $name', ({ width, height }) => {
      const plain = computeBoardMetricsWith(width, height, Math.round).boardSize;
      const withCard = computeBoardMetricsWith(width, height, Math.round, TUTORIAL_HEIGHT)
        .boardSize;
      expect(withCard).toBeLessThanOrEqual(plain);
    });

    it('reserves the space wherever it genuinely fits', () => {
      // 800dp is the common budget-Android height and has room to spare.
      expect(canReserveHeight(800, TUTORIAL_HEIGHT)).toBe(true);
      const { boardSize } = computeBoardMetricsWith(360, 800, Math.round, TUTORIAL_HEIGHT);
      expect(boardSize).toBeLessThanOrEqual(800 - CHROME_HEIGHT - TUTORIAL_HEIGHT);
    });

    it('declines to reserve where the board would drop below playable', () => {
      // 320x640: chrome plus a playable board already fills the screen, so the
      // caller is told to overlay instead of shrinking the grid to 15dp cells.
      expect(canReserveHeight(640, TUTORIAL_HEIGHT)).toBe(false);
      expect(canReserveHeight(640, 0)).toBe(true);
    });

    it('never shrinks below the playable floor', () => {
      // An absurd reservation must not produce an unusable grid.
      const { boardSize } = computeBoardMetricsWith(320, 640, Math.round, 400);
      expect(boardSize).toBe(MIN_BOARD_SIZE);
    });

    /**
     * Regression, and the reason `tutorialReserve` takes a boolean.
     *
     * GameScreen used to pass the card's own *measured* height to
     * `canReserveHeight`. The card is a ~132dp block when the answer is yes and
     * a ~43dp pill when it is no, so the decision depended on its own outcome:
     * tall card -> "no room" -> short pill -> "room!" -> tall card. Measured
     * live at 360x720 as 39 flips in 40 frames and 30k DOM mutations in 405ms.
     *
     * These assertions fail for any implementation that reserves what the card
     * measures instead of what the decision was made against.
     */
    it('reserves the whole budgeted card or nothing at all', () => {
      for (let height = 560; height <= 1024; height += 1) {
        const reserved = tutorialReserve(height, true);

        // Never a measured height — only the amount the decision used.
        expect([0, TUTORIAL_CARD_HEIGHT]).toContain(reserved);

        if (reserved > 0) {
          // Reserving it still leaves a playable board.
          expect(height - CHROME_HEIGHT - reserved).toBeGreaterThanOrEqual(MIN_BOARD_SIZE);
        } else {
          // And we only declined because reserving would not have.
          expect(height - CHROME_HEIGHT - TUTORIAL_CARD_HEIGHT).toBeLessThan(MIN_BOARD_SIZE);
        }
      }
    });

    it('reserves nothing while the card is not on screen', () => {
      for (const height of [640, 720, 800, 900, 1024]) {
        expect(tutorialReserve(height, false)).toBe(0);
        expect(computeBoardMetricsWith(360, height, Math.round, 0).boardSize).toBe(
          computeBoardMetricsWith(360, height, Math.round, tutorialReserve(height, false))
            .boardSize,
        );
      }
    });

    /**
     * The band where a measured height and the budgeted one disagree — i.e.
     * exactly where the old code oscillated. Pinned so the constants cannot
     * drift back into overlapping it unnoticed.
     */
    it('pins the band where the pill and the card would disagree', () => {
      const PILL = 43;
      const low = CHROME_HEIGHT + MIN_BOARD_SIZE + PILL; // 683
      const high = CHROME_HEIGHT + MIN_BOARD_SIZE + TUTORIAL_CARD_HEIGHT; // 772

      expect(low).toBe(683);
      expect(high).toBe(772);

      // Inside the band the two inputs give opposite answers.
      for (const height of [low, 700, 720, 740, high - 1]) {
        expect(canReserveHeight(height, PILL)).toBe(true);
        expect(canReserveHeight(height, TUTORIAL_CARD_HEIGHT)).toBe(false);
        // The reservation follows the card, not the pill.
        expect(tutorialReserve(height, true)).toBe(0);
      }

      // Outside it they agree, so nothing could have oscillated there anyway.
      expect(canReserveHeight(low - 1, PILL)).toBe(false);
      expect(canReserveHeight(high, TUTORIAL_CARD_HEIGHT)).toBe(true);
      expect(tutorialReserve(high, true)).toBe(TUTORIAL_CARD_HEIGHT);
    });

    /**
     * The whole point of reserving: the board gives up exactly what was
     * reserved. The earlier version of this only asserted `<=`, which passes
     * when `reserved` is ignored entirely.
     *
     * Measured where the *height* budget binds — on a narrow phone the board is
     * capped by width instead, so the reservation is real but invisible.
     */
    it('gives the reserved height back to the column, exactly', () => {
      const width = 600;
      const height = 800;
      const reserved = tutorialReserve(height, true);
      expect(reserved).toBe(TUTORIAL_CARD_HEIGHT);

      const plain = computeBoardMetricsWith(width, height, Math.round, 0).boardSize;
      const withCard = computeBoardMetricsWith(width, height, Math.round, reserved).boardSize;

      // Guard the premise: both sides must be height-limited, not width-limited.
      expect(plain).toBe(height - CHROME_HEIGHT);
      expect(withCard).toBe(plain - TUTORIAL_CARD_HEIGHT);
    });

    it('ignores a negative reservation', () => {
      const plain = computeBoardMetricsWith(402, 874, Math.round).boardSize;
      expect(computeBoardMetricsWith(402, 874, Math.round, -50).boardSize).toBe(plain);
    });
  });

  it('keeps stride consistent with cell size and gap', () => {
    const { cellSize, cellStride, gap } = computeBoardMetrics(402, 874);
    expect(cellStride).toBe(cellSize + gap);
  });
});
