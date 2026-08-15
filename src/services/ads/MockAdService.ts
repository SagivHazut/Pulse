import type { RewardType } from '../../types';
import type { AdService, RewardResult } from './AdService';
import { presentMockAd } from './mockAdPresenter';

/**
 * Development ad provider.
 *
 * Used only when the real SDK is unavailable — Expo Go, web, or a build without
 * the ad package — and only in development, so a shipped app never shows a
 * placeholder to a real player.
 *
 * It presents a visible placeholder and waits for a real decision, rather than
 * silently resolving after a timer. That means the *dismissed* path (close early,
 * earn nothing) is something you can test on purpose instead of waiting for a
 * random roll, which is how reward-integrity bugs get caught before release.
 */
export type MockAdOptions = {
  /** Chance an ad fails to fill, so the "Ad unavailable" path stays exercised. */
  fillFailureRate?: number;
  loadDelayMs?: number;
  /** How long the placeholder makes you watch before the reward unlocks. */
  rewardedDurationMs?: number;
  interstitialDurationMs?: number;
};

const DEFAULTS: Required<MockAdOptions> = {
  // Low, but not zero: no-fill is a normal condition worth meeting occasionally.
  fillFailureRate: 0.05,
  loadDelayMs: 300,
  rewardedDurationMs: 3000,
  interstitialDurationMs: 1500,
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class MockAdService implements AdService {
  readonly name = 'mock';

  private options: Required<MockAdOptions>;
  private rewardedReady = false;
  private interstitialReady = false;

  constructor(options: MockAdOptions = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  async initialize(): Promise<void> {
    await wait(60);
    await Promise.all([this.preloadRewarded(), this.preloadInterstitial()]);
  }

  async preloadRewarded(): Promise<void> {
    await wait(this.options.loadDelayMs);
    this.rewardedReady = Math.random() > this.options.fillFailureRate;
  }

  async preloadInterstitial(): Promise<void> {
    await wait(this.options.loadDelayMs);
    this.interstitialReady = Math.random() > this.options.fillFailureRate;
  }

  isRewardedReady(): boolean {
    return this.rewardedReady;
  }

  isInterstitialReady(): boolean {
    return this.interstitialReady;
  }

  async showRewarded(type: RewardType): Promise<RewardResult> {
    if (!this.rewardedReady) {
      void this.preloadRewarded();
      return { earned: false, reason: 'unavailable' };
    }
    this.rewardedReady = false;

    const outcome = await presentMockAd('rewarded', {
      rewardType: type,
      durationMs: this.options.rewardedDurationMs,
    });
    void this.preloadRewarded();

    // Mirrors the real SDK: only a completed view earns the reward.
    return outcome === 'completed' ? { earned: true } : { earned: false, reason: 'dismissed' };
  }

  async showInterstitial(): Promise<boolean> {
    if (!this.interstitialReady) {
      void this.preloadInterstitial();
      return false;
    }
    this.interstitialReady = false;

    await presentMockAd('interstitial', {
      durationMs: this.options.interstitialDurationMs,
    });
    void this.preloadInterstitial();
    return true;
  }
}
