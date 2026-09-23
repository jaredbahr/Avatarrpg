import type { Vec2 } from '../core/types';
import type { Edges } from './geometry/board';
import { tileNoise } from './painters/shapes';

/** Shared material treatment; the complete rules tile always receives a wash. */
export const SURFACE_BANK = { width: 0.075, line: 0.018, alpha: 0.48 } as const;
export const SURFACE_POOL = { depth: 0.085, alpha: 0.32 } as const;

/**
 * The bank a pool meets dry ground with.
 *
 * A tile is squared by the rules, so the wash has to cover the whole of it; a
 * straight rim on that edge, though, makes a mud patch read as a filled
 * rectangle. The rim therefore wanders inside the tile by a seeded amount, and
 * `spread` gives the WebGL shader the same wander over its own noise so a pool
 * does not change character between the two backends. Every point stays inside
 * the tile: decoration may soften a hazard's outline, never move it.
 */
export const SURFACE_RIM = {
  steps: 6,
  min: 0.35,
  wobble: 0.55,
  spread: 0.06,
  /** The wash thins over this much of the tile at an open edge. */
  wash: { min: 0.06, span: 0.11 },
  /** Base coat and firmer interior coat, as fractions of the material alpha. */
  coat: { base: 0.42, interior: 0.78 },
} as const;

/**
 * A rubble wash seated on its heap art: full strength out to `inner` and gone
 * by `outer`, as distances from the cell's centre where 1 is the middle of an
 * edge. It ends inside the cell on every side, so it never draws the diamond.
 */
export const SURFACE_SEAT = { inner: 0.35, outer: 0.85 } as const;

/** Tile-local points, `0..1` on each axis. */
export type RimPoints = readonly (readonly [number, number])[];

export interface SurfaceRim {
  /** The tile's own edge: the outer boundary of the bank. */
  readonly outer: RimPoints;
  /** The bank's ragged inner boundary. */
  readonly bank: RimPoints;
  /** The deeper boundary the heavy material gathers along. */
  readonly pool: RimPoints;
}

/** One ragged bank per edge that meets something else, in n, e, s, w order. */
export function surfaceRim(pos: Vec2, edges: Edges): readonly SurfaceRim[] {
  const out: SurfaceRim[] = [];
  const sides = [edges.n, edges.e, edges.s, edges.w];
  for (let side = 0; side < sides.length; side++) {
    if (!sides[side]) continue;
    const outer: [number, number][] = [];
    const bank: [number, number][] = [];
    const pool: [number, number][] = [];
    for (let step = 0; step <= SURFACE_RIM.steps; step++) {
      const along = step / SURFACE_RIM.steps;
      outer.push(perimeterPoint(side, along, 0));
      bank.push(perimeterPoint(side, along, bankDepth(pos, side, step)));
      pool.push(perimeterPoint(side, along, poolDepth(pos, side, step)));
    }
    out.push({ outer, bank, pool });
  }
  return out;
}

/**
 * The one ragged outline a whole tile's material is drawn inside, in n, e, s, w
 * order. A side that meets the same material stays on the tile's own edge, so a
 * puddle four tiles wide is still one pool and not four rimmed squares.
 */
export function surfaceOutline(pos: Vec2, edges: Edges): RimPoints {
  const sides = [edges.n, edges.e, edges.s, edges.w];
  const out: [number, number][] = [];
  for (let side = 0; side < sides.length; side++)
    for (let step = 0; step <= SURFACE_RIM.steps; step++) {
      const along = step / SURFACE_RIM.steps;
      const depth = sides[side]
        ? SURFACE_RIM.wash.min +
          SURFACE_RIM.wash.span * tileNoise(pos.x, pos.y, side * 29 + step * 5 + 71)
        : 0;
      out.push(perimeterPoint(side, along, depth));
    }
  return out;
}

/** The faint band inside an open edge, thinner and thicker at random. */
function bankDepth(pos: Vec2, side: number, step: number): number {
  return (
    SURFACE_BANK.width *
    (SURFACE_RIM.min + SURFACE_RIM.wobble * tileNoise(pos.x, pos.y, side * 31 + step * 7 + 11))
  );
}

/** How far the heavy material gathers inside that edge. */
function poolDepth(pos: Vec2, side: number, step: number): number {
  return SURFACE_POOL.depth * (0.25 + 0.75 * tileNoise(pos.x, pos.y, side * 17 + step + 4));
}

/**
 * A point on the tile's own perimeter, walked clockwise from its north-west
 * corner, `depth` into the tile from the edge it sits on. One walk order keeps
 * a closed ragged outline simple instead of folding it over itself at a corner.
 */
function perimeterPoint(side: number, along: number, depth: number): [number, number] {
  if (side === 0) return [along, depth];
  if (side === 1) return [1 - depth, along];
  if (side === 2) return [1 - along, 1 - depth];
  return [depth, 1 - along];
}

/** Permanent surfaces stay solid; temporary ones thin without disappearing. */
export function surfaceIntensity(duration: number): number {
  return duration < 0 ? 1 : Math.min(1, 0.45 + duration / 6);
}
