import Constants from 'expo-constants';

/** App-level identity and outbound links. */

export const APP_NAME = 'Pulse Blocks';

/**
 * Read from the app config rather than duplicated here.
 *
 * A hardcoded copy silently drifts the moment `app.json` is bumped, and the
 * version Settings shows is the one a player quotes in a bug report — a wrong
 * one sends you looking at the wrong build. The literal is only a fallback for
 * environments with no config (plain unit tests).
 */
export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export type LegalLinks = {
  privacy: string;
  support: string;
};

/**
 * Legal links live in `app.json` under `extra.legal`, not in code.
 *
 * They depend on where you host the page, which is a deployment decision rather
 * than a source change — and keeping them in config lets `npm run preflight`
 * refuse to ship while they are still empty.
 *
 * The privacy URL is no longer what the app *opens* — Settings renders the
 * policy natively from `legalContent.ts`. It is still required, because both
 * store listings and the AdMob account demand a publicly reachable one, and
 * the in-app screen prints it so a reader can find the canonical copy.
 *
 * There is no terms link: neither store requires one, and Apple applies its
 * Standard EULA to apps that supply none.
 */
function readLegalLinks(): LegalLinks {
  const configured = Constants.expoConfig?.extra?.legal as Partial<LegalLinks> | undefined;
  const clean = (value: unknown): string =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';

  return {
    privacy: clean(configured?.privacy),
    support: clean(configured?.support),
  };
}

export const LEGAL_LINKS: LegalLinks = readLegalLinks();

/** Whether a configured link is safe to show. */
export function hasLink(url: string): boolean {
  return url.length > 0;
}
