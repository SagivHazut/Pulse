import { ADS_CONFIG, REVIVE_CONFIG } from '../../constants/config';
import { createRng } from '../../utils/rng';
import {
  interstitialVerdict,
  rollInterstitialGap,
  shouldShowInterstitial,
  type InterstitialPacing,
  type PacingConfig,
} from '../adPacing';

const CONFIG: PacingConfig = { gracePeriodGames: 5, cooldownMs: 180_000 };
const NOW = 1_700_000_000_000;

function pacing(over: Partial<InterstitialPacing> = {}): InterstitialPacing {
  return {
    totalGamesCompleted: 20,
    gamesSinceInterstitial: 5,
    nextInterstitialGap: 3,
    lastInterstitialAt: 0,
    adInFlight: false,
    ...over,
  };
}

describe('interstitial pacing', () => {
  it('shows one when every gate passes', () => {
    expect(shouldShowInterstitial(pacing(), NOW, CONFIG)).toBe(true);
  });

  it('never shows while another ad is on screen', () => {
    expect(interstitialVerdict(pacing({ adInFlight: true }), NOW, CONFIG)).toBe('ad_in_flight');
  });

  /**
   * The most important rule in the file. A new player who meets an unskippable
   * ad in their first sessions churns, and with no IAP a churned player earns
   * nothing at all.
   */
  it('shows nothing during the new-player grace period', () => {
    for (let games = 0; games <= CONFIG.gracePeriodGames; games += 1) {
      expect(
        interstitialVerdict(pacing({ totalGamesCompleted: games }), NOW, CONFIG),
      ).toBe('grace_period');
    }
    expect(
      shouldShowInterstitial(
        pacing({ totalGamesCompleted: CONFIG.gracePeriodGames + 1 }),
        NOW,
        CONFIG,
      ),
    ).toBe(true);
  });

  it('waits for the randomised game gap', () => {
    expect(
      interstitialVerdict(
        pacing({ gamesSinceInterstitial: 2, nextInterstitialGap: 3 }),
        NOW,
        CONFIG,
      ),
    ).toBe('gap_not_reached');
    expect(
      shouldShowInterstitial(
        pacing({ gamesSinceInterstitial: 3, nextInterstitialGap: 3 }),
        NOW,
        CONFIG,
      ),
    ).toBe(true);
  });

  it('respects the cooldown even when the game gap is met', () => {
    const justShown = pacing({ lastInterstitialAt: NOW - 1000 });
    expect(interstitialVerdict(justShown, NOW, CONFIG)).toBe('cooling_down');

    const longAgo = pacing({ lastInterstitialAt: NOW - CONFIG.cooldownMs - 1 });
    expect(shouldShowInterstitial(longAgo, NOW, CONFIG)).toBe(true);
  });

  it('is exact at the cooldown boundary', () => {
    const atEdge = pacing({ lastInterstitialAt: NOW - CONFIG.cooldownMs });
    expect(shouldShowInterstitial(atEdge, NOW, CONFIG)).toBe(true);
  });

  /**
   * `lastInterstitialAt: 0` means "never shown". Treating it as a real timestamp
   * would block the very first interstitial for anyone whose clock is near the
   * epoch, and — more practically — it is the value a fresh save carries.
   */
  it('does not treat "never shown" as recent', () => {
    expect(shouldShowInterstitial(pacing({ lastInterstitialAt: 0 }), NOW, CONFIG)).toBe(true);
  });

  it('reports the first failing gate, in priority order', () => {
    const allBad = pacing({
      adInFlight: true,
      totalGamesCompleted: 0,
      gamesSinceInterstitial: 0,
      lastInterstitialAt: NOW,
    });
    expect(interstitialVerdict(allBad, NOW, CONFIG)).toBe('ad_in_flight');
  });
});

describe('rollInterstitialGap', () => {
  it('stays inside the configured range', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const gap = rollInterstitialGap(createRng(seed));
      expect(gap).toBeGreaterThanOrEqual(ADS_CONFIG.interstitialEveryGamesMin);
      expect(gap).toBeLessThanOrEqual(ADS_CONFIG.interstitialEveryGamesMax);
      expect(Number.isInteger(gap)).toBe(true);
    }
  });

  it('actually varies, so the cadence is not predictable', () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 200; seed += 1) seen.add(rollInterstitialGap(createRng(seed)));
    expect(seen.size).toBeGreaterThan(1);
  });
});

/**
 * With no IAP, rewarded ads are the entire revenue model — so the settings that
 * govern them should not drift back to something timid by accident.
 */
describe('the ads-only revenue model stays intact', () => {
  it('keeps the revive placement alive at all', () => {
    // The largest rewarded placement in the game. The cap is a deliberate
    // product decision, so this guards the floor — that it is never quietly
    // turned off — rather than demanding a particular number.
    expect(REVIVE_CONFIG.MAX_REVIVES_PER_RUN).toBeGreaterThanOrEqual(1);
  });

  it('never lets a single run be revived indefinitely', () => {
    // Every revive extends the *same* run, so an uncapped revive would make the
    // high-score table a measure of ads watched.
    expect(REVIVE_CONFIG.MAX_REVIVES_PER_RUN).toBeLessThanOrEqual(3);
  });

  it('protects the first sessions from unskippable ads', () => {
    expect(ADS_CONFIG.gracePeriodGames).toBeGreaterThanOrEqual(5);
  });

  it('keeps interstitials rare and cooled down', () => {
    expect(ADS_CONFIG.interstitialEveryGamesMin).toBeGreaterThanOrEqual(3);
    expect(ADS_CONFIG.INTERSTITIAL_COOLDOWN_MS).toBeGreaterThanOrEqual(120_000);
  });
});
