/**
 * Ground-line measurements of the true Ba Dan pieces (`art/source/ba-dan-true/pins.json`), the
 * counterpart of `art/source/ba-dan-restyle/fine/pins.json` for pieces painted on the guides
 * (`scripts/art/ba-dan-guides`) instead of conformed. A guide's ground lines are exact tile lines
 * (slope +0.5 down to the right on grid x, -0.5 on grid y), so the windows are not tuned to a
 * painting: each is the longest run of columns over which the piece's lower silhouette lies on
 * one such line, found from the packed source, and `ba-dan-projection.test.ts` then measures the
 * shipped WebP over the same windows and fails any piece more than a degree off the tile line.
 * A table has no continuous foot, so its two directions are the feet of its legs.
 *
 * Usage: node --import tsx scripts/art/ba-dan-true-pins.ts
 */
import { writeFileSync } from 'node:fs';
import { readImage } from './lib/image';
import type { Direction, GroundSpec, Window } from './lib/ba-dan-projection';
import { lowerEnvelope } from './lib/ba-dan-projection';
import { DRESSING_PIECES, TRUE_PIECES } from './ba-dan-true-pieces';

export const TRUE_PINS = 'art/source/ba-dan-true/pins.json';
/** The set dressing and the two wall runs: measured on the packed sources, not on shipped files (they ship in an atlas). */
export const DRESSING_PINS = 'art/source/ba-dan-true/pins-dressing.json';
export const WALL_RUNS = ['north-west', 'west-south'] as const;
const TOL = 1.5;
const MIN_RUN = 30;

/** The longest run of columns whose lower envelope sits on `y = slope * x + c` for some c. */
function longestRun(env: Int32Array, slope: number): Window | null {
  let best: Window | null = null;
  const offsets = new Set<number>();
  for (let x = 0; x < env.length; x++)
    if ((env[x] ?? -1) >= 0) offsets.add(Math.round((env[x]! - slope * x) / 2));
  for (const half of offsets) {
    const c = half * 2;
    let lo = -1;
    for (let x = 0; x <= env.length; x++) {
      const on =
        x < env.length && (env[x] ?? -1) >= 0 && Math.abs(env[x]! - (slope * x + c)) <= TOL;
      if (on && lo < 0) lo = x;
      if (!on && lo >= 0) {
        if (x - 1 - lo >= MIN_RUN && (!best || x - 1 - lo > best[1] - best[0])) best = [lo, x - 1];
        lo = -1;
      }
    }
  }
  return best;
}

/** A leg's foot: the lowest columns near the ground line through the front corner, outermost first. */
function legFeet(env: Int32Array): GroundSpec {
  let front = 0;
  for (let x = 0; x < env.length; x++) if ((env[x] ?? -1) > (env[front] ?? -1)) front = x;
  const yf = env[front] ?? 0;
  const outer = (slope: number, step: 1 | -1): Window => {
    let found = front;
    for (let x = front; x >= 0 && x < env.length; x += step)
      if ((env[x] ?? -1) >= 0 && Math.abs(env[x]! - (yf + slope * (x - front))) <= TOL) found = x;
    return [Math.max(0, found - 4), Math.min(env.length - 1, found + 4)];
  };
  const mid: Window = [Math.max(0, front - 4), Math.min(env.length - 1, front + 4)];
  return { left: { feet: [outer(0.5, -1), mid] }, right: { feet: [mid, outer(-0.5, 1)] } };
}

/**
 * The feet of a piece that stands on posts: the lowest points of the outermost two posts (local
 * maxima of the lower envelope), one window each. A line of posts has one ground direction, so the
 * spec uses the pair for both; `offTile` takes the angle's magnitude, so a pair on the other
 * diagonal measures the same.
 */
export function postFeet(env: Int32Array): GroundSpec {
  const peaks: number[] = [];
  for (let x = 0; x < env.length; x++) {
    const y = env[x] ?? -1;
    if (y < 0) continue;
    let top = true;
    for (let d = -12; d <= 12 && top; d++) if ((env[x + d] ?? -1) > y) top = false;
    if (top && (peaks.length === 0 || x - peaks[peaks.length - 1]! > 12)) peaks.push(x);
  }
  const win = (x: number): Window => [Math.max(0, x - 2), Math.min(env.length - 1, x + 2)];
  const pair = { feet: [win(peaks[0]!), win(peaks[peaks.length - 1]!)] as [Window, Window] };
  return { left: pair, right: pair };
}

/** Pieces measured by their posts; the well's round curb has no tile-line edge (the test fits its ellipse). */
const POSTED = new Set(['laundry-line', 'notice-board']);

/** A run on a tile line in each direction where the silhouette has one, else the feet of the piece's front corner. */
export function measureAny(env: Int32Array): GroundSpec {
  const left = longestRun(env, 0.5);
  const right = longestRun(env, -0.5);
  if (left && right) return { left: { fit: [left] }, right: { fit: [right] } };
  return legFeet(env);
}

export function measureSpec(name: string, env: Int32Array): GroundSpec {
  if (name.startsWith('merchant-display')) return legFeet(env);
  const left = longestRun(env, 0.5);
  const right = longestRun(env, -0.5);
  if (!left || !right) throw new Error(`${name}: no run of the lower silhouette on a tile line`);
  const fit = (w: Window): Direction => ({ fit: [w] });
  return { left: fit(left), right: fit(right) };
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/art/ba-dan-true-pins.ts')) {
  const assets: Record<string, { measure: GroundSpec }> = {};
  for (const name of TRUE_PIECES)
    assets[`true-${name}`] = {
      measure: measureSpec(name, lowerEnvelope(readImage(`art/source/ba-dan-true/${name}.png`))),
    };
  const dressing: Record<string, { measure: GroundSpec }> = {};
  for (const name of DRESSING_PIECES) {
    if (name === 'village-well') continue;
    const env = lowerEnvelope(readImage(`art/source/ba-dan-true/${name}.png`));
    dressing[name] = { measure: POSTED.has(name) ? postFeet(env) : measureAny(env) };
  }
  for (const run of WALL_RUNS)
    dressing[`wall-${run}`] = {
      measure: measureAny(lowerEnvelope(readImage(`art/source/ba-dan-true/walls/${run}.png`))),
    };
  writeFileSync(
    DRESSING_PINS,
    `${JSON.stringify({ projection: { assets: dressing } }, null, 2)}
`,
  );
  writeFileSync(TRUE_PINS, `${JSON.stringify({ projection: { assets } }, null, 2)}\n`);
  console.log(JSON.stringify(assets));
}
