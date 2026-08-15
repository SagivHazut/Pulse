import { COMBO_CONFIG, SCORING } from '../../constants/config';
import type { PowerTrigger, ScoreBreakdown } from '../../types';

/**
 * Multiplier applied to line score for the current combo level.
 * Combo 1 (first clear of a chain) is 1x; each further step adds `comboStep`.
 */
export function comboMultiplier(combo: number): number {
  if (combo <= 1) return 1;
  return Math.min(SCORING.maxComboMultiplier, 1 + (combo - 1) * SCORING.comboStep);
}

/** Multi-line bonus: two lines at once are worth more than two lines apart. */
export function multiLineMultiplier(linesCleared: number): number {
  if (linesCleared <= 1) return 1;
  return 1 + (linesCleared - 1) * SCORING.multiLineStep;
}

export type ScoreInput = {
  tilesPlaced: number;
  linesCleared: number;
  combo: number;
  triggers: readonly PowerTrigger[];
  perfectClear: boolean;
};

export function calculateScore(input: ScoreInput): ScoreBreakdown {
  const placement = input.tilesPlaced * SCORING.perTile;

  const rawLineScore =
    input.linesCleared * SCORING.perLine * multiLineMultiplier(input.linesCleared);
  const lines = Math.round(rawLineScore);

  const multiplier = comboMultiplier(input.combo);
  const combo = input.linesCleared > 0 ? Math.round(rawLineScore * (multiplier - 1)) : 0;

  let power = 0;
  for (const trigger of input.triggers) {
    power += SCORING.powerBonus[trigger.type] ?? 0;
  }

  const perfectClear = input.perfectClear ? SCORING.perfectClear : 0;

  return {
    placement,
    lines,
    combo,
    power,
    perfectClear,
    total: placement + lines + combo + power + perfectClear,
  };
}

/** Coins awarded at the end of a run. */
export function calculateCoins(score: number, bestCombo: number): number {
  const fromScore = Math.floor(score * SCORING.coinsPerPoint);
  const fromCombo = Math.max(0, bestCombo - 1) * SCORING.coinsPerBestComboStep;
  return fromScore + fromCombo;
}

/** Visual tier used to escalate the combo treatment. */
export type ComboTier = 'none' | 'normal' | 'hype' | 'dramatic';

export function comboTier(combo: number): ComboTier {
  if (combo < 2) return combo === 1 ? 'normal' : 'none';
  if (combo >= COMBO_CONFIG.dramaticThreshold) return 'dramatic';
  if (combo >= COMBO_CONFIG.hypeThreshold) return 'hype';
  return 'normal';
}
