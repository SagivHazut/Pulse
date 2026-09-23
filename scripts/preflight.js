#!/usr/bin/env node
/**
 * Pre-launch checks. Run before every store submission:
 *
 *   npm run preflight
 *
 * These are the mistakes that are cheap to make and expensive to discover after
 * review: a placeholder privacy URL, a debug flag left enabled, an ad unit that
 * only exists on one platform, a version string that drifted out of sync with
 * app.json. Each one has either been hit in this project or is a documented store
 * rejection, so they get a script rather than a checklist item someone skims.
 *
 * Exits non-zero if any check fails.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const failures = [];
const warnings = [];
const passes = [];

const fail = (name, detail) => failures.push(`${name}\n    ${detail}`);
const warn = (name, detail) => warnings.push(`${name}\n    ${detail}`);
const pass = (name) => passes.push(name);

const APP_ID_RE = /^ca-app-pub-\d{10,20}~\d{6,12}$/;
const UNIT_ID_RE = /^ca-app-pub-\d{10,20}\/\d{6,12}$/;
/** Google's public sample publisher. Must never appear in a release build. */
const GOOGLE_TEST_PUBLISHER = 'ca-app-pub-3940256099942544';

const config = JSON.parse(read('app.json')).expo;
const admob = config.extra?.admob ?? {};

// ---------------------------------------------------------------- legal links

const appConstants = read('src/constants/app.ts');
const legal = config.extra?.legal ?? {};

/** Reachable and not a stand-in someone forgot to replace. */
function checkLink(key, value, { scheme, required }) {
  const url = typeof value === 'string' ? value.trim() : '';
  if (url.length === 0) {
    const detail = `extra.legal.${key} is empty in app.json.`;
    if (required) fail(`${key} link not set`, detail);
    else warn(`${key} link not set`, `${detail} The Settings row is hidden until it is.`);
    return;
  }
  if (/example\.(com|org)|localhost|TODO|CHANGEME|\{\{/i.test(url)) {
    fail(`${key} link is a placeholder`, url);
    return;
  }
  if (!url.startsWith(scheme)) {
    fail(`${key} link is malformed`, `${url} should start with ${scheme}`);
    return;
  }
  pass(`${key} link set`);
}

// A reachable privacy policy is required by both stores and by AdMob policy for
// any app that shows ads. Support is advisable, not blocking. There is no terms
// link by design: neither store requires one and Apple applies its Standard EULA
// to apps that supply none.
checkLink('privacy', legal.privacy, { scheme: 'https://', required: true });
checkLink('support', legal.support, { scheme: 'mailto:', required: false });

if (/'https?:\/\/(?!.*\bexpo\b)/.test(appConstants)) {
  warn(
    'Hardcoded URL in src/constants/app.ts',
    'Legal links belong in app.json under extra.legal so they can change without a code edit.',
  );
}

// ------------------------------------------------------------ version parity

// APP_VERSION reads from the app config, so the only thing that can drift is the
// fallback literal used when no config is present.
const fallbackMatch = appConstants.match(/expoConfig\?\.version\s*\?\?\s*'([^']+)'/);
const literalMatch = appConstants.match(/APP_VERSION\s*=\s*'([^']+)'/);

if (literalMatch) {
  fail(
    'APP_VERSION is hardcoded',
    `It says ${literalMatch[1]} while app.json says ${config.version}. Read it from ` +
      'Constants.expoConfig so the two cannot diverge.',
  );
} else if (!fallbackMatch) {
  warn('Could not find APP_VERSION', 'Skipped the version parity check.');
} else if (fallbackMatch[1] !== config.version) {
  fail(
    'Version fallback is stale',
    `app.json is ${config.version} but the fallback in src/constants/app.ts is ${fallbackMatch[1]}.`,
  );
} else {
  pass(`Version read from app config (${config.version})`);
}

// ------------------------------------------------------------------- ad setup

if (admob.forceTestUnits === true) {
  // Harmless in a release build (it is gated on __DEV__) but it means nobody has
  // actually exercised the live units, which is the point of the check.
  fail(
    'forceTestUnits is enabled',
    'Ads have only been verified against Google test inventory. Set it to false ' +
      'and confirm the live units fill before shipping.',
  );
} else {
  pass('forceTestUnits is off');
}

const adPlatforms = [
  { name: 'iOS', appId: 'iosAppId', rewarded: 'iosRewardedUnitId' },
  { name: 'Android', appId: 'androidAppId', rewarded: 'androidRewardedUnitId' },
];

for (const p of adPlatforms) {
  const appId = admob[p.appId];
  const rewarded = admob[p.rewarded];

  if (!APP_ID_RE.test(appId ?? '')) {
    fail(`${p.name} App ID missing or malformed`, `extra.admob.${p.appId} = ${appId || '(empty)'}`);
  } else if (String(appId).startsWith(GOOGLE_TEST_PUBLISHER)) {
    fail(`${p.name} App ID is Google's sample`, 'Ships test inventory and earns nothing.');
  } else {
    pass(`${p.name} App ID valid`);
  }

  if (!UNIT_ID_RE.test(rewarded ?? '')) {
    fail(
      `${p.name} rewarded unit missing or malformed`,
      `extra.admob.${p.rewarded} = ${rewarded || '(empty)'} — revive and daily doubler ` +
        'silently disappear without it.',
    );
  } else if (String(rewarded).startsWith(GOOGLE_TEST_PUBLISHER)) {
    fail(`${p.name} rewarded unit is Google's sample`, 'Earns nothing.');
  } else {
    pass(`${p.name} rewarded unit valid`);
  }
}

