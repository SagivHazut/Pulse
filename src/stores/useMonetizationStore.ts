import { create } from 'zustand';

import { ADS_CONFIG, REVIVE_CONFIG } from '../constants/config';
import { rollInterstitialGap, shouldShowInterstitial } from '../game/adPacing';
import { getPlayerData, patchPlayerData } from '../services/storage/playerData';

/**
 * Ad pacing and eligibility.
 *
 * Every rule about *when* an ad may appear lives here — screens only ask
 * "may I?" and never do their own arithmetic. That keeps the promise in the
 * brief enforceable: interstitials stay rare, rewarded ads stay opt-in.
 */

type MonetizationState = {
  /** Completed games since the last interstitial. */
  gamesSinceInterstitial: number;
  lastInterstitialAt: number;
  /** Games to wait before the next interstitial, re-rolled after each one. */
  nextInterstitialGap: number;
  totalGamesCompleted: number;
  rescueOffersUsed: number;
  revivesUsedThisRun: number;
  /** True while an ad is on screen — blocks every other prompt. */
  adInFlight: boolean;

  hydrate(): void;
  /**
   * Starts a run's ad accounting. `usedAlready` seeds it from a resumed save, so
   * reviving, quitting and resuming cannot hand back a fresh revive budget.
   */
  beginRun(usedAlready?: number): void;
  canRevive(): boolean;
  registerRevive(): void;
  canOfferRescue(): boolean;
  registerRescueOffer(): void;
  shouldShowInterstitial(): boolean;
  registerGameCompleted(): void;
  registerInterstitialShown(): void;
  setAdInFlight(value: boolean): void;
};

export const useMonetizationStore = create<MonetizationState>((set, get) => ({
  gamesSinceInterstitial: 0,
  lastInterstitialAt: 0,
  nextInterstitialGap: rollInterstitialGap(),
  totalGamesCompleted: 0,
  rescueOffersUsed: 0,
  revivesUsedThisRun: 0,
  adInFlight: false,

  hydrate() {
    const data = getPlayerData();
    set({
      gamesSinceInterstitial: data.gamesSinceInterstitial,
      totalGamesCompleted: data.totalGames,
      lastInterstitialAt: data.lastInterstitialAt,
    });
  },

  beginRun(usedAlready = 0) {
    set({ revivesUsedThisRun: Math.max(0, usedAlready) });
  },

  canRevive() {
    return get().revivesUsedThisRun < REVIVE_CONFIG.MAX_REVIVES_PER_RUN;
  },

  registerRevive() {
    set({ revivesUsedThisRun: get().revivesUsedThisRun + 1 });
  },

  canOfferRescue() {
    return get().rescueOffersUsed < ADS_CONFIG.rescueOffersPerSession;
  },

  registerRescueOffer() {
    set({ rescueOffersUsed: get().rescueOffersUsed + 1 });
  },

  /**
   * Delegates to the pure rule in `game/adPacing.ts`, which is unit-tested:
   * a grace period for new players, a randomised game gap, a wall-clock
   * cooldown, and never while another ad is up.
   */
  shouldShowInterstitial() {
    return shouldShowInterstitial(get(), Date.now());
  },

  registerGameCompleted() {
    const s = get();
    const gamesSinceInterstitial = s.gamesSinceInterstitial + 1;
    patchPlayerData({ gamesSinceInterstitial });
    set({
      gamesSinceInterstitial,
      totalGamesCompleted: s.totalGamesCompleted + 1,
    });
  },

  registerInterstitialShown() {
    // Persisted so a restart cannot bypass the cooldown.
    const lastInterstitialAt = Date.now();
    patchPlayerData({ gamesSinceInterstitial: 0, lastInterstitialAt });
    set({
      gamesSinceInterstitial: 0,
      lastInterstitialAt,
      nextInterstitialGap: rollInterstitialGap(),
    });
  },

  setAdInFlight(value) {
    set({ adInFlight: value });
  },
}));
