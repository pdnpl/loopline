/**
 * Deterministic pseudo-randomness.
 *
 * Every board is a pure function of its seed, which means a level looks the same
 * on every device and in every test run. `Math.random` would make both
 * impossible.
 */

export type Rng = () => number;

/** mulberry32 — small, fast, good enough distribution for level layout. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** xmur3 string hash — turns a label into a well-mixed 32-bit seed. */
export function hashSeed(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Seed for a level. `attempt` lets the generator retry with a fresh board. */
export function levelSeed(level: number, attempt = 0): number {
  return hashSeed(`loopline:v1:level-${level}:attempt-${attempt}`);
}

/** Integer in `[min, max]`, both inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Fisher–Yates. Returns a new array; the input is left untouched. */
export function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * Picks an item with probability proportional to its weight.
 * Weights must be non-negative and sum to more than zero.
 */
export function weightedPick<T>(rng: Rng, items: readonly T[], weights: readonly number[]): T {
  let total = 0;
  for (let i = 0; i < weights.length; i++) total += weights[i];
  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}
