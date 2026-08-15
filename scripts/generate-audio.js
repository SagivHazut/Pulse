#!/usr/bin/env node
/**
 * Generates every sound in the game from scratch as 16-bit PCM WAV files.
 *
 * The game ships no sampled or licensed audio — the whole palette is synthesised
 * here, so it is original by construction and regenerable with one command:
 *
 *   npm run audio
 *
 * Output: assets/audio/*.wav
 */
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'audio');

// ---------------------------------------------------------------- primitives

const TAU = Math.PI * 2;

/** MIDI-ish helper: semitones above A3 (220 Hz). */
function note(semitonesAboveA3) {
  return 220 * Math.pow(2, semitonesAboveA3 / 12);
}

function seconds(n) {
  return Math.round(n * SAMPLE_RATE);
}

function makeBuffer(durationSec) {
  return new Float64Array(seconds(durationSec));
}

/** Attack/decay envelope with an optional sustain plateau. */
function env(t, duration, attack = 0.005, release = 0.08, curve = 2) {
  if (t < attack) return Math.pow(t / attack, 0.7);
  const releaseStart = duration - release;
  if (t >= releaseStart) {
    const p = Math.max(0, 1 - (t - releaseStart) / release);
    return Math.pow(p, curve);
  }
  return 1;
}

function sine(phase) {
  return Math.sin(phase);
}
function triangle(phase) {
  const p = (phase / TAU) % 1;
  return 4 * Math.abs(p - 0.5) - 1;
}
function square(phase) {
  return Math.sin(phase) >= 0 ? 1 : -1;
}
function saw(phase) {
  const p = (phase / TAU) % 1;
  return 2 * p - 1;
}

let noiseSeed = 0x1a2b3c4d;
function noise() {
  // xorshift so runs are reproducible
  noiseSeed ^= noiseSeed << 13;
  noiseSeed ^= noiseSeed >>> 17;
  noiseSeed ^= noiseSeed << 5;
  noiseSeed |= 0;
  return (noiseSeed / 0x80000000) % 1;
}

/**
 * Add a tone to `buf`.
 * freq may be a number or a function of normalised time (0..1) for sweeps.
 */
function tone(buf, opts) {
  const {
    start = 0,
    duration,
    freq,
    gain = 0.3,
    wave = sine,
    attack = 0.005,
    release = 0.08,
    curve = 2,
    detune = 0,
    vibrato = 0,
    vibratoRate = 6,
  } = opts;

  const startIdx = seconds(start);
  const n = seconds(duration);
  let phase = 0;
  let phase2 = 0;

  for (let i = 0; i < n; i += 1) {
    const idx = startIdx + i;
    if (idx >= buf.length) break;
    const t = i / SAMPLE_RATE;
    const p = i / n;
    const baseFreq = typeof freq === 'function' ? freq(p) : freq;
    const vib = vibrato ? 1 + vibrato * Math.sin(TAU * vibratoRate * t) : 1;
    const f = baseFreq * vib;

    phase += (TAU * f) / SAMPLE_RATE;
    let sample = wave(phase);

    if (detune) {
      phase2 += (TAU * f * (1 + detune)) / SAMPLE_RATE;
      sample = (sample + wave(phase2)) * 0.5;
    }

    buf[idx] += sample * gain * env(t, duration, attack, release, curve);
  }
}

/** Add filtered noise (one-pole lowpass) — used for impacts and zaps. */
function noiseBurst(buf, opts) {
  const {
    start = 0,
    duration,
    gain = 0.3,
    cutoff = 0.35,
    cutoffEnd = null,
    attack = 0.002,
    release = 0.12,
    curve = 2.5,
  } = opts;

  const startIdx = seconds(start);
  const n = seconds(duration);
  let last = 0;

  for (let i = 0; i < n; i += 1) {
    const idx = startIdx + i;
    if (idx >= buf.length) break;
    const t = i / SAMPLE_RATE;
    const p = i / n;
    const a = cutoffEnd === null ? cutoff : cutoff + (cutoffEnd - cutoff) * p;
    last += a * (noise() - last);
    buf[idx] += last * gain * env(t, duration, attack, release, curve);
  }
}

/** Soft-clip then write a mono WAV. */
function writeWav(name, buf) {
  const samples = new Int16Array(buf.length);
  for (let i = 0; i < buf.length; i += 1) {
    // tanh-ish soft clip keeps peaks musical instead of crunchy
    const x = buf[i];
    const clipped = x / (1 + Math.abs(x) * 0.4);
    samples[i] = Math.max(-32767, Math.min(32767, Math.round(clipped * 32767)));
  }

  const dataLength = samples.length * 2;
  const out = Buffer.alloc(44 + dataLength);
  out.write('RIFF', 0);
  out.writeUInt32LE(36 + dataLength, 4);
  out.write('WAVE', 8);
  out.write('fmt ', 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20); // PCM
  out.writeUInt16LE(1, 22); // mono
  out.writeUInt32LE(SAMPLE_RATE, 24);
  out.writeUInt32LE(SAMPLE_RATE * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36);
  out.writeUInt32LE(dataLength, 40);
  for (let i = 0; i < samples.length; i += 1) {
    out.writeInt16LE(samples[i], 44 + i * 2);
  }

  const file = path.join(OUT_DIR, `${name}.wav`);
  fs.writeFileSync(file, out);
  const kb = (out.length / 1024).toFixed(0);
  console.log(`  ${name}.wav  ${kb} KB`);
}

