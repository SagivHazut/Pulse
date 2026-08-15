import type { RewardType } from '../../types';
import type { AdService, RewardResult } from './AdService';

/**
 * The provider used in a release build when the real SDK cannot start.
 *
 * It reports every format as unavailable, which the game already handles: revive
 * offers hide themselves, and coin doublers are simply not offered. That is the
 * honest outcome — better than the mock, which would show a "TEST AD" placeholder
 * to a real player and grant rewards no advertiser paid for.
 */
export class NullAdService implements AdService {
  readonly name = 'none';

  async initialize(): Promise<void> {}
  async preloadRewarded(): Promise<void> {}
  async preloadInterstitial(): Promise<void> {}

  isRewardedReady(): boolean {
    return false;
  }

  isInterstitialReady(): boolean {
    return false;
  }

  async showRewarded(_type: RewardType): Promise<RewardResult> {
    return { earned: false, reason: 'unavailable' };
  }

  async showInterstitial(): Promise<boolean> {
    return false;
  }
}
