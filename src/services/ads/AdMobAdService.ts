import type { RewardType } from '../../types';
import { AD_UNIT_IDS, type AdService, type RewardResult } from './AdService';
import { shouldRequestNonPersonalizedAds } from './consent';
import { googleMobileAdsAvailable } from './native';

/**
 * Google AdMob adapter.
 *
 * `react-native-google-mobile-ads` is a native module that cannot run in Expo
 * Go, so it is required lazily and every entry point degrades gracefully when it
 * is absent. Install it and rebuild the dev client to activate this provider —
 * see "Ad configuration" in the README.
 *
 * Reward integrity: `earned` is set only from the SDK's own EARNED_REWARD event.
 * A user closing the ad early resolves as `dismissed`, never as earned.
 */

type AdEventListener = () => void;

type RewardedAdInstance = {
  load(): void;
  show(): Promise<void>;
  loaded: boolean;
  addAdEventListener(type: string, listener: (payload?: unknown) => void): AdEventListener;
};

type RequestConfiguration = {
  testDeviceIdentifiers?: string[];
  maxAdContentRating?: string;
  tagForChildDirectedTreatment?: boolean;
  tagForUnderAgeOfConsent?: boolean;
};

type MobileAdsModule = {
  default: () => {
    initialize(): Promise<unknown>;
    setRequestConfiguration?(config: RequestConfiguration): Promise<unknown>;
  };
  RewardedAd: {
    createForAdRequest(unitId: string, options?: object): RewardedAdInstance;
  };
  InterstitialAd: {
    createForAdRequest(unitId: string, options?: object): RewardedAdInstance;
  };
  RewardedAdEventType: { LOADED: string; EARNED_REWARD: string };
  AdEventType: { LOADED: string; CLOSED: string; ERROR: string };
  MaxAdContentRating?: Record<string, string>;
};

function loadModule(): MobileAdsModule | null {
  // Probe the native side first: importing the SDK without it throws, and even a
  // caught throw shows a red error overlay in development. See native.ts.
  if (!googleMobileAdsAvailable()) return null;
  try {
    const mod = require('react-native-google-mobile-ads') as Partial<MobileAdsModule>;
    // Metro resolves this to an empty module when the SDK is not installed
    // (see metro.config.js), so check for a real export rather than truthiness.
    if (!mod || typeof mod.default !== 'function' || !mod.RewardedAd) return null;
    return mod as MobileAdsModule;
  } catch {
    return null;
  }
}