/**
 * The plugin's androidAppId is what writes the manifest meta-data. The native SDK
 * crashes on launch without it, and the config-time warning is easy to scroll past.
 */
const adPlugin = (config.plugins ?? []).find(
  (p) => Array.isArray(p) && String(p[0]).includes('google-mobile-ads'),
);
if (!adPlugin) {
  fail('Google Mobile Ads plugin not configured', 'The native SDK will not be set up.');
} else {
  for (const key of ['iosAppId', 'androidAppId']) {
    if (!APP_ID_RE.test(adPlugin[1]?.[key] ?? '')) {
      fail(
        `Plugin ${key} missing`,
        key === 'androidAppId'
          ? 'The Google Mobile Ads SDK CRASHES ON LAUNCH on Android without this.'
          : 'Required for the iOS SDK to initialise.',
      );
    } else {
      pass(`Plugin ${key} present`);
    }
  }
}

// --------------------------------------------------------------------- assets

for (const asset of [config.icon, config.splash?.image, config.android?.adaptiveIcon?.foregroundImage]) {
  if (!asset) continue;
  const rel = asset.replace(/^\.\//, '');
  if (!fs.existsSync(path.join(root, rel))) fail('Missing asset', rel);
}
if (!failures.some((f) => f.startsWith('Missing asset'))) pass('Launch assets present');

// ------------------------------------------------------------------ store meta

if (config.ios?.infoPlist?.ITSAppUsesNonExemptEncryption === undefined) {
  warn(
    'ITSAppUsesNonExemptEncryption not set',
    'App Store Connect asks about encryption on every single upload without it.',
  );
} else {
  pass('Encryption declaration set');
}

if (!config.ios?.bundleIdentifier || !config.android?.package) {
  fail('Missing bundle identifier or package name', 'Cannot submit without both.');
} else {
  pass('Bundle id and package set');
}

// Not machine-checkable from here, but forgetting it means AdMob revenue is
// withheld, so it is worth restating every run.
warn(
  'Manual: app-ads.txt',
  'Host app-ads.txt on your developer-site domain and set that domain in both store ' +
    'listings, or AdMob withholds programmatic revenue.',
);
warn(
  'Manual: AdMob Privacy & messaging',
  'Publish GDPR and US-states messages. Without them UMP reports no consent form, ' +
    'and EEA traffic cannot be monetised legally.',
);

/**
 * Is the privacy policy actually *there*?
 *
 * Checking only that the field is filled in is what let this project sit at
 * "14 passed, 0 failed" while the configured URL returned 404 — a hard blocker
 * for both store reviews, invisible to every other check here.
 *
 * A 404 fails. Being unable to reach the network at all only warns, so the
 * script still runs on a plane.
 */
async function checkPrivacyReachable() {
  const url = legal.privacy;
  if (typeof url !== 'string' || !url.startsWith('https://')) return;
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    if (res.ok) pass(`privacy policy reachable (HTTP ${res.status})`);
    else
      fail(
        `Privacy policy URL returns HTTP ${res.status}`,
        `${url}\n    Both stores reject a listing whose privacy policy does not load.`,
      );
  } catch {
    warn(
      'Manual: privacy policy reachability',
      `Could not reach ${url} from here. Confirm it loads publicly before submitting.`,
    );
  }
}

/**
 * Every ad format the game can show should have a unit on both platforms.
 *
 * A blank unit id is not an error — the resolver deliberately disables that
 * format in release rather than serving Google's test inventory. But it means
 * the placement silently earns nothing, which is worth saying out loud.
 */
function checkAdFormats() {
  for (const platform of ['ios', 'android']) {
    for (const format of ['Rewarded', 'Interstitial']) {
      const key = `${platform}${format}UnitId`;
      const value = admob[key];
      if (typeof value === 'string' && value.trim().length > 0) continue;
      warn(
        `${platform} ${format.toLowerCase()} ad unit not configured`,
        `extra.admob.${key} is empty, so the ${format.toLowerCase()} placement is ` +
          'disabled in release builds and earns nothing. Create the unit in AdMob ' +
          'and paste its id, or accept that the placement is off.',
      );
    }
  }
}

checkAdFormats();

// --------------------------------------------------------------------- report

async function report() {
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

console.log('\nPulse Blocks — pre-launch checks\n');
for (const p of passes) console.log(`  ${green('PASS')}  ${p}`);
for (const w of warnings) console.log(`  ${yellow('NOTE')}  ${w}`);
for (const f of failures) console.log(`  ${red('FAIL')}  ${f}`);

console.log(
  `\n${passes.length} passed, ${warnings.length} to confirm manually, ${failures.length} failed\n`,
);

process.exit(failures.length > 0 ? 1 : 0);
}

checkPrivacyReachable().then(report);
