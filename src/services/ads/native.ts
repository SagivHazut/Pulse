import { TurboModuleRegistry } from 'react-native';

/**
 * Is the Google Mobile Ads native side actually present?
 *
 * `react-native-google-mobile-ads` resolves fine in JavaScript but calls
 * `TurboModuleRegistry.getEnforcing` at import time, which **throws** when the
 * native binary lacks the module — the situation in Expo Go and on web. Even
 * caught, that throw surfaces as a red error overlay in development.
 *
 * `TurboModuleRegistry.get` answers the same question by returning null instead
 * of throwing, so the whole SDK can be probed without touching it. Every lazy
 * require of the ad SDK goes through this first.
 *
 * The same pattern guards MMKV in `services/storage`.
 */

/** Modules this app actually needs: core, rewarded, interstitial, consent. */
const REQUIRED_MODULES = [
  'RNGoogleMobileAdsModule',
  'RNGoogleMobileAdsRewardedModule',
  'RNGoogleMobileAdsInterstitialModule',
] as const;

const CONSENT_MODULE = 'RNGoogleMobileAdsConsentModule';

function has(name: string): boolean {
  try {
    return TurboModuleRegistry.get(name) != null;
  } catch {
    return false;
  }
}

let adsCache: boolean | null = null;
let consentCache: boolean | null = null;

/** True when the ad SDK can actually be used in this binary. */
export function googleMobileAdsAvailable(): boolean {
  if (adsCache === null) adsCache = REQUIRED_MODULES.every(has);
  return adsCache;
}

/** True when the UMP consent module is present. */
export function adsConsentAvailable(): boolean {
  if (consentCache === null) consentCache = has(CONSENT_MODULE);
  return consentCache;
}
