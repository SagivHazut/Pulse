import {
  availableFormats,
  isPlausibleUnitId,
  isTestUnitIds,
  resolveUnitIds,
  TEST_UNIT_IDS,
  UNIT_CONFIG_KEYS,
} from '../../services/ads/adUnits';

/** Development: unconfigured formats fall back to Google's test units. */
const DEV = { allowTestFallback: true };
/** Release: unconfigured formats are disabled outright. */
const PROD = { allowTestFallback: false };

const REAL = {
  iosRewardedUnitId: 'ca-app-pub-1234567890123456/1111111111',
  iosInterstitialUnitId: 'ca-app-pub-1234567890123456/2222222222',
  androidRewardedUnitId: 'ca-app-pub-1234567890123456/3333333333',
  androidInterstitialUnitId: 'ca-app-pub-1234567890123456/4444444444',
};

describe('resolveUnitIds', () => {
  it('reads configured ids per platform', () => {
    expect(resolveUnitIds(REAL, 'ios', DEV)).toEqual({
      rewarded: REAL.iosRewardedUnitId,
      interstitial: REAL.iosInterstitialUnitId,
    });
    expect(resolveUnitIds(REAL, 'android', DEV)).toEqual({
      rewarded: REAL.androidRewardedUnitId,
      interstitial: REAL.androidInterstitialUnitId,
    });
  });

  it('never mixes one platform up with the other', () => {
    const iosOnly = {
      iosRewardedUnitId: REAL.iosRewardedUnitId,
      iosInterstitialUnitId: REAL.iosInterstitialUnitId,
    };
    expect(resolveUnitIds(iosOnly, 'android', DEV)).toEqual(TEST_UNIT_IDS.android);
  });

  it('falls back to test units for missing or empty config', () => {
    for (const bad of [undefined, null, {}, 'nope', 42, { admob: {} }]) {
      expect(resolveUnitIds(bad, 'ios', DEV)).toEqual(TEST_UNIT_IDS.ios);
    }
    expect(resolveUnitIds({ iosRewardedUnitId: '' }, 'ios', DEV)).toEqual(TEST_UNIT_IDS.ios);
  });

  /**
   * The single most common AdMob setup mistake: the App ID uses a `~`, unit ids
   * use a `/`. Pasting the App ID here would otherwise fail at request time with
   * an opaque error; instead it falls back and is reported as a test build.
   */
  it('rejects an App ID pasted where a unit id belongs', () => {
    const appIdByMistake = { iosRewardedUnitId: 'ca-app-pub-1234567890123456~1111111111' };
    expect(resolveUnitIds(appIdByMistake, 'ios', DEV).rewarded).toBe(TEST_UNIT_IDS.ios.rewarded);
  });

  it('rejects other malformed values', () => {
    for (const bad of [
      'ca-app-pub-123/456',
      'pub-1234567890123456/1111111111',
      'ca-app-pub-1234567890123456/',
      '/1111111111',
      'ca-app-pub-1234567890123456/abcdefghij',
    ]) {
      expect(resolveUnitIds({ iosRewardedUnitId: bad }, 'ios', DEV).rewarded).toBe(
        TEST_UNIT_IDS.ios.rewarded,
      );
    }
  });

  it('tolerates stray whitespace from copy-paste', () => {
    const padded = { iosRewardedUnitId: `  ${REAL.iosRewardedUnitId}  ` };
    expect(resolveUnitIds(padded, 'ios', DEV).rewarded).toBe(REAL.iosRewardedUnitId);
  });

  it('resolves each unit independently, so one typo does not lose both', () => {
    const half = {
      iosRewardedUnitId: REAL.iosRewardedUnitId,
      iosInterstitialUnitId: 'garbage',
    };
    const units = resolveUnitIds(half, 'ios', DEV);
    expect(units.rewarded).toBe(REAL.iosRewardedUnitId);
    expect(units.interstitial).toBe(TEST_UNIT_IDS.ios.interstitial);
  });

  it('pins the config key names app.json must use', () => {
    expect(UNIT_CONFIG_KEYS).toEqual({
      ios: { rewarded: 'iosRewardedUnitId', interstitial: 'iosInterstitialUnitId' },
      android: {
        rewarded: 'androidRewardedUnitId',
        interstitial: 'androidInterstitialUnitId',
      },
    });
  });
});

/**
 * The configuration this project is actually shipping first: a rewarded unit and
 * no interstitial. It has to disable interstitials, not silently serve Google's
 * test inventory, which earns nothing and breaches AdMob policy.
 */
describe('release builds disable unconfigured formats', () => {
  const rewardedOnly = { iosRewardedUnitId: REAL.iosRewardedUnitId };

  it('keeps the configured format and nulls the missing one', () => {
    expect(resolveUnitIds(rewardedOnly, 'ios', PROD)).toEqual({
      rewarded: REAL.iosRewardedUnitId,
      interstitial: null,
    });
  });

  it('reports which formats are available', () => {
    expect(availableFormats(resolveUnitIds(rewardedOnly, 'ios', PROD))).toEqual({
      rewarded: true,
      interstitial: false,
    });
  });

  it('never substitutes a test unit in release, however broken the config', () => {
    for (const bad of [undefined, null, {}, { iosRewardedUnitId: 'garbage' }]) {
      const units = resolveUnitIds(bad, 'ios', PROD);
      expect(units.rewarded).toBeNull();
      expect(units.interstitial).toBeNull();
      expect(isTestUnitIds(units, 'ios')).toBe(false);
    }
  });

  it('still substitutes test units in development, so the SDK can be exercised', () => {
    const units = resolveUnitIds(rewardedOnly, 'ios', DEV);
    expect(units.interstitial).toBe(TEST_UNIT_IDS.ios.interstitial);
    expect(isTestUnitIds(units, 'ios')).toBe(true);
  });

  it('treats a rewarded-interstitial id as just another unit id', () => {
    // It is well-formed, so validation cannot catch the format mismatch — only
    // the console's Format column can. Documented here so the limitation is known.
    expect(isPlausibleUnitId('ca-app-pub-8814533566660025/9008124847')).toBe(true);
  });
});

describe('isTestUnitIds', () => {
  it('flags a build that is even partly on test inventory', () => {
    expect(isTestUnitIds({ ...TEST_UNIT_IDS.ios }, 'ios')).toBe(true);
    expect(
      isTestUnitIds(
        { rewarded: REAL.iosRewardedUnitId, interstitial: TEST_UNIT_IDS.ios.interstitial },
        'ios',
      ),
    ).toBe(true);
    expect(
      isTestUnitIds(
        { rewarded: REAL.iosRewardedUnitId, interstitial: REAL.iosInterstitialUnitId },
        'ios',
      ),
    ).toBe(false);
  });
});

describe('isPlausibleUnitId', () => {
  it('accepts a real unit id and nothing else', () => {
    expect(isPlausibleUnitId(REAL.iosRewardedUnitId)).toBe(true);
    expect(isPlausibleUnitId(TEST_UNIT_IDS.ios.rewarded)).toBe(true);
    expect(isPlausibleUnitId(undefined)).toBe(false);
    expect(isPlausibleUnitId('')).toBe(false);
    expect(isPlausibleUnitId(123)).toBe(false);
  });
});
