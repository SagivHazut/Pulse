import { create } from 'zustand';

import {
  ANIMATION,
  GAME_CONFIG,
  GENERATION_CONFIG,
  POWER_BLOCK_CONFIG,
  SAVE_VERSION,
} from '../constants/config';
import { createEmptyBoard, occupancy, toOccupancyGrid } from '../game/engine/board';
import { isGameOver } from '../game/engine/placement';
import { reviveBoard } from '../game/engine/revive';
import { resolveTurn } from '../game/engine/turn';
import { generatePieces } from '../game/generators/pieceGenerator';
import { DEFAULT_MODE, getMode } from '../game/modes';
import {
  applyPowerUp,
  consumePowerUp,
  emptyInventory,
  POWER_UP_KINDS,
} from '../game/powerups/powerups';
import { powerUpPrice } from '../game/powerups/shop';
import { comboTier, type ComboTier } from '../game/scoring/scoring';
import {
  bankRun,
  EMPTY_BANKED_RUN,
  runDelta,
  type BankedRun,
} from '../game/runBanking';
import { boardTension } from '../game/tension';
import { track } from '../services/analytics';
import {
  playClearSfx,
  playComboSfx,
  playSfx,
  setMusicTension,
} from '../services/audio';
import { haptics } from '../services/haptics';
import { clearSession, saveSession } from '../services/storage/session';
import { useMonetizationStore } from './useMonetizationStore';
import { usePlayerStore, type RunRewards } from './usePlayerStore';
import type {
  Board,
  Coord,
  GameMode,
  Piece,
  PowerTrigger,
  PowerUpKind,
  SavedSession,
  TraySlot,
} from '../types';

export type GameStatus = 'idle' | 'playing' | 'clearing' | 'gameover';

/** One-shot visual event consumed by the effects layer. */
export type ClearEvent = {
  id: number;
  cells: Coord[];
  linesCleared: number;
  combo: number;
  tier: ComboTier;
  triggers: PowerTrigger[];
  points: number;
  perfectClear: boolean;
};

export type PowerUpAwardEvent = { id: number; kind: PowerUpKind };

type GameState = {
  status: GameStatus;
  /** Which mode this run is being played in. Fixed for the life of the run. */
  mode: GameMode;
  board: Board;
  tray: TraySlot[];
  /** Flat 0/1 mirror of the board for the drag worklet. */
  occupancyGrid: number[];

  score: number;
  combo: number;
  bestComboThisRun: number;
  turnsSinceClear: number;
  freezeCharges: number;
  pulseMeter: number;
  linesClearedThisRun: number;
  revivesUsed: number;
  round: number;
  powerUps: Record<PowerUpKind, number>;
  handsSincePower: number;

  tension: number;
  hadPerfectClear: boolean;
  usedPowerBlock: boolean;
  startedAt: number;

  /** Cells mid-burst. They stay rendered until the animation finishes. */
  clearingCells: Coord[];
  lastClear: ClearEvent | null;
  lastAward: PowerUpAwardEvent | null;
  armedPowerUp: PowerUpKind | null;
  invalidNonce: number;
  /** Result of the finished run, banked by `endRun`. Read by the game-over sheet. */
  runRewards: RunRewards | null;
  /**
   * What has already been credited to the profile for this run. A rewarded revive
   * resumes the same run, so it ends — and banks — more than once.
   */
  banked: BankedRun;

  startNewGame(mode?: GameMode): void;
  resumeFrom(session: SavedSession): void;
  placePieceAt(pieceId: string, row: number, col: number): boolean;
  registerInvalidDrop(): void;
  armPowerUp(kind: PowerUpKind | null): void;
  applyArmedPowerUp(target: Coord): boolean;
  shuffleHand(): boolean;
  grantPowerUp(kind: PowerUpKind, amount?: number): void;
  /** Spend coins on power-ups. Returns false if the mode, funds or input say no. */
  buyPowerUp(kind: PowerUpKind, quantity: number): boolean;
  reviveRun(): void;
  endRun(): void;
  persist(): void;
  clearGame(): void;
};

let clearTimer: ReturnType<typeof setTimeout> | null = null;
/** The second beat of the current turn, if it has not run yet. */
let pendingSettle: (() => void) | null = null;
let eventId = 0;

