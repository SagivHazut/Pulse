/**
 * Core domain types for Pulse Blocks.
 *
 * Everything in here is plain data — no React, no React Native. The game engine
 * consumes and produces these types so it stays pure and unit-testable.
 */

/** How the run is played. See `game/modes.ts` for what each one enables. */
export type GameMode = 'classic' | 'pulse';

/** Special abilities a single tile can carry. */
export type PowerType = 'bomb' | 'lightning' | 'rainbow' | 'freeze' | 'pulse';

/** Palette slot id. Themes map these to concrete colors. */
export type BlockColorId =
  | 'aqua'
  | 'violet'
  | 'coral'
  | 'lime'
  | 'amber'
  | 'rose'
  | 'sky';

/** A single board square. `null` means empty. */
export type CellState = {
  colorId: BlockColorId;
  power: PowerType | null;
} | null;

/** Row-major board. `board[row][col]`. */
export type Board = CellState[][];

export type Coord = { row: number; col: number };

/** One tile within a piece, in piece-local coordinates. */
export type PieceCell = {
  r: number;
  c: number;
  power: PowerType | null;
};

export type Piece = {
  id: string;
  shapeId: string;
  cells: PieceCell[];
  /** Bounding box of `cells`, in tiles. */
  width: number;
  height: number;
  colorId: BlockColorId;
};

/** The three-slot hand. A used slot becomes `null` until the set refills. */
export type TraySlot = Piece | null;

/** Consumable power-ups the player holds in the bottom toolbar. */
export type PowerUpKind = 'bomb' | 'lightning' | 'shuffle';

export type PowerUpInventory = Record<PowerUpKind, number>;

/** Detected complete lines, before they are removed. */
export type CompletedLines = {
  rows: number[];
  cols: number[];
};

/** Side effects triggered by power tiles caught in a clear. */
export type PowerTrigger = {
  type: PowerType;
  origin: Coord;
  /** Extra cells destroyed by this trigger (already de-duplicated). */
  affected: Coord[];
};

export type ClearOutcome = {
  board: Board;
  /** Every cell removed this turn, including power-triggered ones. */
  clearedCells: Coord[];
  lines: CompletedLines;
  triggers: PowerTrigger[];
  /** True when the board ended up completely empty. */
  perfectClear: boolean;
};

export type ScoreBreakdown = {
  placement: number;
  lines: number;
  combo: number;
  power: number;
  perfectClear: number;
  total: number;
};

export type TurnResult = {
  board: Board;
  tilesPlaced: number;
  lines: CompletedLines;
  linesCleared: number;
  clearedCells: Coord[];
  triggers: PowerTrigger[];
  perfectClear: boolean;
  combo: number;
  turnsSinceClear: number;
  freezeCharges: number;
  pulseMeter: number;
  score: ScoreBreakdown;
};

/** Persisted, cross-run player profile. */
export type PlayerData = {
  /** Separate records per mode — powers inflate scores, so one table would be unfair. */
  highScores: Record<GameMode, number>;
  /** Last mode played, so Home opens on it. */
  selectedMode: GameMode;
  totalGames: number;
  totalLinesCleared: number;
  totalCoins: number;
  bestCombo: number;
  xp: number;
  level: number;
  unlockedThemes: string[];
  selectedTheme: string;
  unlockedFinishes: string[];
  selectedFinish: string;
  soundEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  reducedMotion: boolean;
  lastDailyReward: string | null;
  currentStreak: number;
  tutorialCompleted: boolean;
  unlockedAchievements: string[];
  gamesSinceInterstitial: number;
  /** Epoch ms of the last interstitial, so the cooldown survives a restart. */
  lastInterstitialAt: number;
};

/** Persisted mid-run snapshot so a killed app can resume. */
export type SavedSession = {
  version: number;
  mode: GameMode;
  board: Board;
  tray: TraySlot[];
  score: number;
  combo: number;
  bestComboThisRun: number;
  turnsSinceClear: number;
  freezeCharges: number;
  pulseMeter: number;
  linesClearedThisRun: number;
  revivesUsed: number;
  powerUps: PowerUpInventory;
  round: number;
  savedAt: number;
};

export type RewardType =
  | 'revive'
  | 'double_coins'
  | 'rescue_powerup'
  | 'daily_double';

export type AnalyticsParams = Record<string, string | number | boolean | null>;
