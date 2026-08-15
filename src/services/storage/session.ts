import { GAME_CONFIG, STORAGE_KEYS } from '../../constants/config';
import { MODE_ORDER } from '../../game/modes';
import type { GameMode, SavedSession } from '../../types';
import { getJson, registerPersistedKey, removeItem, setJson } from './index';
import { parseSession } from './schema';

/**
 * Mid-run snapshots, one slot per mode.
 *
 * A single shared slot made "Continue" ambiguous: you could pick Classic on the
 * home screen and then resume a Pulse run. Each mode now keeps its own board, so
 * a run in progress is never disturbed by playing the other mode.
 *
 * A snapshot that fails validation is dropped silently — the player just gets a
 * fresh run rather than a broken one.
 */

const KEYS: Record<GameMode, string> = {
  classic: 'pb.session.classic.v1',
  pulse: 'pb.session.pulse.v1',
};

for (const mode of MODE_ORDER) registerPersistedKey(KEYS[mode]);
/** The pre-modes single slot, kept registered so it can be migrated once. */
registerPersistedKey(STORAGE_KEYS.session);

function read(key: string): SavedSession | null {
  const raw = getJson<unknown>(key);
  if (raw === undefined) return null;
  const parsed = parseSession(raw, GAME_CONFIG.rows, GAME_CONFIG.columns);
  if (!parsed) {
    removeItem(key);
    return null;
  }
  return parsed;
}

export function saveSession(session: SavedSession): void {
  setJson(KEYS[session.mode], session);
}

/**
 * Move a pre-modes snapshot into its own mode's slot.
 *
 * Runs at most once. It files the session under whichever mode it claims (Pulse,
 * for anything saved before modes existed) rather than under the mode being
 * asked for — otherwise checking Classic first would delete a Pulse run.
 */
function migrateLegacySlot(): void {
  const raw = getJson<unknown>(STORAGE_KEYS.session);
  if (raw === undefined) return;
  removeItem(STORAGE_KEYS.session);
  const legacy = parseSession(raw, GAME_CONFIG.rows, GAME_CONFIG.columns);
  if (legacy) saveSession(legacy);
}

export function loadSession(mode: GameMode): SavedSession | null {
  const existing = read(KEYS[mode]);
  if (existing) return existing;
  migrateLegacySlot();
  return read(KEYS[mode]);
}

export function hasSession(mode: GameMode): boolean {
  return loadSession(mode) !== null;
}

/** Which modes currently have a run in progress. */
export function sessionModes(): Record<GameMode, boolean> {
  return {
    classic: hasSession('classic'),
    pulse: hasSession('pulse'),
  };
}

export function clearSession(mode: GameMode): void {
  removeItem(KEYS[mode]);
}