function cancelPendingTimers() {
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
  pendingSettle = null;
}

/**
 * Run the pending second beat immediately instead of waiting for its timer.
 *
 * Called when the player places another piece while a clear is still animating.
 * The alternative — ignoring input until the animation finishes — makes the game
 * feel stuck for a third of a second on every clear, which is exactly the kind of
 * wait the design brief rules out. Cutting a burst short is the better trade.
 */
function flushPendingClear() {
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
  const settle = pendingSettle;
  pendingSettle = null;
  settle?.();
}

function freshHand(
  board: Board,
  round: number,
  handsSincePower: number,
  mode: GameMode,
): Piece[] {
  return generatePieces(board, {
    round,
    // Classic never deals power tiles at all; Pulse still honours the cooldown.
    allowPower:
      getMode(mode).powerTiles && handsSincePower >= POWER_BLOCK_CONFIG.cooldownHands,
  });
}

function playTriggerFeedback(triggers: readonly PowerTrigger[]): void {
  let playedBomb = false;
  let playedBolt = false;
  for (const trigger of triggers) {
    if (trigger.type === 'bomb' && !playedBomb) {
      playedBomb = true;
      playSfx('bomb');
      haptics.heavy();
    } else if (trigger.type === 'lightning' && !playedBolt) {
      playedBolt = true;
      playSfx('lightning');
      haptics.heavy();
    } else if (trigger.type !== 'bomb' && trigger.type !== 'lightning') {
      playSfx('power');
    }
  }
}

