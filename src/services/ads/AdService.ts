import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { RewardType } from '../../types';
import {
  availableFormats,
  isTestUnitIds,
  readForceTestUnits,
  resolveUnitIds,
  type AdPlatform,
  type UnitIds,
} from './adUnits';

/**
 * Provider-agnostic ad surface.
 *
 * UI never imports a concrete provider — it calls through this interface, so
 * swapping AdMob for AppLovin MAX (or the mock, in Expo Go) is a one-line change
 * in services/ads/index.ts.
 */
export interface AdService {
  readonly name: string;
  initialize(): Promise<void>;
  /** Resolves true only when the provider confirms the reward was earned. */
  showRewarded(type: RewardType): Promise<RewardResult>;
  showInterstitial(): Promise<boolean>;
  preloadRewarded(): Promise<void>;
  preloadInterstitial(): Promise<void>;
  isRewardedReady(): boolean;
  isInterstitialReady(): boolean;
}

export type RewardResult = {
  /** True only on a provider-confirmed completion. */
  earned: boolean;
  /** Present when the ad could not be shown or did not complete. */
  reason?: 'unavailable' | 'dismissed' | 'error' | 'no_consent';
};

export const AD_UNAVAILABLE_MESSAGE = 'Ad unavailable. Try again shortly.';

/**
 * Real unit ids come from `expo.extra.admob` in app.json, so going live is a
 * config change and a rebuild — not a source edit that could be forgotten on a
 * branch. Resolution lives in `adUnits.ts`, which is unit-tested.
 *
 * In development an unconfigured format falls back to Google's test unit so the
 * real SDK can be exercised. In release it is left `null`, which disables that
 * format outright — shipping test inventory earns nothing and breaches policy.
 * That makes "rewarded only, no interstitials" a supported configuration rather
 * than an accident.
 */
const AD_PLATFORM: AdPlatform = Platform.OS === 'ios' ? 'ios' : 'android';

const ADMOB_CONFIG = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.admob;

export const AD_UNIT_IDS: UnitIds = resolveUnitIds(ADMOB_CONFIG, AD_PLATFORM, {
  allowTestFallback: __DEV__,
  forceTestUnits: readForceTestUnits(ADMOB_CONFIG),
});

/** Which ad formats this build can actually serve. */
export const AD_FORMATS = availableFormats(AD_UNIT_IDS);

/** True while the build is still pointed at Google's test inventory. */
export function usingTestAdUnits(): boolean {
  return isTestUnitIds(AD_UNIT_IDS, AD_PLATFORM);
}

