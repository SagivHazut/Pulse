import Constants from 'expo-constants';
import { LogBox } from 'react-native';

import { dayKey } from '../../game/dailyReward';

import { SAVE_VERSION, STORAGE_KEYS } from '../../constants/config';
import type { PlayerData, SavedSession } from '../../types';
import {
  assertBoardIsPlausible,
  assertPayoffIsReachable,
  demoBoard,
  demoTray,
} from './demoFixture';
import { patchPlayerData } from './playerData';
import { saveSession } from './session';

/**
 * A believable profile, for capturing store screenshots and trailers.
 *
 * Marketing shots of a fresh install show zeroes everywhere — no coins, no
 * unlocked themes, an empty achievement grid — which sells none of what the game
 * actually is. Playing far enough to unlock the eight-theme ladder legitimately
 * takes roughly 150 runs, so the alternative to seeding is not capturing the
 * screens at all.
 *
 * Set `expo.extra.demoSeed` to true and rebuild. Gated on `__DEV__` exactly like
 * `forceTestUnits` and `forceEeaConsent`, so it cannot run in a release build and
 * cannot touch a real player's save.
 *
 * The numbers are deliberately plausible rather than maximal: a strong player
 * mid-ladder, not a completed account. Screenshots showing everything unlocked
 * and a seven-figure score read as fake, and they also misrepresent the economy
 * to anyone deciding whether to install.
 */
const DEMO_PROFILE: Partial<PlayerData> = {
  highScores: { pulse: 48_260, classic: 21_940 },
  selectedMode: 'pulse',
  totalGames: 84,
  totalLinesCleared: 612,
  totalCoins: 2_840,
  bestCombo: 9,
  // 11,600 puts the player partway into level 11 (the curve needs 10,568 for
  // it, 12,972 for 12), so the Settings XP bar shows visible progress rather
  // than sitting at either end. `level` is derived from xp, never stored — a
  // seeded level that disagreed with the xp would render as the derived one and
  // silently contradict the rest of the profile.
  xp: 11_600,
  // Through Ember on the ladder — its level-10 gate is cleared by the xp above,
  // so nothing in the grid is owned-but-unreachable. The last three stay locked
  // so the progression is still visible.
  unlockedThemes: ['neon', 'ocean', 'candy', 'galaxy', 'ember'],
  selectedTheme: 'neon',
  unlockedFinishes: ['gloss', 'flat', 'bevel'],
  selectedFinish: 'gloss',
  currentStreak: 5,
  // Claimed yesterday, so the streak is live rather than already broken. Without
  // this the sheet offers day 1 for 50 coins — truthfully, since a null last
  // claim means no streak at all — which is a poor advert for a seven-day
  // ladder. Computed at call time because "yesterday" has to be relative to
  // whenever the captures are taken.
  lastDailyReward: dayKey(new Date(Date.now() - 86_400_000)),
  tutorialCompleted: true,
  unlockedAchievements: [
    'first_clear',
    'combo_5',
    'combo_10',
    'score_10k',
    'score_50k',
    'perfect_clear',
    'power_user',
  ],
};


/**
 * A run already underway, so the game screen has something to show.
 *
 * Without this the only capturable board is whatever the last test run left
 * behind — in practice a nearly empty grid with one piece in the tray and a
 * three-figure score sitting under a five-figure best, which reads as a game
 * nobody is playing.
 */
function demoSession(): SavedSession {
  return {
    version: SAVE_VERSION,
    mode: 'pulse',
    board: demoBoard(),
    tray: demoTray(),
    score: 12_480,
    combo: 4,
    bestComboThisRun: 6,
    turnsSinceClear: 0,
    freezeCharges: 1,
    // Nearly full, so the meter reads as about to pay out.
    pulseMeter: 0.78,
    linesClearedThisRun: 34,
    revivesUsed: 0,
    powerUps: { bomb: 2, lightning: 1, shuffle: 3 },
    round: 27,
    savedAt: 0,
  };
}

/** True when this build was asked to present a demo profile. */
export function demoSeedEnabled(): boolean {
  if (!__DEV__) return false;
  return Constants.expoConfig?.extra?.demoSeed === true;
}

/**
 * Overwrite the stored profile with {@link DEMO_PROFILE}.
 *
 * Runs after `hydrateStorage()` and before the stores hydrate, so the seeded
 * values are what the UI reads on first paint — no flash of a zeroed profile.
 */
export function applyDemoSeed(): void {
  if (!demoSeedEnabled()) return;

  // The LogBox banner sits across the bottom of the screen and covers the tab
  // bar. It is not wrong to show it — the ads layer really does warn, loudly,
  // while the AdMob account is still pending approval — but this build exists
  // solely to be photographed, and a dev overlay in a store screenshot is worse
  // than a missed warning. Release builds have no LogBox at all, and the same
  // warnings still reach the Metro console.
  LogBox.ignoreAllLogs(true);

  const session = demoSession();
  assertBoardIsPlausible(session.board);
  assertPayoffIsReachable(session.board, session.tray);
  patchPlayerData(DEMO_PROFILE);
  saveSession(session);
  // Deliberately `log`, not `warn`: a warning raises the LogBox banner, which
  // sits across the bottom of the screen and photobombs the very screenshots
  // this seed exists to make possible.
  console.log(
    `[demo] Seeded a demo profile into ${STORAGE_KEYS.player}. ` +
      'Set expo.extra.demoSeed to false and reinstall to get a real save back.',
  );
}
