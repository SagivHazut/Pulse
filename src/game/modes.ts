import type { GameMode } from '../types';

/**
 * The two ways to play.
 *
 * Everything that differs between them is declared here as data, so the engine,
 * the generator and the UI all branch on capability flags rather than on
 * `mode === 'classic'` checks scattered around the codebase. Adding a third mode
 * means adding an entry, not hunting for conditionals.
 *
 * Note what is deliberately *shared*: combos, scoring, the difficulty ramp, the
 * near-fail tension, the rewarded revive and every cosmetic. Classic is the same
 * game with the power systems switched off — not a lesser one.
 */
export type ModeConfig = {
  id: GameMode;
  name: string;
  tagline: string;
  /** Power tiles baked into generated pieces (bomb, bolt, prism, freeze, pulse). */
  powerTiles: boolean;
  /** The consumable Bomb / Bolt / Refresh toolbar. */
  powerUps: boolean;
  /** The Pulse meter and the free power-up it pays out. */
  pulseMeter: boolean;
};

const CLASSIC: ModeConfig = {
  id: 'classic',
  name: 'Classic',
  tagline: 'Just blocks, lines and combos',
  powerTiles: false,
  powerUps: false,
  pulseMeter: false,
};

const PULSE: ModeConfig = {
  id: 'pulse',
  name: 'Pulse',
  tagline: 'Power blocks, bombs and the Pulse meter',
  powerTiles: true,
  powerUps: true,
  pulseMeter: true,
};

export const MODES: Readonly<Record<GameMode, ModeConfig>> = {
  classic: CLASSIC,
  pulse: PULSE,
};

/** Display order — Classic first, as the simpler way in. */
export const MODE_ORDER: readonly GameMode[] = ['classic', 'pulse'];

export const DEFAULT_MODE: GameMode = 'pulse';

export function getMode(id: string | null | undefined): ModeConfig {
  return id === 'classic' ? CLASSIC : PULSE;
}

export function isGameMode(value: unknown): value is GameMode {
  return value === 'classic' || value === 'pulse';
}
