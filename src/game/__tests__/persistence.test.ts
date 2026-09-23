import { SAVE_VERSION } from '../../constants/config';
import {
  DEFAULT_PLAYER_DATA,
  parsePlayerData,
  parseSession,
  safeJsonParse,
} from '../../services/storage/schema';
import type { SavedSession } from '../../types';
import { createEmptyBoard } from '../engine/board';
import { makeBoard, makePiece } from './helpers';

describe('parsePlayerData', () => {
  it('falls back to defaults for junk input', () => {
    expect(parsePlayerData(null)).toEqual(DEFAULT_PLAYER_DATA);
    expect(parsePlayerData('nope')).toEqual(DEFAULT_PLAYER_DATA);
    expect(parsePlayerData(42)).toEqual(DEFAULT_PLAYER_DATA);
  });

  it('preserves a readable high score even when the rest is corrupt', () => {
    const parsed = parsePlayerData({
      highScores: { pulse: 22_100, classic: 900 },
      totalGames: 'lots',
      level: null,
    });
    expect(parsed.highScores.pulse).toBe(22_100);
    expect(parsed.highScores.classic).toBe(900);
    expect(parsed.totalGames).toBe(0);
    expect(parsed.level).toBe(1);
  });

  /**
   * Modes shipped after launch. A save from before then has one `highScore`,
   * earned with powers on, so it must land in Pulse rather than being lost.
   */
  it('migrates a pre-modes high score into Pulse', () => {
    const parsed = parsePlayerData({ highScore: 4450 });
    expect(parsed.highScores.pulse).toBe(4450);
    expect(parsed.highScores.classic).toBe(0);
    expect(parsed.selectedMode).toBe('pulse');
  });

  it('prefers per-mode scores over the legacy field when both exist', () => {
    const parsed = parsePlayerData({ highScore: 100, highScores: { pulse: 7000, classic: 50 } });
    expect(parsed.highScores.pulse).toBe(7000);
    expect(parsed.highScores.classic).toBe(50);
  });

  it('rejects an unknown selected mode', () => {
    expect(parsePlayerData({ selectedMode: 'chaos' }).selectedMode).toBe('pulse');
    expect(parsePlayerData({ selectedMode: 'classic' }).selectedMode).toBe('classic');
  });

  it('rejects negative and non-finite numbers', () => {
    const parsed = parsePlayerData({
      highScores: { pulse: -5, classic: Number.NaN },
      totalCoins: Number.NaN,
      xp: Infinity,
    });
    expect(parsed.highScores.pulse).toBe(0);
    expect(parsed.highScores.classic).toBe(0);
    expect(parsed.totalCoins).toBe(0);
    expect(parsed.xp).toBe(0);
  });

  it('always keeps the default theme unlocked and selectable', () => {
    const parsed = parsePlayerData({ unlockedThemes: ['ocean'], selectedTheme: 'galaxy' });
    expect(parsed.unlockedThemes).toContain('neon');
    expect(parsed.selectedTheme).toBe('neon');
  });

  it('keeps a valid selected theme', () => {
    const parsed = parsePlayerData({ unlockedThemes: ['neon', 'ocean'], selectedTheme: 'ocean' });
    expect(parsed.selectedTheme).toBe('ocean');
  });

  it('round-trips a full record', () => {
    const source = {
      ...DEFAULT_PLAYER_DATA,
      highScores: { classic: 1234, pulse: 5678 },
      selectedMode: 'classic' as const,
      level: 5,
      xp: 999,
    };
    expect(parsePlayerData(JSON.parse(JSON.stringify(source)))).toEqual(source);
  });
});