/** Best-effort readable form of the SDK's error payload, for development logs. */
function describeAdError(payload: unknown): string {
  if (payload == null) return 'unknown error';
  if (typeof payload === 'string') return payload;
  const err = payload as { code?: unknown; message?: unknown };
  const parts = [err.code, err.message].filter((v) => typeof v === 'string' && v.length > 0);
  if (parts.length > 0) return parts.join(' — ');
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

export type AdMobOptions = {
  /** Null disables the format — no requests are made for it at all. */
  rewardedUnitId?: string | null;
  interstitialUnitId?: string | null;
};

export class AdMobAdService implements AdService {
  readonly name = 'admob';

  private mod: MobileAdsModule | null = null;
  private rewarded: RewardedAdInstance | null = null;
  private interstitial: RewardedAdInstance | null = null;
  private rewardedLoaded = false;
  private interstitialLoaded = false;
  private options: { rewardedUnitId: string | null; interstitialUnitId: string | null };

  constructor(options: AdMobOptions = {}) {
    this.options = {
      rewardedUnitId: options.rewardedUnitId ?? AD_UNIT_IDS.rewarded,
      interstitialUnitId: options.interstitialUnitId ?? AD_UNIT_IDS.interstitial,
    };
  }

  static isAvailable(): boolean {
    return loadModule() !== null;
  }

  /**
   * Read per request rather than captured in the constructor: consent can change
   * mid-session, and the privacy-preserving option must win until it does.
   */
  private get requestOptions() {
    return { requestNonPersonalizedAdsOnly: shouldRequestNonPersonalizedAds() };
  }

  /**
   * Throws when the native SDK is present in JS but not actually usable — which
   * is exactly the situation in Expo Go, where the package resolves but the
   * native module does not exist. The facade catches it and falls back to the
   * mock provider, so rewarded flows stay testable without a dev build.
   *
   * Preload failures are *not* fatal: no fill is a normal condition.
   */
  async initialize(): Promise<void> {
    this.mod = loadModule();
    if (!this.mod) throw new Error('Google Mobile Ads SDK is not installed');

    /**
     * Mark development builds as test devices *before* initialising.
     *
     * This build uses the real, live ad unit IDs, so without this every request
     * from a developer's simulator or phone is a live request — and clicking a
     * live ad in your own app is the most common cause of an AdMob account
     * suspension. `EMULATOR` covers simulators and emulators; a physical test
     * device has to be added in the AdMob console as well.
     *
     * Test devices receive real ad creatives labelled "Test Ad", so the flow is
     * fully verifiable while no impression or click is ever billed.
     */
    if (__DEV__) {
      try {
        await this.mod.default().setRequestConfiguration?.({
          testDeviceIdentifiers: ['EMULATOR'],
          maxAdContentRating: 'T',
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
        });
      } catch {
        // Older SDKs may not expose this; fall through to a normal request.
      }
    }

    await this.mod.default().initialize();
    try {
      await Promise.all([this.preloadRewarded(), this.preloadInterstitial()]);
    } catch {
      // Nothing to fill right now; the formats simply report as not ready.
    }
  }

  async preloadRewarded(): Promise<void> {
    if (!this.mod || !this.options.rewardedUnitId) return;
    try {
      const ad = this.mod.RewardedAd.createForAdRequest(
        this.options.rewardedUnitId,
        this.requestOptions,
      );
      this.rewardedLoaded = false;
      ad.addAdEventListener(this.mod.RewardedAdEventType.LOADED, () => {
        this.rewardedLoaded = true;
      });
      ad.addAdEventListener(this.mod.AdEventType.ERROR, (payload) => {
        this.rewardedLoaded = false;
        if (__DEV__) {
          // "unavailable" on its own is undiagnosable: no-fill, a wrong unit ID and
          // an unapproved app all look identical from the game's side.
          console.warn('[ads] rewarded load error', describeAdError(payload));
        }
      });
      this.rewarded = ad;
      ad.load();
    } catch {
      this.rewardedLoaded = false;
    }
  }

  async preloadInterstitial(): Promise<void> {
    if (!this.mod || !this.options.interstitialUnitId) return;
    try {
      const ad = this.mod.InterstitialAd.createForAdRequest(
        this.options.interstitialUnitId,
        this.requestOptions,
      );
      this.interstitialLoaded = false;
      ad.addAdEventListener(this.mod.AdEventType.LOADED, () => {
        this.interstitialLoaded = true;
      });
      ad.addAdEventListener(this.mod.AdEventType.ERROR, (payload) => {
        this.interstitialLoaded = false;
        if (__DEV__) {
          console.warn('[ads] interstitial load error', describeAdError(payload));
        }
      });
      this.interstitial = ad;
      ad.load();
    } catch {
      this.interstitialLoaded = false;
    }
  }

  isRewardedReady(): boolean {
    return this.options.rewardedUnitId !== null && this.rewardedLoaded && this.rewarded !== null;
  }

  isInterstitialReady(): boolean {
    return (
      this.options.interstitialUnitId !== null &&
      this.interstitialLoaded &&
      this.interstitial !== null
    );
  }

  async showRewarded(_type: RewardType): Promise<RewardResult> {
    const mod = this.mod;
    const ad = this.rewarded;
    if (!mod || !ad || !this.rewardedLoaded) {
      void this.preloadRewarded();
      return { earned: false, reason: 'unavailable' };
    }

    return new Promise<RewardResult>((resolve) => {
      let earned = false;
      let settled = false;

      const finish = (result: RewardResult) => {
        if (settled) return;
        settled = true;
        unsubscribe();
        this.rewardedLoaded = false;
        void this.preloadRewarded();
        resolve(result);
      };

      const listeners: AdEventListener[] = [];
      const unsubscribe = () => {
        for (const off of listeners) {
          try {
            off();
          } catch {
            // listener already gone
          }
        }
      };

      try {
        listeners.push(
          ad.addAdEventListener(mod.RewardedAdEventType.EARNED_REWARD, () => {
            // The only place `earned` is ever set.
            earned = true;
          }),
          ad.addAdEventListener(mod.AdEventType.CLOSED, () => {
            finish(earned ? { earned: true } : { earned: false, reason: 'dismissed' });
          }),
          ad.addAdEventListener(mod.AdEventType.ERROR, () => {
            finish({ earned: false, reason: 'error' });
          }),
        );
        void ad.show().catch(() => finish({ earned: false, reason: 'error' }));
      } catch {
        finish({ earned: false, reason: 'error' });
      }
    });
  }

  async showInterstitial(): Promise<boolean> {
    const mod = this.mod;
    const ad = this.interstitial;
    if (!mod || !ad || !this.interstitialLoaded) {
      void this.preloadInterstitial();
      return false;
    }

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const listeners: AdEventListener[] = [];
      const finish = (shown: boolean) => {
        if (settled) return;
        settled = true;
        for (const off of listeners) {
          try {
            off();
          } catch {
            // listener already gone
          }
        }
        this.interstitialLoaded = false;
        void this.preloadInterstitial();
        resolve(shown);
      };

      try {
        listeners.push(
          ad.addAdEventListener(mod.AdEventType.CLOSED, () => finish(true)),
          ad.addAdEventListener(mod.AdEventType.ERROR, () => finish(false)),
        );
        void ad.show().catch(() => finish(false));
      } catch {
        finish(false);
      }
    });
  }
}
