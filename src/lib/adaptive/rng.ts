/**
 * Deterministic pseudo-random utilities.
 *
 * Every quiz stores a 32-bit seed. All randomness for that quiz (which questions,
 * in which order, with which option order) flows from that seed, so a quiz can be
 * reproduced exactly when debugging, and tests are deterministic.
 */

export type Rng = () => number; // returns a float in [0, 1)

/** mulberry32: tiny, fast, good-enough PRNG for shuffling (not for cryptography). */
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

/** Derive a stable 32-bit seed from a string (FNV-1a). */
export function seedFromString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** A fresh non-negative 31-bit seed (fits a Postgres INTEGER). */
export function randomSeed(): number {
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return (buf[0] ?? 0) & 0x7fffffff;
  }
  return Math.floor(Math.random() * 0x7fffffff);
}

/** Fisher–Yates shuffle. Returns a new array; never mutates the input. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/**
 * Weighted random sampling without replacement (Efraimidis–Spirakis A-Res).
 * Each item gets key = u^(1/w); the k largest keys win. Higher weight ⇒ more likely,
 * but low-weight items still have a chance, which is what keeps sessions feeling fresh.
 * Items with weight <= 0 are never chosen.
 *
 * `accept` lets the caller veto an item at pick time (used for per-topic caps).
 */
export function weightedSample<T>(
  items: readonly T[],
  weight: (item: T) => number,
  k: number,
  rng: Rng,
  accept: (item: T, chosen: readonly T[]) => boolean = () => true,
): T[] {
  const keyed: { item: T; key: number }[] = [];
  for (const item of items) {
    const w = weight(item);
    if (!(w > 0) || !Number.isFinite(w)) continue;
    // rng() can return 0; nudge it so log() stays finite.
    const u = Math.max(rng(), Number.EPSILON);
    keyed.push({ item, key: Math.log(u) / w }); // log form of u^(1/w): same ordering, no underflow
  }
  keyed.sort((a, b) => b.key - a.key);

  const chosen: T[] = [];
  for (const { item } of keyed) {
    if (chosen.length >= k) break;
    if (accept(item, chosen)) chosen.push(item);
  }
  return chosen;
}
