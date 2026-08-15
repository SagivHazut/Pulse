import { calculateCoins } from './scoring/scoring';
import { xpFromRun } from './progression';

/**
 * Reconciling a run against what has already been credited.
 *
 * A run is banked to the profile the moment it ends, so a force-quit can never
 * cost the player their score. But a rewarded revive *resumes* that same run,
 * which means the run ends — and gets banked — more than once.
 *
 * Without reconciliation the second bank would pay for the whole run again:
 * coins, XP, lines cleared and games played would all double, and a player could
 * farm coins by reviving. These functions turn the second commit into a delta.
 */

/** What has already been credited to the profile for the current run. */
export type BankedRun = {
  score: number;
  lines: number;
  bestCombo: number;
  /** True once this run has been counted in `totalGames`. */
  counted: boolean;
};

export const EMPTY_BANKED_RUN: BankedRun = {
  score: 0,
  lines: 0,
  bestCombo: 0,
  counted: false,
};

export type RunState = {
  score: number;
  lines: number;
  bestCombo: number;
};

export type RunDelta = {
  /** Coins still owed for this run. */
  coins: number;
  /** XP still owed for this run. */
  xp: number;
  /** Lines not yet added to the lifetime total. */
  lines: number;
  /** Whether this commit should increment `totalGames`. */
  countGame: boolean;
};

/**
 * What the profile still owes for `run`, given what was already banked.
 *
 * Coins and XP are computed as "total earned minus total already paid" rather
 * than from the raw deltas, so the non-linear parts of both formulas (combo
 * bonuses, integer flooring) reconcile exactly instead of drifting.
 */
export function runDelta(run: RunState, banked: BankedRun): RunDelta {
  const coinsEarnedTotal = calculateCoins(run.score, run.bestCombo);
  const coinsAlreadyPaid = calculateCoins(banked.score, banked.bestCombo);

  const xpEarnedTotal = xpFromRun(run.score, run.lines);
  const xpAlreadyPaid = xpFromRun(banked.score, banked.lines);

  return {
    coins: Math.max(0, coinsEarnedTotal - coinsAlreadyPaid),
    xp: Math.max(0, xpEarnedTotal - xpAlreadyPaid),
    lines: Math.max(0, run.lines - banked.lines),
    countGame: !banked.counted,
  };
}

/** The banked record after a commit. */
export function bankRun(run: RunState): BankedRun {
  return {
    score: run.score,
    lines: run.lines,
    bestCombo: run.bestCombo,
    counted: true,
  };
}
