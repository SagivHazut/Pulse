import { THEMES } from '../../theme/themes';
import { xpForLevel, xpFromRun } from '../progression';
import { calculateCoins } from '../scoring/scoring';

/**
 * Guards the shape of the cosmetic economy.
 *
 * These are not arbitrary assertions — the first version of the ladder needed
 * ~300 runs to reach the last theme, which is dead content nobody would ever
 * see. This suite fails if a future tuning change re-creates that, or inverts
 * the intended relationship between levels and coins.
 *
 * A "decent run" is the yardstick: 5,000 points, 18 lines, best combo 6.
 */
const DECENT_RUN = { score: 5000, lines: 18, bestCombo: 6 };

const xpPerRun = xpFromRun(DECENT_RUN.score, DECENT_RUN.lines);
const coinsPerRun = calculateCoins(DECENT_RUN.score, DECENT_RUN.bestCombo);

/** Runs needed to afford every theme up to and including `index`. */
function runsForCoins(index: number): number {
  const cumulative = THEMES.slice(0, index + 1).reduce((sum, t) => sum + t.price, 0);
  return cumulative / coinsPerRun;
}

function runsForLevel(index: number): number {
  return xpForLevel(THEMES[index].unlockLevel) / xpPerRun;
}

describe('cosmetic economy pacing', () => {
  it('gives a decent run a meaningful amount of both currencies', () => {
    expect(xpPerRun).toBeGreaterThan(50);
    expect(coinsPerRun).toBeGreaterThan(20);
  });

  it('starts with a free theme', () => {
    expect(THEMES[0].price).toBe(0);
    expect(THEMES[0].unlockLevel).toBe(1);
  });

  it('prices themes in ascending order', () => {
    for (let i = 1; i < THEMES.length; i += 1) {
      expect(THEMES[i].price).toBeGreaterThan(THEMES[i - 1].price);
      expect(THEMES[i].unlockLevel).toBeGreaterThanOrEqual(THEMES[i - 1].unlockLevel);
    }
  });

  it('puts the first paid theme within reach of a new player', () => {
    expect(runsForCoins(1)).toBeLessThanOrEqual(10);
    expect(runsForLevel(1)).toBeLessThanOrEqual(10);
  });

  it('keeps the most expensive theme a long-term goal, not an unreachable one', () => {
    const last = THEMES.length - 1;
    expect(runsForCoins(last)).toBeGreaterThan(60);
    expect(runsForCoins(last)).toBeLessThan(220);
  });

  /**
   * Coins are meant to be the price and levels merely a gate. If a level gate
   * landed *after* the coins were affordable, the player would be sitting on
   * money they cannot spend — which is the complaint that started all this.
   */
  it('makes coins the binding constraint at every rung, not levels', () => {
    THEMES.forEach((theme, index) => {
      if (index === 0) return;
      expect(runsForLevel(index)).toBeLessThanOrEqual(runsForCoins(index));
    });
  });

  it('spaces the ladder so each unlock is a fresh goal', () => {
    for (let i = 2; i < THEMES.length; i += 1) {
      expect(runsForCoins(i)).toBeGreaterThan(runsForCoins(i - 1) * 1.15);
    }
  });

  it('gives every theme a complete palette', () => {
    const colorIds = ['aqua', 'violet', 'coral', 'lime', 'amber', 'rose', 'sky'] as const;
    for (const theme of THEMES) {
      expect(theme.particles.length).toBeGreaterThanOrEqual(3);
      expect(theme.backdrop).toHaveLength(3);
      for (const id of colorIds) {
        const block = theme.blocks[id];
        expect(block.base).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(block.light).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(block.dark).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it('gives every theme a unique id', () => {
    const ids = THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
