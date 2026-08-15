import { SCORING } from '../../constants/config';
import type { PowerTrigger } from '../../types';
import {
  calculateCoins,
  calculateScore,
  comboMultiplier,
  comboTier,
  multiLineMultiplier,
} from '../scoring/scoring';

describe('comboMultiplier', () => {
  it('is 1x for the first clear of a chain', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(1)).toBe(1);
  });

  it('grows with each combo step', () => {
    expect(comboMultiplier(2)).toBeCloseTo(1 + SCORING.comboStep);
    expect(comboMultiplier(4)).toBeCloseTo(1 + 3 * SCORING.comboStep);
  });

  it('is capped', () => {
    expect(comboMultiplier(500)).toBe(SCORING.maxComboMultiplier);
  });
});

describe('multiLineMultiplier', () => {
  it('rewards simultaneous lines', () => {
    expect(multiLineMultiplier(1)).toBe(1);
    expect(multiLineMultiplier(2)).toBe(1.5);
    expect(multiLineMultiplier(3)).toBe(2);
  });
});

describe('calculateScore', () => {
  const noTriggers: PowerTrigger[] = [];

  it('scores a placement with no clears', () => {
    const score = calculateScore({
      tilesPlaced: 4,
      linesCleared: 0,
      combo: 0,
      triggers: noTriggers,
      perfectClear: false,
    });
    expect(score.placement).toBe(40);
    expect(score.lines).toBe(0);
    expect(score.combo).toBe(0);
    expect(score.total).toBe(40);
  });

  it('scores a single line at 1x combo', () => {
    const score = calculateScore({
      tilesPlaced: 3,
      linesCleared: 1,
      combo: 1,
      triggers: noTriggers,
      perfectClear: false,
    });
    expect(score.lines).toBe(100);
    expect(score.combo).toBe(0);
    expect(score.total).toBe(130);
  });

  it('adds a combo bonus on top of the line score', () => {
    const score = calculateScore({
      tilesPlaced: 0,
      linesCleared: 1,
      combo: 3,
      triggers: noTriggers,
      perfectClear: false,
    });
    // 100 base + 100 * (multiplier - 1)
    expect(score.lines).toBe(100);
    expect(score.combo).toBe(Math.round(100 * (comboMultiplier(3) - 1)));
  });

  it('scores a double line higher than two singles', () => {
    const double = calculateScore({
      tilesPlaced: 0,
      linesCleared: 2,
      combo: 1,
      triggers: noTriggers,
      perfectClear: false,
    });
    expect(double.lines).toBe(300);
  });

  it('adds power and perfect-clear bonuses', () => {
    const score = calculateScore({
      tilesPlaced: 1,
      linesCleared: 1,
      combo: 1,
      triggers: [
        { type: 'bomb', origin: { row: 0, col: 0 }, affected: [] },
        { type: 'rainbow', origin: { row: 0, col: 1 }, affected: [] },
      ],
      perfectClear: true,
    });
    expect(score.power).toBe(SCORING.powerBonus.bomb + SCORING.powerBonus.rainbow);
    expect(score.perfectClear).toBe(SCORING.perfectClear);
    expect(score.total).toBe(
      score.placement + score.lines + score.combo + score.power + score.perfectClear,
    );
  });
});

describe('calculateCoins', () => {
  it('converts score and best combo into coins', () => {
    expect(calculateCoins(4000, 1)).toBe(Math.floor(4000 * SCORING.coinsPerPoint));
    expect(calculateCoins(0, 5)).toBe(4 * SCORING.coinsPerBestComboStep);
    expect(calculateCoins(0, 0)).toBe(0);
  });

  it('rewards a longer chain more than a shorter one at the same score', () => {
    expect(calculateCoins(5000, 8)).toBeGreaterThan(calculateCoins(5000, 2));
  });
});

describe('comboTier', () => {
  it('escalates with the combo level', () => {
    expect(comboTier(0)).toBe('none');
    expect(comboTier(1)).toBe('normal');
    expect(comboTier(3)).toBe('normal');
    expect(comboTier(5)).toBe('hype');
    expect(comboTier(12)).toBe('dramatic');
  });
});
