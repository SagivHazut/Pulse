import Constants from 'expo-constants';

import { GAME_CONFIG, SAVE_VERSION, STORAGE_KEYS } from '../../constants/config';
import { SHAPES } from '../../game/pieces/shapes';
import type { BlockColorId, Board, PlayerData, Piece, SavedSession } from '../../types';
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
 * A board worth photographing.
 *
 * Authored as ASCII for the same reason the piece shapes are — it is the only
 * way to see the composition while editing it. Each letter is a block colour;
 * '.' is empty.
 *
 * Shaped deliberately: dense along the bottom and left so the grid reads as
 * "a run in progress" rather than a random scatter, with the lower rows one tile
 * short of clearing. A board about to pay off sells the mechanic; a half-empty
 * one sells nothing.
 *
 * **No row or column may be complete.** A full line clears the instant it forms,
 * so a seeded board containing one is a state the game could never produce —
 * and it is exactly the kind of detail that makes a store screenshot look
 * staged. `demoBoardIsPlausible` below asserts it rather than trusting the art.
 */
const DEMO_BOARD = [
  '........',
  '........',
  '...vv...',
  '..avvc..',
  '..aaccs.',
  'lla.ccsp',
  'llaar.sp',
  'llmmrrp.',
];

const COLOR_BY_LETTER: Record<string, BlockColorId> = {
  a: 'aqua',
  v: 'violet',
  c: 'coral',
  l: 'lime',
  m: 'amber',
  r: 'rose',
  s: 'sky',
  p: 'violet',
};

/**
 * Would the engine ever allow this board to exist?
 *
 * Only the completeness rule is checked, because it is the only one a hand-drawn
 * board can plausibly break. Throwing in development is the point: a silently
 * impossible board ships to a store listing, where it is someone else's job to
 * notice.
 */
function assertBoardIsPlausible(board: Board): void {
  if (!__DEV__) return;
  const rows = board.length;
  const cols = board[0]?.length ?? 0;

  for (let row = 0; row < rows; row += 1) {
    if (board[row]?.every((cell) => cell !== null)) {
      throw new Error(`demoSeed: row ${row} is complete — it would have cleared.`);
    }
  }
  for (let col = 0; col < cols; col += 1) {
    if (board.every((line) => line[col] !== null)) {
      throw new Error(`demoSeed: column ${col} is complete — it would have cleared.`);
    }
  }
}

function demoBoard(): Board {
  return Array.from({ length: GAME_CONFIG.rows }, (_, row) =>
    Array.from({ length: GAME_CONFIG.columns }, (_, col) => {
      const letter = DEMO_BOARD[row]?.[col] ?? '.';
      const colorId = COLOR_BY_LETTER[letter];
      return colorId ? { colorId, power: null } : null;
    }),
  );
}

/** A full hand, so the tray never photographs half-empty. */
function demoTray(): (Piece | null)[] {
  const wanted: { shapeId: string; colorId: BlockColorId; power?: 'bomb' }[] = [
    // Completes row 5 — the payoff the board is set up for.
    { shapeId: 'i2-h', colorId: 'aqua' },
    // A bomb tile, so the power-block mechanic is visible in the shot.
    { shapeId: 't-down', colorId: 'rose', power: 'bomb' },
    { shapeId: 'l-b', colorId: 'sky' },
  ];

  return wanted.map((want, index) => {
    const shape = SHAPES.find((candidate) => candidate.id === want.shapeId);
    if (!shape) return null;
    return {
      id: `demo-${index}`,
      shapeId: shape.id,
      cells: shape.cells.map((cell, i) => ({
        r: cell.r,
        c: cell.c,
        power: want.power && i === 1 ? want.power : null,
      })),
      width: shape.width,
      height: shape.height,
      colorId: want.colorId,
    };
  });
}

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
  const session = demoSession();
  assertBoardIsPlausible(session.board);
  patchPlayerData(DEMO_PROFILE);
  saveSession(session);
  console.warn(
    `[demo] Seeded a demo profile into ${STORAGE_KEYS.player}. ` +
      'Set expo.extra.demoSeed to false and reinstall to get a real save back.',
  );
}
