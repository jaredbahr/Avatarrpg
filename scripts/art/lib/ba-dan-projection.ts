/**
 * Measure the two ground directions of an upright piece.
 *
 * The Ba Dan board is a 2:1 dimetric grid: every ground line runs at slope +0.5
 * (along grid x, down to the right) or -0.5 (along grid y, up to the right) on
 * screen, 26.57 degrees. A painted piece belongs on that grid only if its own
 * ground lines do too, so this is the one measurement used to conform a master
 * (a one-off affine resample, no longer in the tree, which took the
 * numbers from `pins.json` -> `projection`) and to guard what ships
 * (`ba-dan-projection.test.ts`).
 *
 * A direction is measured on the lower silhouette: for each column, the lowest
 * opaque row is where the piece meets the ground. `fit` takes a robust
 * (Theil-Sen) line through that envelope over windows chosen to hold only the
 * piece's own ground-contact edge (plinth, planter base, bridge stones), never
 * a step, jar or hanging crate; `feet` takes the lowest point inside each of two
 * windows (a table's legs) and the line through them.
 */
import type { Image } from './image';

/** A column range, inclusive, in the pixels of the master the spec was written for. */
export type Window = readonly [number, number];

export type Direction =
  { readonly fit: readonly Window[] } | { readonly feet: readonly [Window, Window] };

/** `left` runs down to the right (slope +0.5 once true); `right` runs up to the right (-0.5). */
export interface GroundSpec {
  readonly left: Direction;
  readonly right: Direction;
}

/** The line `y = slope * x + intercept`, image coordinates (y down). */
export interface Line {
  readonly slope: number;
  readonly intercept: number;
  readonly degrees: number;
}

export const TILE_SLOPE = 0.5;
export const TILE_DEGREES = (Math.atan(TILE_SLOPE) * 180) / Math.PI;

/** Lowest opaque row of every column, -1 where the column is empty. */
export function lowerEnvelope(image: Image): Int32Array {
  const env = new Int32Array(image.width).fill(-1);
  for (let x = 0; x < image.width; x++)
    for (let y = image.height - 1; y >= 0; y--)
      if ((image.data[(y * image.width + x) * 4 + 3] ?? 0) !== 0) {
        env[x] = y;
        break;
      }
  return env;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function line(slope: number, intercept: number): Line {
  return { slope, intercept, degrees: (Math.atan(slope) * 180) / Math.PI };
}

/** The lowest point inside a window; its x is the middle of the columns that tie for it. */
function foot(env: Int32Array, [lo, hi]: Window): { x: number; y: number } {
  let y = -1;
  for (let x = lo; x <= hi; x++) y = Math.max(y, env[x] ?? -1);
  const tied: number[] = [];
  for (let x = lo; x <= hi; x++) if (env[x] === y) tied.push(x);
  return { x: tied.reduce((s, x) => s + x, 0) / tied.length, y };
}

export function fitDirection(env: Int32Array, direction: Direction): Line {
  if ('feet' in direction) {
    const [a, b] = direction.feet.map((w) => foot(env, w)) as [
      { x: number; y: number },
      { x: number; y: number },
    ];
    const slope = (b.y - a.y) / (b.x - a.x);
    return line(slope, a.y - slope * a.x);
  }
  const xs: number[] = [];
  for (const [lo, hi] of direction.fit)
    for (let x = lo; x <= hi; x++) if ((env[x] ?? -1) >= 0) xs.push(x);
  const slopes: number[] = [];
  for (let i = 0; i < xs.length; i++)
    for (let j = i + 1; j < xs.length; j++) {
      const xi = xs[i] ?? 0;
      const xj = xs[j] ?? 0;
      slopes.push(((env[xj] ?? 0) - (env[xi] ?? 0)) / (xj - xi));
    }
  const slope = median(slopes);
  return line(slope, median(xs.map((x) => (env[x] ?? 0) - slope * x)));
}

export function measureGround(
  image: Image,
  spec: GroundSpec,
): { left: Line; right: Line; front: { x: number; y: number } } {
  const env = lowerEnvelope(image);
  const left = fitDirection(env, spec.left);
  const right = fitDirection(env, spec.right);
  // The two ground lines meet at the footprint's front corner.
  const x = (right.intercept - left.intercept) / (left.slope - right.slope);
  return { left, right, front: { x, y: left.slope * x + left.intercept } };
}

/**
 * The same windows, moved with the image: a conform squeezes columns by `a` and
 * shifts them by `shiftX` (`pins.json` -> `projection.assets.*.placed`).
 */
export function scaleSpec(spec: GroundSpec, a: number, shiftX = 0): GroundSpec {
  const win = ([lo, hi]: Window): Window => [
    Math.floor(lo * a + shiftX),
    Math.ceil(hi * a + shiftX),
  ];
  const dir = (d: Direction): Direction =>
    'feet' in d ? { feet: [win(d.feet[0]), win(d.feet[1])] } : { fit: d.fit.map(win) };
  return { left: dir(spec.left), right: dir(spec.right) };
}

/** Degrees a measured ground line lies off the tile line it should be on (either sign). */
export function offTile(measured: Line): number {
  return Math.abs(measured.degrees) - TILE_DEGREES;
}

/** A column the direction's own measurement certainly sits on: the middle of its window. */
function anchorColumn(direction: Direction): number {
  const [lo, hi] = 'feet' in direction ? direction.feet[1] : (direction.fit[0] ?? [0, 0]);
  return Math.round((lo + hi) / 2);
}

/**
 * The ends of a piece's ground footprint. From the middle of each direction's
 * window, the ground line is followed outward while the lower silhouette stays
 * within `tol` pixels of it (a dozen misses in a row end it), and the last column
 * that did is the corner: the plinth's left and right extremes, where the
 * rectangle on the ground ends.
 */
export function groundEnds(
  env: Int32Array,
  spec: GroundSpec,
  measured: { left: Line; right: Line },
  tol = 4,
): { left: number; right: number } {
  const follow = (fitted: Line, from: number, step: 1 | -1): number => {
    let end = from;
    for (let x = from, misses = 0; x >= 0 && x < env.length && misses < 12; x += step) {
      const y = env[x] ?? -1;
      if (y >= 0 && Math.abs(y - (fitted.slope * x + fitted.intercept)) <= tol) {
        end = x;
        misses = 0;
      } else misses++;
    }
    return end;
  };
  return {
    left: follow(measured.left, anchorColumn(spec.left), -1),
    right: follow(measured.right, anchorColumn(spec.right), 1),
  };
}
