import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import {
  MUSIC_SOURCES,
  SFX_GAINS,
  SFX_POOL_SIZE,
  SFX_SOURCES,
  type SfxName,
} from './sounds';

/**
 * Audio service.
 *
 * Two rules shape this file:
 *  - Audio must never break gameplay. Every call is wrapped; a failed player is
 *    dropped and the game carries on in silence.
 *  - Music is two synchronised loops (calm + tension) that crossfade with board
 *    pressure, so tension rises without the track ever restarting.
 */

type Pool = { players: AudioPlayer[]; next: number };

const sfxPools = new Map<SfxName, Pool>();
let musicBase: AudioPlayer | null = null;
let musicTension: AudioPlayer | null = null;

let soundEnabled = true;
let musicEnabled = true;
let initialized = false;
let tension = 0;

const MUSIC_BASE_VOLUME = 0.34;
const MUSIC_TENSION_VOLUME = 0.4;

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

export async function initAudio(options: {
  soundEnabled: boolean;
  musicEnabled: boolean;
}): Promise<void> {
  soundEnabled = options.soundEnabled;
  musicEnabled = options.musicEnabled;
  if (initialized) return;
  initialized = true;

  await safe(() =>
    setAudioModeAsync({
      playsInSilentMode: false,
      // Short UI sounds — never steal audio focus from the player's own music.
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
    }),
  )?.catch(() => undefined);

  for (const name of Object.keys(SFX_SOURCES) as SfxName[]) {
    const size = SFX_POOL_SIZE[name] ?? 1;
    const players: AudioPlayer[] = [];
    for (let i = 0; i < size; i += 1) {
      const player = safe(() => createAudioPlayer(SFX_SOURCES[name]));
      if (player) {
        safe(() => {
          player.volume = SFX_GAINS[name];
        });
        players.push(player);
      }
    }
    if (players.length > 0) sfxPools.set(name, { players, next: 0 });
  }

  musicBase = safe(() => createAudioPlayer(MUSIC_SOURCES.base)) ?? null;
  musicTension = safe(() => createAudioPlayer(MUSIC_SOURCES.tension)) ?? null;

  for (const player of [musicBase, musicTension]) {
    if (!player) continue;
    safe(() => {
      player.loop = true;
      player.volume = 0;
    });
  }
}

export function setSoundEnabled(value: boolean): void {
  soundEnabled = value;
}

export function setMusicEnabled(value: boolean): void {
  musicEnabled = value;
  if (!value) {
    for (const player of [musicBase, musicTension]) {
      safe(() => player?.pause());
    }
  } else {
    startMusic();
  }
}

/**
 * Play a sound effect.
 * `pitch` shifts playback rate — the combo ladder uses it to climb.
 */
export function playSfx(name: SfxName, opts: { pitch?: number; volume?: number } = {}): void {
  if (!soundEnabled) return;
  const pool = sfxPools.get(name);
  if (!pool || pool.players.length === 0) return;

  const player = pool.players[pool.next];
  pool.next = (pool.next + 1) % pool.players.length;

  safe(() => {
    player.volume = (opts.volume ?? 1) * SFX_GAINS[name];
    if (opts.pitch && opts.pitch !== 1) {
      player.setPlaybackRate(Math.max(0.5, Math.min(2, opts.pitch)));
    } else if (player.playbackRate !== 1) {
      player.setPlaybackRate(1);
    }
    void player.seekTo(0).catch(() => undefined);
    player.play();
  });
}

/** Combo ladder: same sample, climbing in pitch, layered at the top end. */
export function playComboSfx(combo: number): void {
  if (combo <= 0) return;
  const pitch = Math.min(1.8, 1 + (combo - 1) * 0.07);
  playSfx('combo', { pitch });
  if (combo >= 5) playSfx('power', { pitch: Math.min(1.6, 1 + (combo - 5) * 0.06), volume: 0.6 });
}

export function playClearSfx(linesCleared: number, combo: number): void {
  const pitch = Math.min(1.6, 1 + Math.max(0, combo - 1) * 0.05);
  playSfx(linesCleared > 1 ? 'clearMulti' : 'clearSingle', { pitch });
}

export function startMusic(): void {
  if (!musicEnabled) return;
  for (const player of [musicBase, musicTension]) {
    if (!player) continue;
    safe(() => {
      if (!player.playing) player.play();
    });
  }
  applyTension(tension);
}

export function stopMusic(): void {
  for (const player of [musicBase, musicTension]) {
    safe(() => player?.pause());
  }
}

/**
 * Crossfade the tension layer in. 0 = calm, 1 = the board is nearly full.
 * The base loop dips slightly so the mix does not just get louder.
 */
export function setMusicTension(value: number): void {
  tension = Math.max(0, Math.min(1, value));
  applyTension(tension);
}

function applyTension(value: number): void {
  if (!musicEnabled) return;
  safe(() => {
    if (musicBase) musicBase.volume = MUSIC_BASE_VOLUME * (1 - 0.35 * value);
    if (musicTension) musicTension.volume = MUSIC_TENSION_VOLUME * value;
  });
}

/** Duck the music while a modal or ad is on screen. */
export function duckMusic(ducked: boolean): void {
  if (!musicEnabled) return;
  safe(() => {
    const factor = ducked ? 0.25 : 1;
    if (musicBase) musicBase.volume = MUSIC_BASE_VOLUME * (1 - 0.35 * tension) * factor;
    if (musicTension) musicTension.volume = MUSIC_TENSION_VOLUME * tension * factor;
  });
}

export function releaseAudio(): void {
  for (const pool of sfxPools.values()) {
    for (const player of pool.players) safe(() => player.remove());
  }
  sfxPools.clear();
  safe(() => musicBase?.remove());
  safe(() => musicTension?.remove());
  musicBase = null;
  musicTension = null;
  initialized = false;
}

export type { SfxName };
