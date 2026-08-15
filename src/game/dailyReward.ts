import { DAILY_REWARD } from '../constants/config';
import { defaultRng, randomInt, type Rng } from '../utils/rng';

/** Local calendar day as YYYY-MM-DD. Local on purpose — no backend, no clock sync. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysBetween(fromKey: string, toKey: string): number {
  const from = new Date(`${fromKey}T00:00:00`);
  const to = new Date(`${toKey}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return Number.NaN;
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export type DailyState = {
  /** 1-based day of the seven-day cycle the player is about to claim. */
  day: number;
  claimable: boolean;
  /** Coins for the upcoming day. Day 7 is rolled at claim time. */
  amount: number;
  streak: number;
};

export function dailyRewardAmount(day: number, rng: Rng = defaultRng): number {
  const index = Math.max(0, Math.min(DAILY_REWARD.cycle.length - 1, day - 1));
  if (index === DAILY_REWARD.cycle.length - 1) {
    return randomInt(rng, DAILY_REWARD.mysteryMin, DAILY_REWARD.mysteryMax);
  }
  return DAILY_REWARD.cycle[index];
}

/**
 * Work out where the player sits in the seven-day cycle.
 * Same day → nothing to claim. Next day → streak continues. Any longer gap → reset.
 */
export function evaluateDaily(
  lastClaimKey: string | null,
  currentStreak: number,
  today: Date = new Date(),
): DailyState {
  const todayKey = dayKey(today);

  if (!lastClaimKey) {
    return { day: 1, claimable: true, amount: DAILY_REWARD.cycle[0], streak: 0 };
  }

  const gap = daysBetween(lastClaimKey, todayKey);

  if (!Number.isFinite(gap) || gap < 0) {
    // Clock moved backwards or the stored key is junk — offer day 1, don't punish.
    return { day: 1, claimable: true, amount: DAILY_REWARD.cycle[0], streak: 0 };
  }

  if (gap === 0) {
    const day = ((currentStreak - 1) % DAILY_REWARD.cycle.length) + 1;
    return {
      day: Math.max(1, day),
      claimable: false,
      amount: DAILY_REWARD.cycle[Math.max(0, day - 1)],
      streak: currentStreak,
    };
  }

  const streak = gap === 1 ? currentStreak : 0;
  const day = (streak % DAILY_REWARD.cycle.length) + 1;
  return {
    day,
    claimable: true,
    amount: DAILY_REWARD.cycle[day - 1],
    streak,
  };
}
