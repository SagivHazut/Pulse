import { STORAGE_KEYS } from '../../constants/config';
import type { PlayerData } from '../../types';
import { getJson, registerPersistedKey, setJson } from './index';
import { DEFAULT_PLAYER_DATA, parsePlayerData } from './schema';

/**
 * Single source of truth for the persisted player record.
 *
 * Several stores own different slices of `PlayerData` (progression, settings,
 * cosmetics), but they all read and patch through here so there is exactly one
 * record on disk and no chance of two stores overwriting each other.
 */

registerPersistedKey(STORAGE_KEYS.player);

let current: PlayerData = { ...DEFAULT_PLAYER_DATA };
let loaded = false;

export function loadPlayerData(): PlayerData {
  if (loaded) return current;
  loaded = true;
  current = parsePlayerData(getJson(STORAGE_KEYS.player));
  return current;
}

export function getPlayerData(): PlayerData {
  return loadPlayerData();
}

/** Merge a partial update and persist immediately. */
export function patchPlayerData(patch: Partial<PlayerData>): PlayerData {
  current = { ...loadPlayerData(), ...patch };
  setJson(STORAGE_KEYS.player, current);
  return current;
}

/**
 * Wipe progress but keep what the player earned where we safely can.
 * Used only when a save turns out to be unreadable.
 */
export function resetPlayerData(keepHighScore = true): PlayerData {
  const highScores = keepHighScore
    ? loadPlayerData().highScores
    : { ...DEFAULT_PLAYER_DATA.highScores };
  current = { ...DEFAULT_PLAYER_DATA, highScores };
  setJson(STORAGE_KEYS.player, current);
  return current;
}