/** Fade the first and last `ms` so a looped file has no seam. */
function loopFade(buf, ms = 40) {
  const n = seconds(ms / 1000);
  for (let i = 0; i < n; i += 1) {
    const g = i / n;
    buf[i] *= g;
    buf[buf.length - 1 - i] *= g;
  }
}

// -------------------------------------------------------------------- sounds

// A minor pentatonic — the whole game sits in one scale so nothing ever clashes.
const SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
const s = (i) => note(SCALE[i]);

const SFX = {
  tap() {
    const buf = makeBuffer(0.07);
    tone(buf, { duration: 0.07, freq: s(5), gain: 0.22, wave: sine, release: 0.05 });
    return buf;
  },

  pickup() {
    const buf = makeBuffer(0.1);
    tone(buf, {
      duration: 0.1,
      freq: (p) => s(3) * (1 + 0.35 * p),
      gain: 0.2,
      wave: triangle,
      release: 0.06,
    });
    return buf;
  },

  place() {
    const buf = makeBuffer(0.14);
    tone(buf, { duration: 0.12, freq: s(1), gain: 0.28, wave: sine, release: 0.1, curve: 3 });
    tone(buf, { duration: 0.06, freq: s(6), gain: 0.1, wave: triangle, release: 0.05 });
    noiseBurst(buf, { duration: 0.04, gain: 0.06, cutoff: 0.5, release: 0.035 });
    return buf;
  },

  invalid() {
    const buf = makeBuffer(0.18);
    tone(buf, {
      duration: 0.16,
      freq: (p) => 300 - 140 * p,
      gain: 0.16,
      wave: square,
      release: 0.1,
    });
    return buf;
  },

  clear_single() {
    const buf = makeBuffer(0.32);
    [4, 6, 8].forEach((step, i) => {
      tone(buf, {
        start: i * 0.045,
        duration: 0.2,
        freq: s(step),
        gain: 0.2,
        wave: triangle,
        release: 0.16,
      });
    });
    noiseBurst(buf, { duration: 0.12, gain: 0.05, cutoff: 0.6, cutoffEnd: 0.2 });
    return buf;
  },

  clear_multi() {
    const buf = makeBuffer(0.46);
    [4, 6, 8, 9, 10].forEach((step, i) => {
      tone(buf, {
        start: i * 0.045,
        duration: 0.26,
        freq: s(step),
        gain: 0.19,
        wave: triangle,
        release: 0.2,
        detune: 0.004,
      });
    });
    tone(buf, { duration: 0.4, freq: s(0), gain: 0.12, wave: sine, release: 0.3 });
    noiseBurst(buf, { duration: 0.2, gain: 0.06, cutoff: 0.7, cutoffEnd: 0.15 });
    return buf;
  },

  combo() {
    const buf = makeBuffer(0.24);
    tone(buf, {
      duration: 0.22,
      freq: (p) => s(6) * (1 + 0.5 * p),
      gain: 0.17,
      wave: triangle,
      release: 0.14,
    });
    tone(buf, { start: 0.05, duration: 0.16, freq: s(9), gain: 0.1, wave: sine, release: 0.12 });
    return buf;
  },

  power() {
    const buf = makeBuffer(0.4);
    [0, 4, 7, 10].forEach((step, i) => {
      tone(buf, {
        start: i * 0.03,
        duration: 0.3,
        freq: s(step) * 2,
        gain: 0.11,
        wave: sine,
        release: 0.26,
        vibrato: 0.01,
        vibratoRate: 9,
      });
    });
    return buf;
  },

  bomb() {
    const buf = makeBuffer(0.5);
    noiseBurst(buf, {
      duration: 0.45,
      gain: 0.42,
      cutoff: 0.55,
      cutoffEnd: 0.03,
      release: 0.4,
      curve: 2,
    });
    tone(buf, {
      duration: 0.35,
      freq: (p) => 120 - 70 * p,
      gain: 0.3,
      wave: sine,
      release: 0.3,
    });
    return buf;
  },

  lightning() {
    const buf = makeBuffer(0.42);
    noiseBurst(buf, { duration: 0.3, gain: 0.24, cutoff: 0.9, cutoffEnd: 0.35, release: 0.26 });
    tone(buf, {
      duration: 0.3,
      freq: (p) => 900 * (1 - 0.75 * p),
      gain: 0.16,
      wave: saw,
      release: 0.24,
    });
    tone(buf, { start: 0.02, duration: 0.24, freq: s(10) * 2, gain: 0.1, wave: square, release: 0.2 });
    return buf;
  },

  coin() {
    const buf = makeBuffer(0.26);
    tone(buf, { duration: 0.1, freq: s(7) * 2, gain: 0.15, wave: sine, release: 0.08 });
    tone(buf, { start: 0.07, duration: 0.18, freq: s(9) * 2, gain: 0.15, wave: sine, release: 0.15 });
    return buf;
  },

  revive() {
    const buf = makeBuffer(0.85);
    [0, 4, 7, 10, 12].forEach((step, i) => {
      tone(buf, {
        start: i * 0.07,
        duration: 0.5,
        freq: s(step),
        gain: 0.15,
        wave: triangle,
        release: 0.42,
        detune: 0.005,
      });
    });
    noiseBurst(buf, { duration: 0.5, gain: 0.05, cutoff: 0.15, cutoffEnd: 0.6 });
    return buf;
  },

  highscore() {
    const buf = makeBuffer(1.1);
    [4, 6, 8, 10].forEach((step, i) => {
      tone(buf, {
        start: i * 0.11,
        duration: 0.6,
        freq: s(step),
        gain: 0.15,
        wave: triangle,
        release: 0.5,
        detune: 0.006,
      });
    });
    [4, 8].forEach((step, i) => {
      tone(buf, {
        start: 0.44 + i * 0.02,
        duration: 0.6,
        freq: s(step) * 2,
        gain: 0.09,
        wave: sine,
        release: 0.55,
      });
    });
    return buf;
  },

  gameover() {
    const buf = makeBuffer(1.1);
    [7, 5, 3, 0].forEach((step, i) => {
      tone(buf, {
        start: i * 0.13,
        duration: 0.6,
        freq: s(step),
        gain: 0.16,
        wave: triangle,
        release: 0.5,
        detune: 0.008,
      });
    });
    tone(buf, { start: 0.4, duration: 0.6, freq: s(0) / 2, gain: 0.14, wave: sine, release: 0.55 });
    return buf;
  },
};

