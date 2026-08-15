/**
 * Resolving ad unit ids from app config.
 *
 * Pure and separately tested because the failure modes here are expensive and
 * silent. Two of them:
 *
 *  - A mistyped key, or an App ID pasted where a unit id belongs, would fail at
 *    request time with an opaque error. Here it is rejected up front.
 *  - An *unconfigured* format must be switched off in production, not quietly
 *    served from Google's test inventory — test ads in a shipped app earn nothing
 *    and breach AdMob policy. In development the test unit is exactly what you
 *    want, so the fallback is allowed there and only there.
 *
 * A `null` unit id means "this format is not available", and the ad layer treats
 * it as permanently unready rather than requesting anything.
 */

export type AdPlatform = 'ios' | 'android';
export type UnitIds = { rewarded: string | null; interstitial: string | null };

/** Google's public test units. Development only — never shipped. */
export const TEST_UNIT_IDS: Readonly<Record<AdPlatform, { rewarded: string; interstitial: string }>> =
  {
    ios: {
      rewarded: 'ca-app-pub-3940256099942544/1712485313',
      interstitial: 'ca-app-pub-3940256099942544/4411468910',
    },
    android: {
      rewarded: 'ca-app-pub-3940256099942544/5224354917',
      interstitial: 'ca-app-pub-3940256099942544/1033173712',
    },
  };

/** The exact keys expected under `expo.extra.admob`. */
export const UNIT_CONFIG_KEYS = {
  ios: { rewarded: 'iosRewardedUnitId', interstitial: 'iosInterstitialUnitId' },
  android: { rewarded: 'androidRewardedUnitId', interstitial: 'androidInterstitialUnitId' },
} as const;

/**
 * A real AdMob unit id looks like `ca-app-pub-<digits>/<digits>`.
 *
 * Checked because the most common setup mistake is pasting the *App* ID, which
 * uses a `~` rather than a `/`.
 */
export function isPlausibleUnitId(value: unknown): value is string {
  return typeof value === 'string' && /^ca-app-pub-\d{10,20}\/\d{6,12}$/.test(value.trim());
}

export type ResolveOptions = {
  /**
   * Substitute Google's test unit for anything unconfigured. True in development
   * so the real SDK can be exercised; false in release so an unconfigured format
   * is simply disabled.
   */
  allowTestFallback: boolean;
  /**
   * Ignore the configured units and use Google's test inventory for everything.
   *
   * Set `expo.extra.admob.forceTestUnits` to verify the ad plumbing when live
   * units cannot fill — a new AdMob account returns `no-fill / Publisher data not
   * found` until its payment details are complete, which is indistinguishable
   * from a broken integration without this. Honoured only when
   * `allowTestFallback` is set, so it cannot take effect in a release build even
   * if the flag is left behind in config.
   */
  forceTestUnits?: boolean;
};

/** Reads the dev-only `forceTestUnits` flag out of `expo.extra.admob`. */
export function readForceTestUnits(extra: unknown): boolean {
  if (typeof extra !== 'object' || extra === null) return false;
  return (extra as Record<string, unknown>).forceTestUnits === true;
}

export function resolveUnitIds(
  extra: unknown,
  platform: AdPlatform,
  options: ResolveOptions,
): UnitIds {
  const test = TEST_UNIT_IDS[platform];
  const missing = (fallback: string): string | null =>
    options.allowTestFallback ? fallback : null;

  // Never in release: gated on allowTestFallback, which is false there.
  if (options.allowTestFallback && options.forceTestUnits) {
    return { rewarded: test.rewarded, interstitial: test.interstitial };
  }

  if (typeof extra !== 'object' || extra === null) {
    return { rewarded: missing(test.rewarded), interstitial: missing(test.interstitial) };
  }

  const cfg = extra as Record<string, unknown>;
  const keys = UNIT_CONFIG_KEYS[platform];
  const rewarded = cfg[keys.rewarded];
  const interstitial = cfg[keys.interstitial];

  return {
    rewarded: isPlausibleUnitId(rewarded) ? rewarded.trim() : missing(test.rewarded),
    interstitial: isPlausibleUnitId(interstitial)
      ? interstitial.trim()
      : missing(test.interstitial),
  };
}

/** True when any live unit is still pointed at Google's test inventory. */
export function isTestUnitIds(units: UnitIds, platform: AdPlatform): boolean {
  const test = TEST_UNIT_IDS[platform];
  return units.rewarded === test.rewarded || units.interstitial === test.interstitial;
}

/** Formats that are actually available with this configuration. */
export function availableFormats(units: UnitIds): {
  rewarded: boolean;
  interstitial: boolean;
} {
  return { rewarded: units.rewarded !== null, interstitial: units.interstitial !== null };
}
