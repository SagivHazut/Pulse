import {
  isConsentUnresolved,
  resolveCanRequestAds,
  resolvePrivacyOptionsRequired,
} from '../../services/ads/consentRules';

/**
 * These rules decide whether the app earns anything at all, so the distinction
 * they encode matters: a UMP *refusal* must be obeyed, but UMP having *nothing to
 * say* must not be mistaken for one.
 *
 * Found on a real device: a brand-new AdMob app with no consent message published
 * returns `{status: 'UNKNOWN', canRequestAds: false, isConsentFormAvailable:
 * false}`, which silently disabled every ad in the app.
 */

describe('isConsentUnresolved', () => {
  it('treats UNKNOWN status with no form as unresolved', () => {
    expect(
      isConsentUnresolved({ status: 'UNKNOWN', isConsentFormAvailable: false }),
    ).toBe(true);
  });

  it('treats a missing payload as unresolved', () => {
    expect(isConsentUnresolved(undefined)).toBe(true);
    expect(isConsentUnresolved(null)).toBe(true);
  });

  it('is resolved once a form exists, even with UNKNOWN status', () => {
    // A form is available: UMP does have a configuration for this app.
    expect(isConsentUnresolved({ status: 'UNKNOWN', isConsentFormAvailable: true })).toBe(false);
  });

  it('is resolved for any known status', () => {
    expect(isConsentUnresolved({ status: 'REQUIRED' })).toBe(false);
    expect(isConsentUnresolved({ status: 'OBTAINED' })).toBe(false);
    expect(isConsentUnresolved({ status: 'NOT_REQUIRED' })).toBe(false);
  });
});

describe('resolveCanRequestAds', () => {
  it('allows ads when UMP has no configuration for the app', () => {
    // The exact payload observed on device. Must not disable ads.
    expect(
      resolveCanRequestAds(
        {
          status: 'UNKNOWN',
          privacyOptionsRequirementStatus: 'UNKNOWN',
          canRequestAds: false,
          isConsentFormAvailable: false,
        },
        true,
      ),
    ).toBe(true);
  });

  it('obeys a genuine refusal', () => {
    expect(
      resolveCanRequestAds(
        { status: 'REQUIRED', canRequestAds: false, isConsentFormAvailable: true },
        true,
      ),
    ).toBe(false);
  });

  it('obeys a genuine approval', () => {
    expect(
      resolveCanRequestAds(
        { status: 'OBTAINED', canRequestAds: true, isConsentFormAvailable: true },
        false,
      ),
    ).toBe(true);
  });

  it('keeps the previous value when a resolved payload omits the flag', () => {
    expect(resolveCanRequestAds({ status: 'NOT_REQUIRED' }, false)).toBe(false);
    expect(resolveCanRequestAds({ status: 'NOT_REQUIRED' }, true)).toBe(true);
  });
});

describe('resolvePrivacyOptionsRequired', () => {
  it('requires privacy options only when UMP says REQUIRED', () => {
    expect(resolvePrivacyOptionsRequired({ privacyOptionsRequirementStatus: 'REQUIRED' }, false)).toBe(
      true,
    );
    expect(
      resolvePrivacyOptionsRequired({ privacyOptionsRequirementStatus: 'NOT_REQUIRED' }, true),
    ).toBe(false);
  });

  it('does not downgrade a previous requirement on an UNKNOWN reading', () => {
    // UNKNOWN is absence of information, so a known REQUIRED must survive it —
    // dropping the control where the law demands it is the worse failure.
    expect(
      resolvePrivacyOptionsRequired({ privacyOptionsRequirementStatus: 'UNKNOWN' }, true),
    ).toBe(true);
    expect(resolvePrivacyOptionsRequired({}, false)).toBe(false);
  });
});
