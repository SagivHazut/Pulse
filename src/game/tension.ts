import { TENSION_CONFIG } from '../constants/config';
import type { Board } from '../types';
import { occupancy } from './engine/board';

export type TensionLevel = 'calm' | 'warn' | 'danger';

/**
 * A 0–1 read on how close the board feels to failure. The UI uses it to warm the
 * background, tighten the music and pulse the board — never to change the rules.
 */
export function tensionFromOccupancy(value: number): number {
  if (value <= TENSION_CONFIG.warn) return 0;
  if (value >= TENSION_CONFIG.danger) return 1;
  return (value - TENSION_CONFIG.warn) / (TENSION_CONFIG.danger - TENSION_CONFIG.warn);
}

export function boardTension(board: Board): number {
  return tensionFromOccupancy(occupancy(board));
}

export function tensionLevel(value: number): TensionLevel {
  if (value >= TENSION_CONFIG.danger) return 'danger';
  if (value >= TENSION_CONFIG.warn) return 'warn';
  return 'calm';
}