describe('parseSession', () => {
  const validSession: SavedSession = {
    version: SAVE_VERSION,
    mode: 'classic',
    board: createEmptyBoard(4, 4),
    tray: [makePiece(['##']), null, makePiece(['#B'])],
    score: 500,
    combo: 2,
    bestComboThisRun: 3,
    turnsSinceClear: 1,
    freezeCharges: 1,
    pulseMeter: 0.4,
    linesClearedThisRun: 4,
    revivesUsed: 0,
    powerUps: { bomb: 1, lightning: 0, shuffle: 2 },
    round: 6,
    savedAt: 1_700_000_000_000,
  };

  const roundTrip = (session: unknown) =>
    parseSession(safeJsonParse(JSON.stringify(session)), 4, 4);

  /**
   * `banked` is what stops a revived run being paid for twice. It used not to be
   * persisted, so a revived run that was force-quit and resumed re-paid its
   * whole score in coins, XP, lines and one extra `totalGames` — the exact
   * double-credit `runBanking` exists to prevent, and farmable once per revive.
   */
  describe('the banked record', () => {
    it('round-trips so a resumed revived run is not paid twice', () => {
      const parsed = roundTrip({
        ...validSession,
        banked: { score: 500, lines: 4, bestCombo: 3, counted: true },
      });
      expect(parsed?.banked).toEqual({ score: 500, lines: 4, bestCombo: 3, counted: true });
    });

    it('is absent for saves written before the field existed', () => {
      // Those saves predate any revive that could have banked them, so resuming
      // as unbanked is correct — and must not reject the save.
      const parsed = roundTrip(validSession);
      expect(parsed).not.toBeNull();
      expect(parsed?.banked).toBeUndefined();
    });

    it('clamps a tampered record to the run, so it can never inflate a payout', () => {
      const parsed = roundTrip({
        ...validSession,
        banked: { score: 9_999_999, lines: 500, bestCombo: 99, counted: true },
      });
      // Claiming more was banked than the run earned would only ever *reduce*
      // what is owed, but pin it anyway so the direction cannot flip.
      expect(parsed?.banked).toEqual({ score: 500, lines: 4, bestCombo: 3, counted: true });
    });

    it('repairs a corrupt record instead of dropping the save', () => {
      const parsed = roundTrip({
        ...validSession,
        banked: { score: 'lots', lines: null, bestCombo: -5, counted: 'yes' },
      });
      expect(parsed).not.toBeNull();
      expect(parsed?.banked).toEqual({ score: 0, lines: 0, bestCombo: 0, counted: false });
    });
  });

  it('refuses a hand whose every slot failed to parse', () => {
    // Resuming into a tray of nothing but nulls is a soft lock: no piece can be
    // placed, so the run can never end and is never banked.
    const parsed = roundTrip({ ...validSession, tray: [{ junk: true }, 'nope', 42] });
    expect(parsed).toBeNull();
  });

  it('round-trips a valid session', () => {
    const parsed = roundTrip(validSession);
    expect(parsed).not.toBeNull();
    expect(parsed?.mode).toBe('classic');
    expect(parsed?.score).toBe(500);
    expect(parsed?.combo).toBe(2);
    expect(parsed?.tray[1]).toBeNull();
    expect(parsed?.tray[2]?.cells.some((c) => c.power === 'bomb')).toBe(true);
    expect(parsed?.powerUps).toEqual({ bomb: 1, lightning: 0, shuffle: 2 });
  });

  it('restores power tiles on the board', () => {
    const parsed = roundTrip({ ...validSession, board: makeBoard(['B...', '....', '....', '....']) });
    expect(parsed?.board[0][0]?.power).toBe('bomb');
  });

  it('assumes Pulse for a session saved before modes existed', () => {
    const { mode: _dropped, ...withoutMode } = validSession;
    expect(roundTrip(withoutMode)?.mode).toBe('pulse');
    expect(roundTrip({ ...validSession, mode: 'nonsense' })?.mode).toBe('pulse');
  });

  it('rejects a board of the wrong size', () => {
    expect(roundTrip({ ...validSession, board: createEmptyBoard(8, 8) })).toBeNull();
  });

  it('rejects a save from an older version', () => {
    expect(roundTrip({ ...validSession, version: SAVE_VERSION - 1 })).toBeNull();
  });

  it('rejects structurally broken data', () => {
    expect(parseSession(null, 4, 4)).toBeNull();
    expect(parseSession({ version: SAVE_VERSION }, 4, 4)).toBeNull();
    expect(roundTrip({ ...validSession, tray: 'nope' })).toBeNull();
    expect(roundTrip({ ...validSession, board: [[], [], [], []] })).toBeNull();
  });

  it('drops unknown colors and powers rather than trusting them', () => {
    const parsed = parseSession(
      {
        ...validSession,
        board: [
          [{ colorId: 'chartreuse', power: 'nuke' }, null, null, null],
          [null, null, null, null],
          [null, null, null, null],
          [null, null, null, null],
        ],
      },
      4,
      4,
    );
    expect(parsed?.board[0][0]).toBeNull();
  });

  it('clamps out-of-range numbers', () => {
    const parsed = roundTrip({ ...validSession, score: -10, pulseMeter: 9, combo: -3 });
    expect(parsed?.score).toBe(0);
    expect(parsed?.pulseMeter).toBe(1);
    expect(parsed?.combo).toBe(0);
  });
});

describe('safeJsonParse', () => {
  it('returns undefined instead of throwing', () => {
    expect(safeJsonParse('{ broken')).toBeUndefined();
    expect(safeJsonParse(null)).toBeUndefined();
    expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
  });
});
