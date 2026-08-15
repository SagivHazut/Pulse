/**
 * Small deterministic PRNG (mulberry32). Seeding keeps engine tests reproducible;
 * gameplay just seeds from the clock.
 */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const defaultRng: Rng = Math.random;

export function randomInt(rng: Rng, minInclusive: number, maxInclusive: number): number {
  return minInclusive + Math.floor(rng() * (maxInclusive - minInclusive + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

/** Weighted pick. `weights` must be the same length as `items` and sum > 0. */
export function pickWeighted<T>(rng: Rng, items: readonly T[], weights: readonly number[]): T {
  let total = 0;
  for (const w of weights) total += w;
  let roll = rng() * total;
  for (let i = 0; i < items.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
