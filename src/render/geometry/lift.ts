/**
 * The lift pass: raised ground drawn as blocks (ADR 0065).
 *
 * Both backends first draw the whole ground flat — terrain, authored art,
 * surfaces, overlays — exactly as before. This pass then walks the cells in
 * the order the board is painted (rising x + y) and, for each raised walkable
 * cell, redraws its top `lift` further up the screen, sampled from that flat
 * picture, and fills the gap below with its exposed faces. The result is the
 * same shape `pickCell` hits, so what is drawn is what a tap picks.
 *
 * It is plain data in screen pixels so the two backends interpret one list:
 * Canvas 2D clips and copies from a snapshot, WebGL fills with the ground's
 * render texture. Board correctness, so both draw every op.
 */

import type { Grid, Tile, Vec2 } from '../../core/types';
import { ELEVATION } from '../palettes';
import { TIER_LIFT, liftAt } from './elevation';

export interface Pt {
  readonly x: number;
  readonly y: number;
}

export type LiftOp =
  /** Redraw the flat picture inside `poly`, sampled `shift` pixels further down. */
  | { readonly kind: 'top'; readonly poly: readonly Pt[]; readonly shift: number }
  /** An exposed face: the same copy as a top, sampled from inside the cell's edge. */
  | { readonly kind: 'face'; readonly poly: readonly Pt[]; readonly shift: number }
  | {
      readonly kind: 'fill';
      readonly poly: readonly Pt[];
      readonly color: string;
      readonly alpha: number;
    }
  | {
      readonly kind: 'line';
      readonly a: Pt;
      readonly b: Pt;
      readonly color: string;
      readonly alpha: number;
      readonly width: number;
    };

export interface LiftInput {
  readonly grid: Grid;
  /** Continuous ground point to screen pixels, pan, zoom and shake included. */
  readonly project: (pos: Vec2) => Pt;
  /** One tile in screen pixels. */
  readonly tilePx: number;
  /**
   * How far loaded ground art already lifts a tier, in tiles, or each tier's
   * top in turn (`MapScene.reliefLift`).
   */
  readonly artLift: number | readonly number[];
  /** High contrast: a stronger tier tint and ink. */
  readonly contrast: boolean;
}

const at = (grid: Grid, x: number, y: number): Tile | undefined =>
  x < 0 || y < 0 || x >= grid.width || y >= grid.height
    ? undefined
    : grid.tiles[y * grid.width + x];

/** The ground's four sides: the two corners along each, and the step to the neighbour. */
const SIDES = [
  { dx: 0, dy: -1, a: [0, 0], b: [1, 0] }, // north: upper right
  { dx: 1, dy: 0, a: [1, 1], b: [1, 0] }, // east: lower right
  { dx: 0, dy: 1, a: [0, 1], b: [1, 1] }, // south: lower left
  { dx: -1, dy: 0, a: [0, 0], b: [0, 1] }, // west: upper left
] as const;