// --------------------------------------------------------------------- music

const LOOP_SECONDS = 19.2; // 8 bars at 100 BPM
const BEAT = 60 / 100;

function musicBase() {
  const buf = makeBuffer(LOOP_SECONDS);

  // Slow pad: two long chords per 4 bars.
  const chords = [
    [0, 3, 7],
    [0, 5, 10],
    [-2, 3, 7],
    [0, 3, 10],
  ];
  chords.forEach((chord, ci) => {
    const start = ci * (LOOP_SECONDS / chords.length);
    chord.forEach((semi) => {
      tone(buf, {
        start,
        duration: LOOP_SECONDS / chords.length,
        freq: note(semi) / 2,
        gain: 0.05,
        wave: sine,
        attack: 0.9,
        release: 1.2,
        detune: 0.003,
        curve: 1.4,
      });
    });
  });

  // Sparse pentatonic arpeggio, one note every two beats.
  const pattern = [5, 7, 6, 8, 5, 9, 6, 7];
  for (let i = 0; i * BEAT * 2 < LOOP_SECONDS; i += 1) {
    const step = pattern[i % pattern.length];
    tone(buf, {
      start: i * BEAT * 2,
      duration: 1.0,
      freq: s(step),
      gain: 0.055,
      wave: triangle,
      attack: 0.01,
      release: 0.85,
      curve: 2.2,
    });
  }

  loopFade(buf, 60);
  return buf;
}

function musicTension() {
  const buf = makeBuffer(LOOP_SECONDS);

  // Heartbeat pulse on every beat.
  for (let i = 0; i * BEAT < LOOP_SECONDS; i += 1) {
    tone(buf, {
      start: i * BEAT,
      duration: 0.34,
      freq: (p) => 78 - 20 * p,
      gain: 0.13,
      wave: sine,
      attack: 0.004,
      release: 0.3,
      curve: 2.4,
    });
  }

  // Detuned drone that rubs against the base loop.
  tone(buf, {
    duration: LOOP_SECONDS,
    freq: note(0) / 2,
    gain: 0.045,
    wave: saw,
    attack: 1.5,
    release: 1.5,
    detune: 0.012,
    curve: 1.2,
  });

  // High shimmer that keeps the ear alert.
  const pattern = [12, 15, 12, 17];
  for (let i = 0; i * BEAT * 4 < LOOP_SECONDS; i += 1) {
    tone(buf, {
      start: i * BEAT * 4,
      duration: 1.6,
      freq: s(pattern[i % pattern.length] % SCALE.length) * 2,
      gain: 0.03,
      wave: sine,
      attack: 0.4,
      release: 1.1,
    });
  }

  loopFade(buf, 60);
  return buf;
}

// ---------------------------------------------------------------------- main

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('Generating sound effects…');
  for (const [name, make] of Object.entries(SFX)) {
    writeWav(name, make());
  }
  console.log('Generating music loops…');
  writeWav('music_base', musicBase());
  writeWav('music_tension', musicTension());
  console.log(`\nDone → ${path.relative(process.cwd(), OUT_DIR)}`);
}

main();
