/**
 * Central tuning surface. Nothing in the engine hardcodes a dimension or a
 * magic number — change it here and the whole game follows.
 */

export const GAME_CONFIG = {
  rows: 8,
  columns: 8,
  /** Pieces handed to the player at once. */
  handSize: 3,
} as const;

export const SCORING = {
  /** Points per tile of a placed piece. */
  perTile: 10,
  /** Points per cleared line, before multi-line and combo bonuses. */
  perLine: 100,
  /**
   * Extra multiplier per line beyond the first, e.g. 3 lines at once scores
   * 3 * 100 * (1 + 2 * 0.5) = 600.
   */
  multiLineStep: 0.5,
  /** Combo multiplier grows by this per combo step above 1. */
  comboStep: 0.35,
  /** Combo multiplier is capped so late-run scores stay readable. */
  maxComboMultiplier: 6,
  powerBonus: {
    bomb: 150,
    lightning: 200,
    rainbow: 250,
    freeze: 100,
    pulse: 120,
  },
  perfectClear: 1000,
  /**
   * Score-to-coin conversion at the end of a run.
   *
   * Tuned against the cosmetic ladder: earning every theme should take roughly
   * 140 runs of gameplay alone, and rather less with daily rewards and
   * achievements. `pacing.test.ts` guards these numbers.
   */
  coinsPerPoint: 1 / 150,
  /** Coins granted for each combo step of the best combo in a run. */
  coinsPerBestComboStep: 10,
} as const;

export const COMBO_CONFIG = {
  /** Turns without a clear before the combo resets. */
  graceTurns: 2,
  /** Combo level at which the "PULSE" treatment kicks in. */
  hypeThreshold: 5,
  /** Combo level that triggers the full-screen celebration. */
  dramaticThreshold: 10,
} as const;

export const PULSE_METER = {
  /** Meter units gained per cleared line. */
  gainPerLine: 0.2,
  /** Extra units per combo step. */
  gainPerComboStep: 0.05,
  /** Meter decays this much on a turn with no clear. */
  decayPerIdleTurn: 0.04,
  /** Reaching 1.0 awards a free power-up and resets the meter. */
  full: 1,
} as const;

export const POWER_BLOCK_CONFIG = {
  /** Probability that a generated piece carries a power tile. */
  chancePerPiece: 0.08,
  /** Never more than this many power pieces in one hand. */
  maxPerHand: 1,
  /** Hands to wait after a power piece before another can spawn. */
  cooldownHands: 2,
  weights: {
    bomb: 30,
    lightning: 18,
    rainbow: 20,
    freeze: 16,
    pulse: 16,
  },
} as const;

export const GENERATION_CONFIG = {
  /**
   * While occupancy is below this, the generator guarantees at least one piece
   * of the hand fits. Past it the board speaks for itself and the run can end —
   * the game never manipulates pieces to *force* a loss, it just stops helping.
   */
  fairnessOccupancyCeiling: 0.85,
  /** Attempts to find a hand containing a placeable piece. */
  fairnessAttempts: 24,
  /** Rounds after which larger shapes become more common. */
  difficultyRampRounds: 12,
  /** Maximum weight multiplier applied to large shapes late in a run. */
  maxLargeShapeBoost: 2.2,
} as const;

export const TENSION_CONFIG = {
  /** Occupancy at which the board starts to feel uneasy. */
  warn: 0.75,
  /** Occupancy at which tension peaks. */
  danger: 0.9,
} as const;

export const REVIVE_CONFIG = {
  /**
   * The revive is the strongest placement in the game: the player wants it at
   * the exact moment it is offered, and it is entirely opt-in. Two per run is
   * the main rewarded lever — raise it further only if run length starts to
   * feel padded.
   */
  MAX_REVIVES_PER_RUN: 2,
  /** Fraction of occupied tiles removed by a revive. */
  clearRatioMin: 0.2,
  clearRatioMax: 0.3,
} as const;

export const ADS_CONFIG = {
  /**
   * Completed games before interstitials are allowed at all.
   *
   * Deliberately generous. Interstitials are the only ad the player does not
   * choose, so they are the only one that can cost retention — and with no IAP,
   * a churned player earns nothing at all. Rewarded ads carry the revenue; this
   * number exists to protect the first sessions.
   */
  gracePeriodGames: 5,
  /** After the grace period, show roughly every N completed games. */
  interstitialEveryGamesMin: 3,
  interstitialEveryGamesMax: 5,
  INTERSTITIAL_COOLDOWN_MS: 180_000,
  /** Rewarded rescue power-up offers allowed per app session. */
  rescueOffersPerSession: 1,
} as const;

export const DAILY_REWARD = {
  cycle: [50, 75, 100, 125, 150, 200, 350],
  /** Day 7 is a "mystery" roll between these bounds. */
  mysteryMin: 300,
  mysteryMax: 600,
} as const;

export const PROGRESSION = {
  /**
   * XP rates are set so level gates land slightly *ahead* of the coin cost for
   * each theme — levels stop everything being bought on day one, but coins are
   * the real price. `pacing.test.ts` guards that relationship.
   */
  xpPerHundredPoints: 2,
  xpPerLineCleared: 5,
  /** XP needed for level n is base * n ^ exponent. */
  xpBase: 120,
  xpExponent: 1.25,
} as const;

export const ANIMATION = {
  /** Anticipation hold before cleared blocks burst. */
  clearAnticipationMs: 100,
  clearBurstMs: 220,
  /** Total line-clear sequence budget. Keep it snappy. */
  clearTotalMs: 320,
  placeSnapMs: 140,
  invalidShakeMs: 260,
  gameOverDelayMs: 300,
  buttonPressScale: 0.96,
  dragScale: 1,
  /** Piece scale inside a tray slot, relative to board cell size. */
  trayScale: 0.58,
} as const;

export const STORAGE_KEYS = {
  player: 'pb.player.v1',
  session: 'pb.session.v1',
  monetization: 'pb.monetization.v1',
} as const;

export const SAVE_VERSION = 1;
