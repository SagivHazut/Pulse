import type { AnalyticsParams } from '../../types';

/**
 * Analytics abstraction.
 *
 * The MVP has no backend, so the only registered provider is a dev-console sink.
 * Adding Firebase Analytics (or anything else) later means writing one adapter
 * and calling `registerAnalyticsProvider` at boot — no call sites change.
 */

export type AnalyticsEvent =
  | 'app_open'
  | 'game_started'
  | 'game_finished'
  | 'game_resumed'
  | 'line_clear'
  | 'combo_level'
  | 'power_block_triggered'
  | 'power_up_used'
  | 'power_up_purchased'
  | 'near_fail'
  | 'rewarded_ad_offer'
  | 'rewarded_ad_started'
  | 'rewarded_ad_completed'
  | 'rewarded_ad_failed'
  | 'revive_used'
  | 'interstitial_shown'
  | 'daily_reward'
  | 'theme_unlocked'
  | 'theme_selected'
  | 'achievement_unlocked'
  | 'level_up'
  | 'tutorial_started'
  | 'tutorial_completed'
  | 'settings_changed'
  | 'ad_consent_resolved';

export interface AnalyticsProvider {
  readonly name: string;
  track(event: AnalyticsEvent, params?: AnalyticsParams): void;
  setUserProperty?(key: string, value: string | number | boolean): void;
}

const providers: AnalyticsProvider[] = [];
let sessionStartedAt = Date.now();

export function registerAnalyticsProvider(provider: AnalyticsProvider): void {
  if (providers.some((p) => p.name === provider.name)) return;
  providers.push(provider);
}

export function clearAnalyticsProviders(): void {
  providers.length = 0;
}

export function track(event: AnalyticsEvent, params: AnalyticsParams = {}): void {
  const enriched: AnalyticsParams = {
    ...params,
    session_seconds: Math.round((Date.now() - sessionStartedAt) / 1000),
  };
  for (const provider of providers) {
    try {
      provider.track(event, enriched);
    } catch {
      // A misbehaving analytics provider must never surface to the player.
    }
  }
}

export function setUserProperty(key: string, value: string | number | boolean): void {
  for (const provider of providers) {
    try {
      provider.setUserProperty?.(key, value);
    } catch {
      // ignored on purpose
    }
  }
}

export function resetAnalyticsSession(): void {
  sessionStartedAt = Date.now();
}

/** Dev-only sink so events are visible while building. */
export const consoleAnalyticsProvider: AnalyticsProvider = {
  name: 'console',
  track(event, params) {
    if (!__DEV__) return;
    console.log(`[analytics] ${event}`, params ?? {});
  },
};

/**
 * Example Firebase adapter — left commented so the dependency stays optional.
 *
 * import analytics from '@react-native-firebase/analytics';
 * export const firebaseAnalyticsProvider: AnalyticsProvider = {
 *   name: 'firebase',
 *   track: (event, params) => void analytics().logEvent(event, params ?? {}),
 *   setUserProperty: (k, v) => void analytics().setUserProperty(k, String(v)),
 * };
 */
