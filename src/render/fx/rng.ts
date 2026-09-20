/**
 * Presentation randomness.
 *
 * Particles need noise, and the game's RNG is off limits: it lives on
 * `GameState` and every draw from it is part of the deterministic record
 * (CLAUDE.md, non-negotiable 2). This is a separate, tiny generator seeded
 * per effect instance from where the effect sits in the event log, so the
 * same fight replays the same embers without ever touching the rules.
 */

/** A 32-bit generator; `mulberry32`, small and good enough for confetti. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mixes a few small integers into one seed, so (push, event, tile) never collide by accident. */
export function hashSeed(...parts: readonly number[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    h ^= part >>> 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 13;
  }
  return h >>> 0;
}
