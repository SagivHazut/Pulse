import { Platform } from 'react-native';

import { track } from '../analytics';
import { resolveCanRequestAds, resolvePrivacyOptionsRequired } from './consentRules';
import { adsConsentAvailable } from './native';

/**
 * Ad consent: Google's User Messaging Platform (UMP) plus iOS App Tracking
 * Transparency.
 *
 * Two rules from the brief shape this file:
 *
 *  - **Never prompt on launch.** `prepareConsent` runs at boot but only *reads*
 *    the stored status; it shows nothing. The form and the ATT prompt appear from
 *    `ensureConsentForAds`, which the ad facade calls the first time an ad is
 *    actually about to be offered — a moment the player initiated.
 *  - **Never block gameplay.** Every path resolves. A missing SDK, a form that
 *    will not load, no network — all degrade to "ads may run non-personalised",
 *    and the game is unaffected either way.
 *
 * Written against the real `AdsConsent` surface of react-native-google-mobile-ads
 * (`gatherConsent`, `getConsentInfo`, `showPrivacyOptionsForm`,
 * `getPurposeConsents`), but still required lazily so the bundle works in Expo Go
 * and on web where the native module does not exist.
 */

export type ConsentState = {
  /** True once UMP has been consulted at least once this session. */
  gathered: boolean;
  /** UMP's verdict on whether ads may be requested at all. */
  canRequestAds: boolean;
  /** False means ads must be requested non-personalised. */
  personalized: boolean;
  /** True when the law requires an ongoing way to change consent (EEA/UK). */
  privacyOptionsRequired: boolean;
  /** iOS only: the App Tracking Transparency prompt has been answered. */
  trackingAsked: boolean;
  trackingAllowed: boolean;
};

const INITIAL: ConsentState = {
  gathered: false,
  // Optimistic by design: with no consent framework present — most of the world,
  // and every build without the SDK — ads are allowed but non-personalised.
  canRequestAds: true,
  personalized: false,
  privacyOptionsRequired: false,
  trackingAsked: false,
  trackingAllowed: false,
};

let state: ConsentState = { ...INITIAL };
let inFlight: Promise<ConsentState> | null = null;

type ConsentInfo = {
  canRequestAds?: boolean;
  privacyOptionsRequirementStatus?: string;
  isConsentFormAvailable?: boolean;
  status?: string;
};

type AdsConsentApi = {
  gatherConsent?: () => Promise<ConsentInfo>;
  getConsentInfo?: () => Promise<ConsentInfo>;
  showPrivacyOptionsForm?: () => Promise<ConsentInfo>;
  getPurposeConsents?: () => Promise<string>;
};

function loadAdsConsent(): AdsConsentApi | null {
  // Probe first — see native.ts. Importing the SDK without its native module
  // throws, and that throw is what produced a red overlay in Expo Go.
  if (!adsConsentAvailable()) return null;
  try {
    const mod = require('react-native-google-mobile-ads') as { AdsConsent?: AdsConsentApi };
    return mod?.AdsConsent ?? null;
  } catch {
    return null;
  }
}

function loadTracking() {
  try {
    return require('expo-tracking-transparency') as {
      requestTrackingPermissionsAsync?: () => Promise<{ granted: boolean }>;
    };
  } catch {
    return null;
  }
}

/**
 * UMP purpose 1 is "store and/or access information on a device". Without it
 * there is no legal basis for personalised ads, so we stay non-personalised even
 * when the SDK says ads can be requested.
 */
async function readPersonalisation(consent: AdsConsentApi): Promise<boolean> {
  try {
    const purposes = await consent.getPurposeConsents?.();
    if (typeof purposes !== 'string' || purposes.length === 0) return false;
    return purposes.startsWith('1');
  } catch {
    return false;
  }
}

function applyInfo(info: ConsentInfo | undefined): void {
  if (__DEV__) {
    // The summary in `ad_consent_resolved` says *that* ads were refused, not why.
    // `status` and `isConsentFormAvailable` are what distinguish "consent required
    // and not given" from "no message published in the AdMob console".
    console.log('[ads] consent info', JSON.stringify(info ?? null));
  }
  if (!info) return;
  state.canRequestAds = resolveCanRequestAds(info, state.canRequestAds);
  state.privacyOptionsRequired = resolvePrivacyOptionsRequired(info, state.privacyOptionsRequired);
}

/** Read the stored consent status without showing anything. Safe at boot. */
export async function prepareConsent(): Promise<ConsentState> {
  const consent = loadAdsConsent();
  if (!consent?.getConsentInfo) return state;
  try {
    applyInfo(await consent.getConsentInfo());
    state.personalized = await readPersonalisation(consent);
  } catch {
    // Leave the optimistic defaults in place.
  }
  return state;
}

/**
 * Show the consent form and the ATT prompt if needed, once per session.
 *
 * Called immediately before the first ad. Later calls return the cached result,
 * so only the first ad pays any latency.
 */
export async function ensureConsentForAds(): Promise<ConsentState> {
  if (state.gathered) return state;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const consent = loadAdsConsent();

    if (consent?.gatherConsent) {
      try {
        // gatherConsent = requestInfoUpdate + show-the-form-if-required.
        applyInfo(await consent.gatherConsent());
        state.personalized = await readPersonalisation(consent);
      } catch {
        // A form that will not load must not cost the player their reward.
      }
    }

    // ATT comes after UMP, per Google's guidance, and only on iOS.
    if (Platform.OS === 'ios' && !state.trackingAsked) {
      const tracking = loadTracking();
      if (tracking?.requestTrackingPermissionsAsync) {
        try {
          const result = await tracking.requestTrackingPermissionsAsync();
          state.trackingAllowed = result?.granted ?? false;
        } catch {
          state.trackingAllowed = false;
        }
      }
      state.trackingAsked = true;
    }

    state.gathered = true;
    track('ad_consent_resolved', {
      personalized: state.personalized,
      can_request_ads: state.canRequestAds,
      tracking_allowed: state.trackingAllowed,
    });
    inFlight = null;
    return state;
  })();

  return inFlight;
}

/**
 * Re-open the consent choices — the "Ad preferences" control in Settings.
 *
 * Where GDPR applies, offering an ongoing way to change consent is a
 * requirement, not a courtesy, which is why this exists even though the app
 * sells nothing. Returns false when UMP has no form to show, so the caller can
 * say something honest instead of opening nothing.
 */
export async function openPrivacyOptions(): Promise<boolean> {
  const consent = loadAdsConsent();
  if (!consent?.showPrivacyOptionsForm) return false;
  try {
    applyInfo(await consent.showPrivacyOptionsForm());
    state.personalized = await readPersonalisation(consent);
    track('settings_changed', {
      setting: 'ad_preferences',
      value: state.personalized ? 'personalized' : 'non_personalized',
    });
    return true;
  } catch {
    return false;
  }
}

export function consentState(): ConsentState {
  return state;
}

/** Whether Settings should offer the ad-preferences control at all. */
export function privacyOptionsAvailable(): boolean {
  return state.privacyOptionsRequired;
}

/** What the ad request should ask for. Defaults to the privacy-preserving option. */
export function shouldRequestNonPersonalizedAds(): boolean {
  return !state.personalized;
}

/** UMP can forbid ads entirely; respect that rather than requesting anyway. */
export function adsAllowed(): boolean {
  return state.canRequestAds;
}

/** Test seam. */
export function __resetConsent(): void {
  state = { ...INITIAL };
  inFlight = null;
}
