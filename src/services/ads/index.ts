import type { RewardType } from '../../types';
import { track } from '../analytics';
import { duckMusic } from '../audio';
import {
  AD_FORMATS,
  AD_UNAVAILABLE_MESSAGE,
  AD_UNIT_IDS,
  usingTestAdUnits,
  type AdService,
  type RewardResult,
} from './AdService';
import { AdMobAdService } from './AdMobAdService';
import { adsAllowed, consentState, ensureConsentForAds, prepareConsent } from './consent';
import { MockAdService } from './MockAdService';
import { NullAdService } from './NullAdService';

/**
 * Ad facade used by the rest of the app.
 *
 * Picks the best available provider at boot, records analytics around every
 * placement, ducks the music while an ad is on screen, and — critically —
 * guarantees a reward is granted at most once per ad session.
 */

/**
 * What to use when the real SDK is not usable.
 *
 * In development that is the mock, so every rewarded flow stays testable in
 * Expo Go. In a release build it is the null provider: a shipped app must never
 * present a placeholder ad or hand out a reward nobody paid for.
 */
function fallbackService(): AdService {
  return __DEV__ ? new MockAdService() : new NullAdService();
}

let service: AdService = fallbackService();
let ready = false;

/** Monotonic id for each rewarded presentation, used to de-duplicate grants. */
let adSessionId = 0;
const grantedSessions = new Set<number>();

export function currentAdProvider(): string {
  return service.name;
}

/**
 * Upper bound on how long an ad may hold the UI hostage.
 *
 * A presentation that never resolves leaves the offering button disabled with no
 * way back — the player cannot revive and cannot dismiss, only restart the app.
 * That is reachable from a hung SDK callback, and it happens routinely during
 * development when Fast Refresh replaces the provider mid-ad.
 *
 * Generous on purpose: a real rewarded ad plus its end card can legitimately run
 * past 60s, and timing out early would deny a reward that was actually watched.
 */
const REWARDED_TIMEOUT_MS = 120_000;
const INTERSTITIAL_TIMEOUT_MS = 60_000;

/** Resolve with `onTimeout` if `promise` has not settled in time. */
async function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(onTimeout), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function initAds(): Promise<void> {
  if (ready) return;
  ready = true;

  // Reads the stored consent status without showing anything. The form and the
  // ATT prompt are deliberately deferred to the first actual ad — see consent.ts.
  try {
    await prepareConsent();
  } catch {
    // Optimistic defaults stand: ads allowed, non-personalised.
  }

  /**
   * Prefer the real SDK, but only if it genuinely works. In Expo Go the package
   * resolves in JS while the native module is missing, so `initialize()` throws —
   * and falling back to the mock keeps every rewarded flow testable there
   * instead of reporting "ad unavailable" for everything.
   */
  service = fallbackService();
  if (AdMobAdService.isAvailable()) {
    const admob = new AdMobAdService();
    try {
      await admob.initialize();
      service = admob;
    } catch {
      service = fallbackService();
    }
  }

  if (service.name !== 'admob') {
    try {
      await service.initialize();
    } catch {
      // The fallbacks cannot really fail, but never let ad setup break boot.
    }
  }

  if (__DEV__) {
    // The resolved unit ids, not just the formats: "no-fill" is impossible to
    // diagnose without knowing which unit was actually requested.
    console.log('[ads] provider', service.name, 'formats', AD_FORMATS, 'units', AD_UNIT_IDS);
  }

  if (__DEV__ && service.name === 'admob' && usingTestAdUnits()) {
    console.warn(
      '[ads] AdMob is live but still using Google test ad units. Set expo.extra.admob in app.json before release.',
    );
  }
}

export function isRewardedReady(): boolean {
  try {
    return service.isRewardedReady();
  } catch {
    return false;
  }
}

export function isInterstitialReady(): boolean {
  try {
    return service.isInterstitialReady();
  } catch {
    return false;
  }
}

export type RewardOutcome = RewardResult & {
  /** Human-readable copy to show when `earned` is false. */
  message?: string;
};

/**
 * Show a rewarded ad and report whether the reward was actually earned.
 *
 * The caller passes an `onReward` callback rather than acting on the boolean, so
 * the grant happens inside the idempotency guard: even if this is somehow called
 * twice for one presentation, the reward lands once.
 */
export async function showRewarded(
  type: RewardType,
  onReward: () => void,
): Promise<RewardOutcome> {
  adSessionId += 1;
  const session = adSessionId;

  track('rewarded_ad_offer', { reward_type: type, provider: service.name });

  // First ad of the session gathers consent. This is the contextual moment the
  // brief asks for — the player tapped a rewarded offer — not app launch.
  await ensureConsentForAds();
  if (!adsAllowed()) {
    track('rewarded_ad_failed', { reward_type: type, reason: 'no_consent' });
    return { earned: false, reason: 'no_consent', message: AD_UNAVAILABLE_MESSAGE };
  }

  if (!AD_FORMATS.rewarded || !isRewardedReady()) {
    track('rewarded_ad_failed', { reward_type: type, reason: 'unavailable' });
    return { earned: false, reason: 'unavailable', message: AD_UNAVAILABLE_MESSAGE };
  }

  track('rewarded_ad_started', { reward_type: type });
  duckMusic(true);

  let result: RewardResult;
  try {
    result = await withTimeout(service.showRewarded(type), REWARDED_TIMEOUT_MS, {
      earned: false,
      reason: 'error',
    });
  } catch {
    result = { earned: false, reason: 'error' };
  } finally {
    duckMusic(false);
  }

  if (!result.earned) {
    track('rewarded_ad_failed', { reward_type: type, reason: result.reason ?? 'error' });
    return {
      ...result,
      message: result.reason === 'dismissed' ? undefined : AD_UNAVAILABLE_MESSAGE,
    };
  }

  if (grantedSessions.has(session)) {
    // Belt and braces: a duplicate completion callback never pays out twice.
    return result;
  }
  grantedSessions.add(session);
  if (grantedSessions.size > 50) {
    grantedSessions.clear();
    grantedSessions.add(session);
  }

  track('rewarded_ad_completed', { reward_type: type });
  try {
    onReward();
  } catch {
    // A failure inside the reward handler must not look like an ad failure.
  }
  return result;
}

export async function showInterstitial(): Promise<boolean> {
  // No configured unit means this build ships without interstitials — a supported
  // setup, not a failure. Nothing is requested.
  if (!AD_FORMATS.interstitial) return false;
  // Interstitials never gather consent themselves: they are not player-initiated,
  // and a form appearing between runs unprompted is exactly what the brief rules
  // out. If consent has not been gathered yet, this one is simply skipped.
  if (!consentState().gathered || !adsAllowed()) return false;
  if (!isInterstitialReady()) return false;
  duckMusic(true);
  let shown = false;
  try {
    shown = await withTimeout(service.showInterstitial(), INTERSTITIAL_TIMEOUT_MS, false);
  } catch {
    shown = false;
  } finally {
    duckMusic(false);
  }
  if (shown) track('interstitial_shown', { provider: service.name });
  return shown;
}

export function preloadAds(): void {
  void service.preloadRewarded().catch(() => undefined);
  void service.preloadInterstitial().catch(() => undefined);
}

/** Test/debug seam: force a specific provider. */
export function __setAdService(next: AdService): void {
  service = next;
  ready = true;
}

export { AD_FORMATS, AD_UNAVAILABLE_MESSAGE, usingTestAdUnits };
export { consentState, openPrivacyOptions, privacyOptionsAvailable } from './consent';
export type { AdService, RewardResult };
