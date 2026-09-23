import { SAVE_VERSION } from '../../constants/config';
import { isGameMode } from '../../game/modes';
import type { BankedRun } from '../../game/runBanking';
import type {
  Board,
  BlockColorId,
  CellState,
  GameMode,
  Piece,
  PieceCell,
  PlayerData,
  PowerType,
  PowerUpInventory,
  SavedSession,
  TraySlot,
} from '../../types';

/**
 * Defensive parsing for everything we read back off the device.
 *
 * A corrupt or half-written save must never crash the game, and it must never
 * cost the player their high score if that field is still readable.
 */

const POWER_TYPES: readonly PowerType[] = ['bomb', 'lightning', 'rainbow', 'freeze', 'pulse'];
const COLOR_IDS: readonly BlockColorId[] = [
  'aqua',
  'violet',
  'coral',
  'lime',
  'amber',
  'rose',
  'sky',
];

export const DEFAULT_PLAYER_DATA: PlayerData = {
  highScores: { classic: 0, pulse: 0 },
  selectedMode: 'pulse',
  totalGames: 0,
  totalLinesCleared: 0,
  totalCoins: 0,
  bestCombo: 0,
  xp: 0,
  level: 1,
  unlockedThemes: ['neon'],
  selectedTheme: 'neon',
  unlockedFinishes: ['gloss'],
  selectedFinish: 'gloss',
  soundEnabled: true,
  musicEnabled: true,
  hapticsEnabled: true,
  reducedMotion: false,
  lastDailyReward: null,
  currentStreak: 0,
  tutorialCompleted: false,
  unlockedAchievements: [],
  gamesSinceInterstitial: 0,
  lastInterstitialAt: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback: number, min = -Infinity): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function strArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const out = value.filter((v): v is string => typeof v === 'string');
  return out;
}

export function parsePlayerData(raw: unknown): PlayerData {
  if (!isRecord(raw)) return { ...DEFAULT_PLAYER_DATA };
  const d = DEFAULT_PLAYER_DATA;

  const unlockedThemes = strArray(raw.unlockedThemes, d.unlockedThemes);
  if (!unlockedThemes.includes('neon')) unlockedThemes.unshift('neon');

  const selectedTheme = str(raw.selectedTheme, d.selectedTheme);

  const unlockedFinishes = strArray(raw.unlockedFinishes, d.unlockedFinishes);
  if (!unlockedFinishes.includes('gloss')) unlockedFinishes.unshift('gloss');
  const selectedFinish = str(raw.selectedFinish, d.selectedFinish);

  /**
   * Modes arrived after launch. Saves written before then have a single
   * `highScore`, which was earned with powers on, so it migrates to Pulse.
   */
  const rawScores = isRecord(raw.highScores) ? raw.highScores : {};
  const legacyHighScore = Math.floor(num(raw.highScore, 0, 0));
  const highScores: Record<GameMode, number> = {
    classic: Math.floor(num(rawScores.classic, 0, 0)),
    pulse: Math.floor(num(rawScores.pulse, legacyHighScore, 0)),
  };

  return {
    highScores,
    selectedMode: isGameMode(raw.selectedMode) ? raw.selectedMode : d.selectedMode,
    totalGames: Math.floor(num(raw.totalGames, d.totalGames, 0)),
    totalLinesCleared: Math.floor(num(raw.totalLinesCleared, d.totalLinesCleared, 0)),
    totalCoins: Math.floor(num(raw.totalCoins, d.totalCoins, 0)),
    bestCombo: Math.floor(num(raw.bestCombo, d.bestCombo, 0)),
    xp: Math.floor(num(raw.xp, d.xp, 0)),
    level: Math.max(1, Math.floor(num(raw.level, d.level, 1))),
    unlockedThemes,
    selectedTheme: unlockedThemes.includes(selectedTheme) ? selectedTheme : 'neon',
    unlockedFinishes,
    selectedFinish: unlockedFinishes.includes(selectedFinish) ? selectedFinish : 'gloss',
    soundEnabled: bool(raw.soundEnabled, d.soundEnabled),
    musicEnabled: bool(raw.musicEnabled, d.musicEnabled),
    hapticsEnabled: bool(raw.hapticsEnabled, d.hapticsEnabled),
    reducedMotion: bool(raw.reducedMotion, d.reducedMotion),
    lastDailyReward: typeof raw.lastDailyReward === 'string' ? raw.lastDailyReward : null,
    currentStreak: Math.floor(num(raw.currentStreak, d.currentStreak, 0)),
    tutorialCompleted: bool(raw.tutorialCompleted, d.tutorialCompleted),
    unlockedAchievements: strArray(raw.unlockedAchievements, d.unlockedAchievements),
    gamesSinceInterstitial: Math.floor(num(raw.gamesSinceInterstitial, d.gamesSinceInterstitial, 0)),
    lastInterstitialAt: Math.floor(num(raw.lastInterstitialAt, d.lastInterstitialAt, 0)),
  };
}

function parseCell(raw: unknown): CellState {
  if (raw === null || raw === undefined) return null;
  if (!isRecord(raw)) return null;
  const colorId = raw.colorId;
  if (typeof colorId !== 'string' || !COLOR_IDS.includes(colorId as BlockColorId)) return null;
  const power = raw.power;
  const validPower =
    typeof power === 'string' && POWER_TYPES.includes(power as PowerType)
      ? (power as PowerType)
      : null;
  return { colorId: colorId as BlockColorId, power: validPower };
}

