/**
 * Seeded RNG.
 *
 * The whole rules core is deterministic: identical seed + identical command
 * sequence must produce an identical event log. That is what makes save files
 * portable, the AI reproducible, and the balance simulator meaningful.
 *
 * The generator state is a single uint32 so it serialises into a save slot as
 * a plain number. `mulberry32` is used because it is tiny, fast, and has good
 * enough statistical quality for damage variance and AI tie-breaks.
 */

/** Immutable RNG state. Carried inside GameState and advanced functionally. */
export type RngState = number;

/** A draw: the value produced, plus the state to carry forward. */
export interface Draw<T> {
  readonly value: T;
  readonly rng: RngState;
}

/** Hashes an arbitrary string into a uint32 seed (FNV-1a). */
export function seedFromString(text: string): RngState {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Advances the state one step and returns a float in [0, 1). */
export function nextFloat(state: RngState): Draw<number> {
  const t = (state + 0x6d2b79f5) >>> 0;
  let r = t;
  r = Math.imul(r ^ (r >>> 15), r | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  return { value: ((r ^ (r >>> 14)) >>> 0) / 4294967296, rng: t };
}

/** Integer in [min, max] inclusive. */
export function nextInt(state: RngState, min: number, max: number): Draw<number> {
  if (max < min) throw new Error(`nextInt: max (${max}) < min (${min})`);
  const { value, rng } = nextFloat(state);
  return { value: min + Math.floor(value * (max - min + 1)), rng };
}

/** Float in [min, max). Used for damage variance. */
export function nextRange(state: RngState, min: number, max: number): Draw<number> {
  const { value, rng } = nextFloat(state);
  return { value: min + value * (max - min), rng };
}

/** True with probability `chance` (0..1). Values outside the range clamp. */
export function nextChance(state: RngState, chance: number): Draw<boolean> {
  const { value, rng } = nextFloat(state);
  return { value: value < chance, rng };
}

/** Picks one element. Throws on an empty list rather than returning undefined. */
export function pick<T>(state: RngState, items: readonly T[]): Draw<T> {
  if (items.length === 0) throw new Error('pick: empty list');
  const { value, rng } = nextInt(state, 0, items.length - 1);
  const chosen = items[value];
  if (chosen === undefined) throw new Error('pick: index out of range');
  return { value: chosen, rng };
}

/** Fisher-Yates on a copy. Never mutates the input. */
export function shuffle<T>(state: RngState, items: readonly T[]): Draw<T[]> {
  const out = [...items];
  let rng = state;
  for (let i = out.length - 1; i > 0; i--) {
    const draw = nextInt(rng, 0, i);
    rng = draw.rng;
    const j = draw.value;
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) continue;
    out[i] = b;
    out[j] = a;
  }
  return { value: out, rng };
}

/**
 * A mutable cursor over the functional API.
 *
 * Handy inside a single reducer step where threading `rng` by hand would bury
 * the logic. Always read `.state` back out and store it on the new GameState.
 */
export class RngCursor {
  constructor(public state: RngState) {}

  float(): number {
    const d = nextFloat(this.state);
    this.state = d.rng;
    return d.value;
  }

  int(min: number, max: number): number {
    const d = nextInt(this.state, min, max);
    this.state = d.rng;
    return d.value;
  }

  range(min: number, max: number): number {
    const d = nextRange(this.state, min, max);
    this.state = d.rng;
    return d.value;
  }

  chance(probability: number): boolean {
    const d = nextChance(this.state, probability);
    this.state = d.rng;
    return d.value;
  }

  pick<T>(items: readonly T[]): T {
    const d = pick(this.state, items);
    this.state = d.rng;
    return d.value;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const d = shuffle(this.state, items);
    this.state = d.rng;
    return d.value;
  }
}
