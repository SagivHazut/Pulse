/**
 * Pure decision rules for interpreting a UMP consent payload.
 *
 * Kept free of React Native imports so it can be unit-tested on plain Node,
 * like the rest of the game's decision logic.
 */

export type ConsentInfoLike = {
  canRequestAds?: boolean;
  status?: string;
  isConsentFormAvailable?: boolean;
  privacyOptionsRequirementStatus?: string;
};

/**
 * Whether UMP actually has an opinion about this app.
 *
 * `UNKNOWN` status with no form available is not a refusal — it is the state of
 * an app that has no consent message published in the AdMob console, which is
 * also the normal state for the majority of the world where no consent framework
 * applies. Treating it as a refusal is indistinguishable from a legal "no".
 */
export function isConsentUnresolved(info: ConsentInfoLike | undefined | null): boolean {
  if (!info) return true;
  const status = info.status ?? 'UNKNOWN';
  return status === 'UNKNOWN' && info.isConsentFormAvailable !== true;
}

/**
 * Decide whether ads may be requested.
 *
 * When UMP has a verdict, it wins — including a refusal. When it has nothing to
 * say, ads are allowed but non-personalised: the privacy-preserving option that
 * still lets the app earn. The failure mode this avoids is a brand-new AdMob app
 * silently serving zero ads because `canRequestAds` defaulted to false before any
 * message was ever published.
 */
export function resolveCanRequestAds(
  info: ConsentInfoLike | undefined | null,
  previous: boolean,
): boolean {
  if (isConsentUnresolved(info)) return true;
  if (typeof info?.canRequestAds === 'boolean') return info.canRequestAds;
  return previous;
}

/** Whether the law requires an ongoing way to change consent (EEA/UK). */
export function resolvePrivacyOptionsRequired(
  info: ConsentInfoLike | undefined | null,
  previous: boolean,
): boolean {
  const status = info?.privacyOptionsRequirementStatus;
  if (typeof status !== 'string' || status === 'UNKNOWN') return previous;
  return status === 'REQUIRED';
}
