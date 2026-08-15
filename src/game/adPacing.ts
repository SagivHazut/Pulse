import { ADS_CONFIG } from '../constants/config';

/**
 * When an interstitial may appear.
 *
 * Extracted from the store as a pure function because it is a *promise* to the
 * player, not an implementation detail: never in the first few sessions, never
 * more than once every few games, never twice inside the cooldown. A rule like
 * that is worth testing directly rather than inferring from behaviour.
 *
 * Interstitials are the only ad the player does not choose, so this is the one
 * piece of monetisation logic that can cost retention. Everything else in the
 * game is opt-in.
 */
export type InterstitialPacing = {
  /** Runs completed across the player's whole history. */
  totalGamesCompleted: number;
  /** Runs completed since the last interstitial. */
  gamesSinceInterstitial: number;
  /** Randomised target gap, re-rolled after each interstitial. */
  nextInterstitialGap: number;
  /** Epoch ms of the last interstitial, or 0 if never. */
  lastInterstitialAt: number;
  /** True while any ad is on screen. */
  adInFlight: boolean;
};

export type PacingConfig = {
  gracePeriodGames: number;
  cooldownMs: number;
};

export const DEFAULT_PACING: PacingConfig = {
  gracePeriodGames: ADS_CONFIG.gracePeriodGames,
  cooldownMs: ADS_CONFIG.INTERSTITIAL_COOLDOWN_MS,
};

/** Why an interstitial was withheld. Useful for reasoning and for tests. */
export type PacingVerdict =
  | 'show'
  | 'ad_in_flight'
  | 'grace_period'
  | 'gap_not_reached'
  | 'cooling_down';

export function interstitialVerdict(
  state: InterstitialPacing,
  now: number,
  config: PacingConfig = DEFAULT_PACING,
): PacingVerdict {
  if (state.adInFlight) return 'ad_in_flight';
  if (state.totalGamesCompleted <= config.gracePeriodGames) return 'grace_period';
  if (state.gamesSinceInterstitial < state.nextInterstitialGap) return 'gap_not_reached';
  // A zero timestamp means "never shown", which must not be treated as recent.
  if (state.lastInterstitialAt > 0 && now - state.lastInterstitialAt < config.cooldownMs) {
    return 'cooling_down';
  }
  return 'show';
}

export function shouldShowInterstitial(
  state: InterstitialPacing,
  now: number,
  config: PacingConfig = DEFAULT_PACING,
): boolean {
  return interstitialVerdict(state, now, config) === 'show';
}

/** A randomised gap reads as less of a toll booth than a fixed cadence. */
export function rollInterstitialGap(random: () => number = Math.random): number {
  const { interstitialEveryGamesMin: min, interstitialEveryGamesMax: max } = ADS_CONFIG;
  return min + Math.floor(random() * (max - min + 1));
}