function parseBoard(raw: unknown, rows: number, columns: number): Board | null {
  if (!Array.isArray(raw) || raw.length !== rows) return null;
  const board: Board = [];
  for (const rowRaw of raw) {
    if (!Array.isArray(rowRaw) || rowRaw.length !== columns) return null;
    board.push(rowRaw.map(parseCell));
  }
  return board;
}

function parsePiece(raw: unknown): Piece | null {
  if (!isRecord(raw)) return null;
  if (!Array.isArray(raw.cells) || raw.cells.length === 0) return null;

  const cells: PieceCell[] = [];
  for (const cellRaw of raw.cells) {
    if (!isRecord(cellRaw)) return null;
    const r = cellRaw.r;
    const c = cellRaw.c;
    if (typeof r !== 'number' || typeof c !== 'number') return null;
    const power = cellRaw.power;
    cells.push({
      r,
      c,
      power:
        typeof power === 'string' && POWER_TYPES.includes(power as PowerType)
          ? (power as PowerType)
          : null,
    });
  }

  const colorId = str(raw.colorId, 'aqua');
  return {
    id: str(raw.id, 'restored'),
    shapeId: str(raw.shapeId, 'custom'),
    cells,
    width: Math.max(1, Math.floor(num(raw.width, Math.max(...cells.map((c) => c.c)) + 1, 1))),
    height: Math.max(1, Math.floor(num(raw.height, Math.max(...cells.map((c) => c.r)) + 1, 1))),
    colorId: (COLOR_IDS.includes(colorId as BlockColorId) ? colorId : 'aqua') as BlockColorId,
  };
}

function parseInventory(raw: unknown): PowerUpInventory {
  const base: PowerUpInventory = { bomb: 0, lightning: 0, shuffle: 0 };
  if (!isRecord(raw)) return base;
  return {
    bomb: Math.max(0, Math.floor(num(raw.bomb, 0, 0))),
    lightning: Math.max(0, Math.floor(num(raw.lightning, 0, 0))),
    shuffle: Math.max(0, Math.floor(num(raw.shuffle, 0, 0))),
  };
}

/**
 * Returns null for anything we cannot trust — the caller then simply starts a
 * fresh run rather than resuming into a broken board.
 */
export function parseSession(
  raw: unknown,
  rows: number,
  columns: number,
): SavedSession | null {
  if (!isRecord(raw)) return null;
  if (num(raw.version, -1) !== SAVE_VERSION) return null;

  const board = parseBoard(raw.board, rows, columns);
  if (!board) return null;

  if (!Array.isArray(raw.tray)) return null;
  const tray: TraySlot[] = raw.tray.map((slot) => (slot === null ? null : parsePiece(slot)));

  // A hand of nothing but corrupt slots is not worth resuming into.
  if (tray.length === 0) return null;
  if (tray.every((slot) => slot === null)) return null;

  const score = Math.max(0, Math.floor(num(raw.score, 0, 0)));
  const lines = Math.max(0, Math.floor(num(raw.linesClearedThisRun, 0, 0)));
  const bestCombo = Math.max(0, Math.floor(num(raw.bestComboThisRun, 0, 0)));

  /**
   * What this run was already paid for, clamped to the run itself.
   *
   * Absent in saves written before the field existed, which resume as unbanked —
   * correct, because those saves predate any revive that could have banked them.
   * Clamped so a tampered file can only ever *reduce* a payout, never inflate
   * one by claiming a bank larger than the run.
   */
  const bankedRaw = isRecord(raw.banked) ? raw.banked : null;
  const banked: BankedRun | undefined = bankedRaw
    ? {
        score: Math.min(score, Math.max(0, Math.floor(num(bankedRaw.score, 0, 0)))),
        lines: Math.min(lines, Math.max(0, Math.floor(num(bankedRaw.lines, 0, 0)))),
        bestCombo: Math.min(
          bestCombo,
          Math.max(0, Math.floor(num(bankedRaw.bestCombo, 0, 0))),
        ),
        counted: bankedRaw.counted === true,
      }
    : undefined;

  return {
    version: SAVE_VERSION,
    // Sessions saved before modes existed were played with powers on.
    mode: isGameMode(raw.mode) ? raw.mode : 'pulse',
    board,
    tray,
    score,
    combo: Math.max(0, Math.floor(num(raw.combo, 0, 0))),
    bestComboThisRun: bestCombo,
    turnsSinceClear: Math.max(0, Math.floor(num(raw.turnsSinceClear, 0, 0))),
    freezeCharges: Math.max(0, Math.floor(num(raw.freezeCharges, 0, 0))),
    pulseMeter: Math.min(1, Math.max(0, num(raw.pulseMeter, 0, 0))),
    linesClearedThisRun: lines,
    revivesUsed: Math.max(0, Math.floor(num(raw.revivesUsed, 0, 0))),
    powerUps: parseInventory(raw.powerUps),
    round: Math.max(0, Math.floor(num(raw.round, 0, 0))),
    banked,
    savedAt: num(raw.savedAt, 0, 0),
  };
}

/** Safe JSON.parse — corrupt strings yield undefined instead of throwing. */
export function safeJsonParse(text: string | null | undefined): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
