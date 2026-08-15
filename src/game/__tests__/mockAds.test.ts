import { MockAdService } from '../../services/ads/MockAdService';
import {
  currentMockAd,
  presentMockAd,
  resolveMockAd,
  subscribeMockAd,
  type MockAdRequest,
} from '../../services/ads/mockAdPresenter';

/**
 * The mock ad provider's contract.
 *
 * These matter more than they look: the mock is the only thing exercising the
 * rewarded flow in Expo Go, and while it silently resolved every ad as "watched"
 * the *dismissed* path was effectively untested. The rule under test is that a
 * reward is earned only by a completed view.
 */

/** Always fills, never waits — so tests assert behaviour, not timing. */
function makeService() {
  return new MockAdService({ fillFailureRate: 0, loadDelayMs: 0 });
}

describe('mockAdPresenter', () => {
  afterEach(() => {
    // Leave no ad on screen for the next test.
    resolveMockAd('dismissed');
  });

  it('publishes the pending request to subscribers and clears it on resolve', async () => {
    const seen: (MockAdRequest | null)[] = [];
    const unsubscribe = subscribeMockAd((r) => seen.push(r));

    const pending = presentMockAd('rewarded', { rewardType: 'revive', durationMs: 1000 });
    expect(currentMockAd()).toMatchObject({ format: 'rewarded', rewardType: 'revive' });

    resolveMockAd('completed');
    await expect(pending).resolves.toBe('completed');
    expect(currentMockAd()).toBeNull();

    // Initial null, the request, then null again.
    expect(seen.map((r) => r?.format ?? null)).toEqual([null, 'rewarded', null]);
    unsubscribe();
  });

  it('dismisses an in-flight ad when a second one is presented', async () => {
    const first = presentMockAd('rewarded', { rewardType: 'revive' });
    const second = presentMockAd('interstitial');

    await expect(first).resolves.toBe('dismissed');
    expect(currentMockAd()?.format).toBe('interstitial');

    resolveMockAd('completed');
    await expect(second).resolves.toBe('completed');
  });

  it('stops notifying after unsubscribe', async () => {
    let calls = 0;
    const unsubscribe = subscribeMockAd(() => {
      calls += 1;
    });
    expect(calls).toBe(1); // current state delivered immediately
    unsubscribe();

    const pending = presentMockAd('rewarded');
    resolveMockAd('completed');
    await pending;
    expect(calls).toBe(1);
  });
});

describe('MockAdService', () => {
  it('earns the reward only when the ad is watched to completion', async () => {
    const service = makeService();
    await service.initialize();
    expect(service.isRewardedReady()).toBe(true);

    const pending = service.showRewarded('revive');
    resolveMockAd('completed');
    await expect(pending).resolves.toEqual({ earned: true });
  });

  it('earns nothing when the viewer closes early', async () => {
    const service = makeService();
    await service.initialize();

    const pending = service.showRewarded('double_coins');
    resolveMockAd('dismissed');
    await expect(pending).resolves.toEqual({ earned: false, reason: 'dismissed' });
  });

  it('reports unavailable rather than presenting when nothing is loaded', async () => {
    // Never fills: the "Ad unavailable" path must stay reachable.
    const service = new MockAdService({ fillFailureRate: 1, loadDelayMs: 0 });
    await service.initialize();

    await expect(service.showRewarded('revive')).resolves.toEqual({
      earned: false,
      reason: 'unavailable',
    });
    expect(currentMockAd()).toBeNull();
  });

  it('consumes the loaded ad so one load cannot be shown twice', async () => {
    const service = makeService();
    await service.initialize();

    const pending = service.showRewarded('revive');
    expect(service.isRewardedReady()).toBe(false);
    resolveMockAd('completed');
    await pending;
  });

  it('reports a shown interstitial once closed', async () => {
    const service = makeService();
    await service.initialize();

    const pending = service.showInterstitial();
    resolveMockAd('completed');
    await expect(pending).resolves.toBe(true);
  });
});
