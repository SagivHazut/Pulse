import { PROGRESSION } from '../../constants/config';
import { createRng } from '../../utils/rng';
import { evaluateAchievements, type AchievementStats } from '../achievements';
import { dailyRewardAmount, dayKey, evaluateDaily } from '../dailyReward';
import { levelFromXp, levelProgress, xpForLevel, xpFromRun } from '../progression';
import { tensionFromOccupancy, tensionLevel } from '../tension';

describe('levels', () => {
  it('starts at level 1 with no XP', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(levelFromXp(0)).toBe(1);
  });

  it('needs increasing XP per level', () => {
    const gaps = [1, 2, 3, 4].map((n) => xpForLevel(n + 1) - xpForLevel(n));
    for (let i = 1; i < gaps.length; i += 1) {
      expect(gaps[i]).toBeGreaterThan(gaps[i - 1]);
    }
  });

  it('reports progress inside the current level', () => {
    const xp = xpForLevel(3);
    const progress = levelProgress(xp);
    expect(progress.level).toBe(3);
    expect(progress.xpIntoLevel).toBe(0);
    expect(progress.progress).toBe(0);
  });

  it('converts a run into XP from score and lines', () => {
    expect(xpFromRun(1000, 5)).toBe(
      10 * PROGRESSION.xpPerHundredPoints + 5 * PROGRESSION.xpPerLineCleared,
    );
    expect(xpFromRun(0, 0)).toBe(0);
    expect(xpFromRun(5000, 20)).toBeGreaterThan(xpFromRun(5000, 10));
  });
});

describe('achievements', () => {
  const stats: AchievementStats = {
    highScore: 12_000,
    bestCombo: 6,
    totalGames: 3,
    totalLinesCleared: 40,
    hadPerfectClear: false,
    usedPowerBlock: false,
    clearedAnyLine: true,
  };

  it('unlocks everything newly satisfied', () => {
    const ids = evaluateAchievements(stats, []).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['first_clear', 'combo_5', 'score_10k']));
    expect(ids).not.toContain('combo_10');
    expect(ids).not.toContain('score_50k');
  });

  it('never re-unlocks what the player already has', () => {
    const ids = evaluateAchievements(stats, ['first_clear', 'combo_5', 'score_10k']).map(
      (a) => a.id,
    );
    expect(ids).toHaveLength(0);
  });
});

describe('daily reward', () => {
  it('offers day 1 to a brand new player', () => {
    const state = evaluateDaily(null, 0, new Date('2026-08-08T10:00:00'));
    expect(state).toMatchObject({ day: 1, claimable: true, streak: 0 });
  });

  it('is not claimable twice on the same day', () => {
    const today = new Date('2026-08-08T22:00:00');
    const state = evaluateDaily(dayKey(today), 1, today);
    expect(state.claimable).toBe(false);
  });

  it('continues the streak the next day', () => {
    const state = evaluateDaily('2026-08-07', 3, new Date('2026-08-08T09:00:00'));
    expect(state.claimable).toBe(true);
    expect(state.streak).toBe(3);
    expect(state.day).toBe(4);
  });

  // The returned streak is what the UI must show. The stored `currentStreak`
  // passed in here is still 5 and stays 5 until a claim rewrites it, so a sheet
  // reading the stored value advertises a streak the player has already lost.
  it('resets the streak after a missed day', () => {
    const state = evaluateDaily('2026-08-01', 5, new Date('2026-08-08T09:00:00'));
    expect(state.streak).toBe(0);
    expect(state.day).toBe(1);
  });

  it('wraps around after the seventh day', () => {
    const state = evaluateDaily('2026-08-07', 7, new Date('2026-08-08T09:00:00'));
    expect(state.day).toBe(1);
  });

  it('handles a clock that moved backwards without punishing the player', () => {
    const state = evaluateDaily('2027-01-01', 4, new Date('2026-08-08T09:00:00'));
    expect(state.claimable).toBe(true);
    expect(state.day).toBe(1);
  });

  it('rolls a mystery amount on day 7', () => {
    const amount = dailyRewardAmount(7, createRng(5));
    expect(amount).toBeGreaterThanOrEqual(300);
    expect(amount).toBeLessThanOrEqual(600);
  });
});

describe('tension', () => {
  it('is calm below the warning threshold', () => {
    expect(tensionFromOccupancy(0.3)).toBe(0);
    expect(tensionLevel(0.3)).toBe('calm');
  });

  it('ramps between the thresholds and saturates', () => {
    expect(tensionFromOccupancy(0.825)).toBeCloseTo(0.5);
    expect(tensionFromOccupancy(0.95)).toBe(1);
    expect(tensionLevel(0.95)).toBe('danger');
  });
});
