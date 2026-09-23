import { COMBO_CONFIG, PULSE_METER } from '../../constants/config';
import type { Board, Piece, TurnResult } from '../../types';
import { calculateScore } from '../scoring/scoring';
import { countLines, findCompletedLines, resolveClears } from './lines';
import { placePiece } from './placement';

export type TurnInput = {
  board: Board;
  piece: Piece;
  row: number;
  col: number;
  combo: number;
  turnsSinceClear: number;
  freezeCharges: number;
  pulseMeter: number;
};

export type ResolvedTurn = TurnResult & {
  /** The Pulse meter filled this turn; the caller should grant a power-up. */
  pulseFull: boolean;
};

/**
 * The whole turn in one pure function: place → detect lines → resolve clears and
 * power cascades → update combo, freeze and Pulse meter → score.
 *
 * Nothing here touches React, storage, audio or time, which is what makes the
 * gameplay rules independently testable.
 */
export function resolveTurn(input: TurnInput): ResolvedTurn {
  const placement = placePiece(input.board, input.piece, input.row, input.col);

  const lines = findCompletedLines(placement.board);
  const outcome = resolveClears(placement.board, lines);
  const linesCleared = countLines(lines);

  let combo = input.combo;
  let turnsSinceClear = input.turnsSinceClear;
  let freezeCharges = input.freezeCharges;
  let pulseMeter = input.pulseMeter;

  if (linesCleared > 0) {
    combo += 1;
    turnsSinceClear = 0;
  } else {
    turnsSinceClear += 1;
    if (combo > 0 && turnsSinceClear > COMBO_CONFIG.graceTurns) {
      if (freezeCharges > 0) {
        // A Freeze tile buys one more turn of grace before the chain drops.
        // Winding the counter back to the edge of the window — not to zero —
        // is what makes that one turn. Zeroing it restarted the whole window,
        // so a charge was worth `graceTurns + 1` turns, three times what the
        // tile's own description and the README promise.
        freezeCharges -= 1;
        turnsSinceClear = COMBO_CONFIG.graceTurns;
      } else {
        combo = 0;
      }
    }
  }

  for (const trigger of outcome.triggers) {
    if (trigger.type === 'freeze') freezeCharges += 1;
    if (trigger.type === 'pulse') pulseMeter = PULSE_METER.full;
  }

  if (linesCleared > 0) {
    pulseMeter +=
      linesCleared * PULSE_METER.gainPerLine +
      Math.max(0, combo - 1) * PULSE_METER.gainPerComboStep;
  } else {
    pulseMeter -= PULSE_METER.decayPerIdleTurn;
  }
  pulseMeter = Math.max(0, Math.min(PULSE_METER.full, pulseMeter));

  const pulseFull = pulseMeter >= PULSE_METER.full;
  if (pulseFull) pulseMeter = 0;

  const score = calculateScore({
    tilesPlaced: placement.tilesPlaced,
    linesCleared,
    combo,
    triggers: outcome.triggers,
    perfectClear: outcome.perfectClear,
  });

  return {
    board: outcome.board,
    tilesPlaced: placement.tilesPlaced,
    lines,
    linesCleared,
    clearedCells: outcome.clearedCells,
    triggers: outcome.triggers,
    perfectClear: outcome.perfectClear,
    combo,
    turnsSinceClear,
    freezeCharges,
    pulseMeter,
    pulseFull,
    score,
  };
}

/**
 * Board state after placement but before clears — used by the UI to show blocks
 * landing, then bursting, instead of vanishing on contact.
 */
export function previewPlacement(board: Board, piece: Piece, row: number, col: number): Board {
  return placePiece(board, piece, row, col).board;
}
