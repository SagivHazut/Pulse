/**
 * Every audio asset in the game, all of it synthesised by `npm run audio`.
 * Adding a sound means adding a line here and a generator in scripts/generate-audio.js.
 */

export const SFX_SOURCES = {
  tap: require('../../../assets/audio/tap.wav'),
  pickup: require('../../../assets/audio/pickup.wav'),
  place: require('../../../assets/audio/place.wav'),
  invalid: require('../../../assets/audio/invalid.wav'),
  clearSingle: require('../../../assets/audio/clear_single.wav'),
  clearMulti: require('../../../assets/audio/clear_multi.wav'),
  combo: require('../../../assets/audio/combo.wav'),
  power: require('../../../assets/audio/power.wav'),
  bomb: require('../../../assets/audio/bomb.wav'),
  lightning: require('../../../assets/audio/lightning.wav'),
  coin: require('../../../assets/audio/coin.wav'),
  revive: require('../../../assets/audio/revive.wav'),
  highscore: require('../../../assets/audio/highscore.wav'),
  gameover: require('../../../assets/audio/gameover.wav'),
} as const;

export type SfxName = keyof typeof SFX_SOURCES;

export const MUSIC_SOURCES = {
  base: require('../../../assets/audio/music_base.wav'),
  tension: require('../../../assets/audio/music_tension.wav'),
} as const;

/** Per-sound mix so nothing jumps out of the blend. */
export const SFX_GAINS: Record<SfxName, number> = {
  tap: 0.5,
  pickup: 0.55,
  place: 0.75,
  invalid: 0.6,
  clearSingle: 0.8,
  clearMulti: 0.9,
  combo: 0.75,
  power: 0.8,
  bomb: 0.85,
  lightning: 0.85,
  coin: 0.7,
  revive: 0.85,
  highscore: 0.9,
  gameover: 0.8,
};

/**
 * Sounds we keep several players for, so rapid repeats overlap instead of
 * cutting each other off (a cascading clear fires many of these at once).
 */
export const SFX_POOL_SIZE: Partial<Record<SfxName, number>> = {
  place: 2,
  clearSingle: 2,
  combo: 2,
  coin: 3,
  power: 2,
  bomb: 2,
  lightning: 2,
};