export function liftOps(input: LiftInput): LiftOp[] {
  const { grid, project, tilePx, artLift, contrast } = input;
  // Art painted at the full lift draws its own blocks; it stays in charge.
  if (typeof artLift === 'number' && artLift >= TIER_LIFT) return [];
  const lift = (x: number, y: number) => liftAt(grid, { x, y }, 'oblique');
  const ops: LiftOp[] = [];
  const point = (gx: number, gy: number, up: number): Pt => {
    const p = project({ x: gx, y: gy });
    return { x: p.x, y: p.y - up * tilePx };
  };
  const ink = Math.max(1, tilePx * 0.022);

  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) cells.push({ x, y });
  cells.sort((p, q) => p.x + p.y - (q.x + q.y) || p.x - q.x);

  for (const { x, y } of cells) {
    const tile = at(grid, x, y);
    if (!tile || tile.blocked) continue;
    const mine = lift(x, y);
    const quad = (x0: number, y0: number, x1: number, y1: number, up: number): Pt[] => [
      point(x + x0, y + y0, up),
      point(x + x1, y + y0, up),
      point(x + x1, y + y1, up),
      point(x + x0, y + y1, up),
    ];

    // How far the art already lifts this cell's top.
    const art =
      typeof artLift === 'number' ? artLift * tile.elevation : (artLift[tile.elevation - 1] ?? 0);
    if (mine > 0) {
      const top = quad(0, 0, 1, 1, mine);
      ops.push({ kind: 'top', poly: top, shift: (mine - art) * tilePx });
      ops.push({
        kind: 'fill',
        poly: top,
        color: ELEVATION.tint,
        alpha: ELEVATION.tintPerTier * tile.elevation * (contrast ? 2 : 1),
      });
    }

    // A higher block to the north or west shades this cell's top along that side.
    for (const side of [SIDES[0], SIDES[3]]) {
      const other = at(grid, x + side.dx, y + side.dy);
      const drop = other && !other.blocked ? lift(x + side.dx, y + side.dy) - mine : 0;
      if (drop <= 0) continue;
      const depth = Math.min(0.45, 0.3 * (drop / TIER_LIFT));
      for (const k of [1, 0.66, 0.33]) {
        const d = depth * k;
        ops.push({
          kind: 'fill',
          poly: side.dx === 0 ? quad(0, 0, 1, d, mine) : quad(0, 0, d, 1, mine),
          color: ELEVATION.shadow,
          alpha: 0.11,
        });
      }
    }
    if (mine <= 0) continue;

    // A wall stands no lift of its own, but its painted rock is at least as
    // high as this cell: a face toward it only drops the one tier this cell
    // stands above the tier beneath, not all the way to the floor.
    const down = SIDES.map((side) => {
      const other = at(grid, x + side.dx, y + side.dy);
      const walled = other?.blocked && other.elevation >= tile.elevation;
      const below = walled ? Math.max(0, mine - TIER_LIFT) : lift(x + side.dx, y + side.dy);
      return { side, other, below };
    });

    // A ramp is a few broad steps down to its low side (the front one first,
    // so a corner reads one way): two treads a tile, each a dark riser and a
    // lit nosing, stopped short of the tile's ends and nudged per tile so a
    // bench of ramps breaks into steps rather than ruling one long stripe.
    const stair = tile.ramp
      ? [2, 1, 0, 3]
          .map((i) => down[i])
          .find((d) => d && d.other && !d.other.blocked && d.below < mine)
      : undefined;
    if (stair) {
      const { side } = stair;
      const along = side.dx === 0;
      // Distance from the low edge, in the cell's own coordinate.
      const at = (u: number) => (side.dx + side.dy > 0 ? 1 - u : u);
      const hash = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 997;
      const jitter = (k: number) => (((hash * (k + 3)) % 97) / 97 - 0.5) * 0.16;
      for (const [i, k] of [0.34, 0.72].entries()) {
        const e0 = 0.07 + Math.abs(jitter(i + 1));
        const e1 = 0.93 - Math.abs(jitter(i + 5));
        const band = (u0: number, u1: number) => {
          const [p, q] = [at(u0), at(u1)].sort((m, n) => m - n) as [number, number];
          return along ? quad(e0, p, e1, q, mine) : quad(p, e0, q, e1, mine);
        };
        const u = k + jitter(i);
        ops.push({ kind: 'fill', poly: band(u - 0.13, u), color: ELEVATION.shadow, alpha: 0.2 });
        ops.push({ kind: 'fill', poly: band(u, u + 0.06), color: ELEVATION.rim, alpha: 0.32 });
      }
    }

    for (const { side, below } of down) {
      if (below >= mine) continue;
      const [ax, ay] = side.a;
      const [bx, by] = side.b;
      const lipA = point(x + ax, y + ay, mine);
      const lipB = point(x + bx, y + by, mine);
      if (side.dy === -1 || side.dx === -1) {
        // The back edges: ink on the break, a lit rim just inside it.
        ops.push({
          kind: 'line',
          a: lipA,
          b: lipB,
          color: ELEVATION.ink,
          alpha: contrast ? 0.9 : 0.6,
          width: ink,
        });
        const inset = 0.05;
        const ia = point(x + ax + (side.dx ? inset : 0), y + ay + (side.dy ? inset : 0), mine);
        const ib = point(x + bx + (side.dx ? inset : 0), y + by + (side.dy ? inset : 0), mine);
        ops.push({ kind: 'line', a: ia, b: ib, color: ELEVATION.rim, alpha: 0.55, width: ink });
        continue;
      }
      // The front faces, from the lower neighbour's own height up to the lip,
      // are the cell's own painted stone turned down: sampled from the strip
      // just inside this edge, so the foot shows the art at the edge and the
      // lip the art a face's height further in. Flat tone steps shade it:
      // east deeper than south, darker towards the foot, a lit course under
      // the lip, and one course for each step of a ramp.
      const footA = point(x + ax, y + ay, below);
      const footB = point(x + bx, y + by, below);
      const mix = (p: Pt, q: Pt, u: number): Pt => ({
        x: p.x + (q.x - p.x) * u,
        y: p.y + (q.y - p.y) * u,
      });
      const band = (u0: number, u1: number): Pt[] => [
        mix(footA, lipA, u0),
        mix(footB, lipB, u0),
        mix(footB, lipB, u1),
        mix(footA, lipA, u1),
      ];
      // Art that already paints a face as tall as this one (the Driller's
      // gantry joists) is lifted with its top, face and all, and left unshaded.
      const painted = art >= mine - below;
      ops.push({
        kind: 'face',
        poly: band(0, 1),
        shift: ((painted ? mine : below) - art) * tilePx,
      });
      const shade = side.dy === 1 ? ELEVATION.southShade : ELEVATION.eastShade;
      if (!painted) {
        ops.push({ kind: 'fill', poly: band(0, 1), color: ELEVATION.shadow, alpha: shade });
        ops.push({ kind: 'fill', poly: band(0, 0.4), color: ELEVATION.shadow, alpha: 0.16 });
      }
      const steps = painted ? 0 : tile.ramp ? 3 : 1;
      for (let i = 1; i <= steps; i++) {
        const u = i / steps;
        const lit = band(u - 0.14 / steps, u);
        ops.push({ kind: 'fill', poly: lit, color: ELEVATION.rim, alpha: 0.2 });
        if (i === steps) continue;
        const dark = band(u - 0.3 / steps, u - 0.14 / steps);
        ops.push({ kind: 'fill', poly: dark, color: ELEVATION.shadow, alpha: 0.14 });
      }
      ops.push({ kind: 'line', a: footA, b: footB, color: ELEVATION.ink, alpha: 0.7, width: ink });
      ops.push({
        kind: 'line',
        a: lipA,
        b: lipB,
        color: ELEVATION.ink,
        alpha: contrast ? 1 : 0.85,
        width: ink,
      });
    }
  }
  return ops;
}