export const useGameStore = create<GameState>((set, get) => ({
  status: 'idle',
  mode: DEFAULT_MODE,
  board: createEmptyBoard(),
  tray: [],
  occupancyGrid: toOccupancyGrid(createEmptyBoard()),

  score: 0,
  combo: 0,
  bestComboThisRun: 0,
  turnsSinceClear: 0,
  freezeCharges: 0,
  pulseMeter: 0,
  linesClearedThisRun: 0,
  revivesUsed: 0,
  round: 0,
  powerUps: emptyInventory(),
  handsSincePower: POWER_BLOCK_CONFIG.cooldownHands,

  tension: 0,
  hadPerfectClear: false,
  usedPowerBlock: false,
  startedAt: Date.now(),

  clearingCells: [],
  lastClear: null,
  lastAward: null,
  armedPowerUp: null,
  invalidNonce: 0,
  runRewards: null,
  banked: EMPTY_BANKED_RUN,

  startNewGame(mode) {
    cancelPendingTimers();
    const runMode = mode ?? get().mode;
    const board = createEmptyBoard(GAME_CONFIG.rows, GAME_CONFIG.columns);
    const tray = freshHand(board, 0, POWER_BLOCK_CONFIG.cooldownHands, runMode);

    setMusicTension(0);
    track('game_started', { mode: runMode });

    set({
      status: 'playing',
      mode: runMode,
      board,
      tray,
      occupancyGrid: toOccupancyGrid(board),
      score: 0,
      combo: 0,
      bestComboThisRun: 0,
      turnsSinceClear: 0,
      freezeCharges: 0,
      pulseMeter: 0,
      linesClearedThisRun: 0,
      revivesUsed: 0,
      round: 1,
      powerUps: emptyInventory(),
      handsSincePower: 0,
      tension: 0,
      hadPerfectClear: false,
      usedPowerBlock: false,
      startedAt: Date.now(),
      clearingCells: [],
      lastClear: null,
      lastAward: null,
      armedPowerUp: null,
      runRewards: null,
      banked: EMPTY_BANKED_RUN,
    });
    /**
     * The per-run ad caps belong to the run, not to the screen that started it.
     * Resetting them here covers NEW GAME from the game-over sheet, which used
     * to leave `revivesUsedThisRun` at its old value — silently removing the
     * revive offer, the largest rewarded placement, for the rest of the session.
     */
    useMonetizationStore.getState().beginRun();
    get().persist();
  },

  resumeFrom(session) {
    cancelPendingTimers();
    const tension = boardTension(session.board);
    setMusicTension(tension);
    track('game_resumed', { score: session.score, mode: session.mode });

    set({
      status: 'playing',
      mode: session.mode,
      board: session.board,
      tray: session.tray,
      occupancyGrid: toOccupancyGrid(session.board),
      score: session.score,
      combo: session.combo,
      bestComboThisRun: session.bestComboThisRun,
      turnsSinceClear: session.turnsSinceClear,
      freezeCharges: session.freezeCharges,
      pulseMeter: session.pulseMeter,
      linesClearedThisRun: session.linesClearedThisRun,
      revivesUsed: session.revivesUsed,
      round: session.round,
      powerUps: session.powerUps,
      handsSincePower: POWER_BLOCK_CONFIG.cooldownHands,
      tension,
      hadPerfectClear: false,
      usedPowerBlock: false,
      startedAt: Date.now(),
      clearingCells: [],
      lastClear: null,
      lastAward: null,
      armedPowerUp: null,
      runRewards: null,
      /**
       * A revived run is persisted while still in flight, so the save may
       * already carry what it was paid. Zeroing it here would re-pay the whole
       * run on the next game over.
       */
      banked: session.banked ?? EMPTY_BANKED_RUN,
    });
    // Seeded from the save, so quitting and resuming cannot refill the revive
    // budget of a run that has already spent it.
    useMonetizationStore.getState().beginRun(session.revivesUsed);
  },

  /**
   * The core turn. Runs in two beats so the player sees blocks land before they
   * burst:
   *   1. now — board shows the placed piece, cleared cells flagged as bursting
   *   2. +clearTotalMs — cleared cells removed, hand refilled, game-over checked
   */
  placePieceAt(pieceId, row, col) {
    // Land the previous beat first so a fast player is never blocked by an
    // animation that is still playing. Keyed on there *being* a pending beat,
    // not on `status`: a power-up burst leaves the status at 'playing', so a
    // status check missed it and this would then overwrite `clearTimer` without
    // cancelling the timer it pointed at.
    if (pendingSettle) flushPendingClear();

    const state = get();
    if (state.status !== 'playing') return false;

    const index = state.tray.findIndex((slot) => slot?.id === pieceId);
    const piece = index >= 0 ? state.tray[index] : null;
    if (!piece) return false;

    let result;
    try {
      result = resolveTurn({
        board: state.board,
        piece,
        row,
        col,
        combo: state.combo,
        turnsSinceClear: state.turnsSinceClear,
        freezeCharges: state.freezeCharges,
        pulseMeter: state.pulseMeter,
      });
    } catch {
      // Placement was invalid despite the preview — treat as a rejected drop.
      get().registerInvalidDrop();
      return false;
    }

    const tray = state.tray.slice();
    tray[index] = null;

    // Beat 1: everything visible, nothing removed yet.
    const boardWithPiece = state.board.map((r) => r.slice());
    for (const cell of piece.cells) {
      boardWithPiece[row + cell.r][col + cell.c] = {
        colorId: piece.colorId,
        power: cell.power,
      };
    }

    const score = state.score + result.score.total;
    const bestComboThisRun = Math.max(state.bestComboThisRun, result.combo);
    const linesClearedThisRun = state.linesClearedThisRun + result.linesCleared;

    playSfx('place');
    haptics.light();

    if (result.linesCleared > 0) {
      playClearSfx(result.linesCleared, result.combo);
      haptics.medium();
      if (result.combo >= 2) {
        playComboSfx(result.combo);
        haptics.combo(result.combo);
      }
      track('line_clear', { lines: result.linesCleared, combo: result.combo });
      if (result.combo >= 2) track('combo_level', { combo: result.combo });
    }
    if (result.triggers.length > 0) {
      playTriggerFeedback(result.triggers);
      track('power_block_triggered', {
        types: result.triggers.map((t) => t.type).join(','),
      });
    }

    const clearEvent: ClearEvent | null =
      result.clearedCells.length > 0
        ? {
            id: (eventId += 1),
            cells: result.clearedCells,
            linesCleared: result.linesCleared,
            combo: result.combo,
            tier: comboTier(result.combo),
            triggers: result.triggers,
            points: result.score.total,
            perfectClear: result.perfectClear,
          }
        : null;

    set({
      status: result.clearedCells.length > 0 ? 'clearing' : 'playing',
      board: boardWithPiece,
      tray,
      occupancyGrid: toOccupancyGrid(boardWithPiece),
      score,
      combo: result.combo,
      bestComboThisRun,
      turnsSinceClear: result.turnsSinceClear,
      freezeCharges: result.freezeCharges,
      pulseMeter: result.pulseMeter,
      linesClearedThisRun,
      clearingCells: result.clearedCells,
      lastClear: clearEvent,
      hadPerfectClear: state.hadPerfectClear || result.perfectClear,
      usedPowerBlock: state.usedPowerBlock || result.triggers.length > 0,
      armedPowerUp: null,
    });

    const settle = () => {
      clearTimer = null;
      pendingSettle = null;
      const s = get();
      if (s.status === 'idle' || s.status === 'gameover') return;

      const board = result.board;
      let nextTray = s.tray;
      let round = s.round;
      let handsSincePower = s.handsSincePower;

      if (nextTray.every((slot) => slot === null)) {
        round += 1;
        nextTray = freshHand(board, round, handsSincePower, s.mode);
        const dealtPower = nextTray.some(
          (slot) => slot?.cells.some((c) => c.power !== null) ?? false,
        );
        handsSincePower = dealtPower ? 0 : handsSincePower + 1;
      }

      // Pulse meter completion pays out a free power-up — Pulse mode only.
      let powerUps = s.powerUps;
      /**
       * A one-shot event, so it must not carry forward. Keeping the previous
       * turn's award alive made it fire again on every remount of GameScreen —
       * navigating to Settings and back announced "free power-up!" for a
       * power-up that was granted minutes ago and is not granted again.
       */
      let award: PowerUpAwardEvent | null = null;
      if (result.pulseFull && getMode(s.mode).pulseMeter) {
        const kind = POWER_UP_KINDS[Math.floor(Math.random() * POWER_UP_KINDS.length)];
        powerUps = { ...powerUps, [kind]: powerUps[kind] + 1 };
        award = { id: (eventId += 1), kind };
        playSfx('power');
        haptics.success();
      }

      const tension = boardTension(board);
      setMusicTension(tension);
      if (tension >= 1 && s.tension < 1) track('near_fail', { score: s.score });

      const over = isGameOver(board, nextTray);

      set({
        status: over ? 'clearing' : 'playing',
        board,
        tray: nextTray,
        occupancyGrid: toOccupancyGrid(board),
        clearingCells: [],
        round,
        handsSincePower,
        powerUps,
        lastAward: award,
        tension,
      });

      if (over) {
        setTimeout(() => {
          if (get().status !== 'clearing') return;
          get().endRun();
        }, ANIMATION.gameOverDelayMs);
      } else {
        get().persist();
      }
    };

    if (result.clearedCells.length > 0) {
      pendingSettle = settle;
      clearTimer = setTimeout(settle, ANIMATION.clearTotalMs);
    } else {
      settle();
    }

    return true;
  },

  registerInvalidDrop() {
    playSfx('invalid');
    haptics.error();
    set({ invalidNonce: get().invalidNonce + 1 });
  },

  armPowerUp(kind) {
    const s = get();
    if (!getMode(s.mode).powerUps) return;
    if (kind && s.powerUps[kind] <= 0) return;
    playSfx('tap');
    haptics.selection();
    set({ armedPowerUp: s.armedPowerUp === kind ? null : kind });
  },

  applyArmedPowerUp(target) {
    const s = get();
    const kind = s.armedPowerUp;
    if (!getMode(s.mode).powerUps) return false;
    if (!kind || kind === 'shuffle' || s.status !== 'playing') return false;

    const inventory = consumePowerUp(s.powerUps, kind);
    if (!inventory) return false;

    const result = applyPowerUp(s.board, kind, target);
    if (result.clearedCells.length === 0) {
      // Nothing to hit — don't charge the player for it.
      set({ armedPowerUp: null });
      return false;
    }

    playSfx(kind === 'bomb' ? 'bomb' : 'lightning');
    haptics.heavy();
    track('power_up_used', { kind, cells: result.clearedCells.length });

    const tension = boardTension(result.board);
    setMusicTension(tension);

    // Land any burst still in flight before starting ours, so its timer can
    // never fire into this one and wipe it mid-animation.
    flushPendingClear();

    set({
      board: result.board,
      occupancyGrid: toOccupancyGrid(result.board),
      powerUps: inventory,
      armedPowerUp: null,
      clearingCells: result.clearedCells,
      tension,
      lastClear: {
        id: (eventId += 1),
        cells: result.clearedCells,
        linesCleared: 0,
        combo: s.combo,
        tier: 'none',
        triggers: [],
        points: 0,
        perfectClear: false,
      },
    });

    /**
     * Routed through the same two-beat slot a placement uses, rather than a bare
     * `setTimeout`. An untracked timer is invisible to `cancelPendingTimers` and
     * to `flushPendingClear`, so using a bomb and then immediately placing a
     * line-clearing piece let the bomb's timer fire into the *next* turn and wipe
     * its `clearingCells` mid-burst — the clear animation just stopped.
     */
    const settleBurst = () => {
      clearTimer = null;
      pendingSettle = null;
      set({ clearingCells: [] });
      get().persist();
    };
    pendingSettle = settleBurst;
    clearTimer = setTimeout(settleBurst, ANIMATION.clearTotalMs);
    return true;
  },

  shuffleHand() {
    const s = get();
    if (!getMode(s.mode).powerUps) return false;
    if (s.status !== 'playing') return false;
    const inventory = consumePowerUp(s.powerUps, 'shuffle');
    if (!inventory) return false;

    const remaining = s.tray.filter((slot) => slot !== null).length;
    if (remaining === 0) return false;

    /**
     * Above `fairnessOccupancyCeiling` the generator stops guaranteeing that a
     * piece fits — and a near-full board is exactly when a player reaches for
     * Refresh. Re-roll a few times before conceding: the guarantee is dropped,
     * but nothing says we have to hand out the first dead hand we drew.
     */
    let tray = s.tray;
    for (let attempt = 0; attempt < GENERATION_CONFIG.fairnessAttempts; attempt += 1) {
      const fresh = generatePieces(s.board, { round: s.round, handSize: remaining });
      let cursor = 0;
      tray = s.tray.map((slot) => (slot === null ? null : (fresh[cursor++] ?? slot)));
      if (!isGameOver(s.board, tray)) break;
    }

    playSfx('power');
    haptics.medium();
    track('power_up_used', { kind: 'shuffle', cells: 0 });

    /**
     * If every re-roll was dead, end the run the same way a settled turn does.
     * Leaving `status: 'playing'` with an unplaceable hand is a soft lock: no
     * game-over sheet, no revive offer, and `endRun` never runs — so the whole
     * run's score, coins and XP are silently discarded, and `persist()` writes
     * the dead board so CONTINUE GAME restores it.
     */
    if (isGameOver(s.board, tray)) {
      set({ tray, powerUps: inventory, armedPowerUp: null, status: 'clearing' });
      setTimeout(() => {
        if (get().status !== 'clearing') return;
        get().endRun();
      }, ANIMATION.gameOverDelayMs);
      return true;
    }

    set({ tray, powerUps: inventory, armedPowerUp: null });
    get().persist();
    return true;
  },

  grantPowerUp(kind, amount = 1) {
    const s = get();
    if (!getMode(s.mode).powerUps) return;
    set({ powerUps: { ...s.powerUps, [kind]: s.powerUps[kind] + amount } });
    playSfx('coin');
    haptics.success();
    // Every other mutation of this inventory persists itself. Without this, a
    // power-up earned from a rewarded ad is lost the moment the player leaves
    // the run from the HUD, and the ad was watched for nothing.
    get().persist();
  },

  /**
   * Buy power-ups with coins.
   *
   * Coins are debited before the inventory is credited, and only if the debit
   * succeeded — so a failed purchase can never hand out a free power-up, and a
   * successful one can never charge without delivering.
   */
  buyPowerUp(kind, quantity) {
    const s = get();
    if (!getMode(s.mode).powerUps) return false;
    if (quantity <= 0) return false;

    const price = powerUpPrice(kind, quantity);
    if (!usePlayerStore.getState().spendCoins(price)) return false;

    set({ powerUps: { ...s.powerUps, [kind]: s.powerUps[kind] + quantity } });
    playSfx('coin');
    haptics.success();
    track('power_up_purchased', { kind, quantity, price });
    // The coins were debited to persistent storage by `spendCoins` already, so
    // not writing the inventory here destroys what the player just paid for.
    get().persist();
    return true;
  },

  reviveRun() {
    cancelPendingTimers();
    const s = get();
    const result = reviveBoard(s.board);

    let tray = s.tray;
    if (tray.every((slot) => slot === null) || isGameOver(result.board, tray)) {
      tray = freshHand(result.board, s.round, POWER_BLOCK_CONFIG.cooldownHands, s.mode);
    }

    const tension = boardTension(result.board);
    setMusicTension(tension);
    playSfx('revive');
    haptics.success();
    track('revive_used', { score: s.score, cleared: result.clearedCells.length });

    set({
      status: 'playing',
      board: result.board,
      tray,
      occupancyGrid: toOccupancyGrid(result.board),
      clearingCells: [],
      revivesUsed: s.revivesUsed + 1,
      tension,
      combo: s.combo,
      runRewards: null,
      lastClear: {
        id: (eventId += 1),
        cells: result.clearedCells,
        linesCleared: 0,
        combo: 0,
        tier: 'none',
        triggers: [],
        points: 0,
        perfectClear: false,
      },
    });
    get().persist();
  },

  /**
   * End the run and bank it.
   *
   * The profile is committed here rather than in the game-over screen, so the
   * player keeps their score, coins and unlocks even if they kill the app before
   * the sheet renders — and so the sheet stays a pure view of `runRewards`.
   */
  endRun() {
    cancelPendingTimers();
    const s = get();
    if (s.status === 'gameover') return;

    playSfx('gameover');
    haptics.heavy();
    track('game_finished', {
      mode: s.mode,
      score: s.score,
      lines: s.linesClearedThisRun,
      best_combo: s.bestComboThisRun,
      duration_seconds: Math.round((Date.now() - s.startedAt) / 1000),
      revives: s.revivesUsed,
    });

    // Bank only what has not been credited yet: a revived run ends twice, and
    // paying for it twice would double coins, XP, lines and games played.
    const run = {
      score: s.score,
      lines: s.linesClearedThisRun,
      bestCombo: s.bestComboThisRun,
    };
    const delta = runDelta(run, s.banked);

    const runRewards = usePlayerStore.getState().commitRun({
      mode: s.mode,
      score: s.score,
      bestCombo: s.bestComboThisRun,
      hadPerfectClear: s.hadPerfectClear,
      usedPowerBlock: s.usedPowerBlock,
      clearedAnyLine: s.linesClearedThisRun > 0,
      linesDelta: delta.lines,
      xpDelta: delta.xp,
      coinsEarned: delta.coins,
      countGame: delta.countGame,
    });
    if (delta.countGame) useMonetizationStore.getState().registerGameCompleted();

    if (runRewards.isHighScore && s.score > 0) {
      setTimeout(() => {
        playSfx('highscore');
        haptics.success();
      }, 260);
    }

    clearSession(s.mode);
    set({
      status: 'gameover',
      clearingCells: [],
      armedPowerUp: null,
      runRewards,
      banked: bankRun(run),
    });
  },

  persist() {
    const s = get();
    if (s.status !== 'playing') return;
    const session: SavedSession = {
      version: SAVE_VERSION,
      mode: s.mode,
      board: s.board,
      tray: s.tray,
      score: s.score,
      combo: s.combo,
      bestComboThisRun: s.bestComboThisRun,
      turnsSinceClear: s.turnsSinceClear,
      freezeCharges: s.freezeCharges,
      pulseMeter: s.pulseMeter,
      linesClearedThisRun: s.linesClearedThisRun,
      revivesUsed: s.revivesUsed,
      powerUps: s.powerUps,
      round: s.round,
      /**
       * What this run has already been credited. A revived run is written to
       * disk mid-flight; without this the resumed run looks unbanked and
       * `runDelta` pays out its coins, XP, lines and game count a second time —
       * the exact double-credit `runBanking` exists to prevent, and farmable.
       */
      banked: s.banked,
      savedAt: Date.now(),
    };
    saveSession(session);
  },

  clearGame() {
    cancelPendingTimers();
    clearSession(get().mode);
    set({ status: 'idle', clearingCells: [], armedPowerUp: null, lastClear: null });
  },
}));

/** Occupancy of the live board, used by the tension visuals. */
export function currentOccupancy(): number {
  return occupancy(useGameStore.getState().board);
}
