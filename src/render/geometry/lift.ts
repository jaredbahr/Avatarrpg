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
  /** How far loaded ground art already lifts a tier, in tiles (`MapScene.reliefLift`). */
  readonly artLift: number;
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
  if (artLift >= TIER_LIFT) return [];
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

    if (mine > 0) {
      const top = quad(0, 0, 1, 1, mine);
      ops.push({ kind: 'top', poly: top, shift: (mine - artLift * tile.elevation) * tilePx });
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

    const down = SIDES.map((side) => {
      const other = at(grid, x + side.dx, y + side.dy);
      return { side, other, below: lift(x + side.dx, y + side.dy) };
    });

    // A ramp is stairs: four treads across it, parallel to the side it steps
    // down to (the front one first, so a corner reads one way, not as a grate),
    // each with its riser's shadow on the low side and a lit nosing above.
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
      const band = (u0: number, u1: number) => {
        const [p, q] = [at(u0), at(u1)].sort((m, n) => m - n) as [number, number];
        return along ? quad(0, p, 1, q, mine) : quad(p, 0, q, 1, mine);
      };
      for (const k of [0.25, 0.5, 0.75]) {
        ops.push({ kind: 'fill', poly: band(k - 0.08, k), color: ELEVATION.shadow, alpha: 0.16 });
        const t = at(k);
        const a = along ? point(x, y + t, mine) : point(x + t, y, mine);
        const b = along ? point(x + 1, y + t, mine) : point(x + t, y + 1, mine);
        ops.push({ kind: 'line', a, b, color: ELEVATION.rim, alpha: 0.6, width: ink });
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
      // The front faces, from the lower neighbour's own height up to the lip.
      const footA = point(x + ax, y + ay, below);
      const footB = point(x + bx, y + by, below);
      const face = side.dy === 1 ? ELEVATION.southFace : ELEVATION.eastFace;
      ops.push({ kind: 'fill', poly: [footA, footB, lipB, lipA], color: face, alpha: 1 });
      const rises = tile.ramp ? 3 : 2;
      for (let i = 1; i < rises; i++) {
        const u = i / rises;
        const mix = (p: Pt, q: Pt): Pt => ({ x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u });
        ops.push({
          kind: 'line',
          a: mix(footA, lipA),
          b: mix(footB, lipB),
          color: ELEVATION.ink,
          alpha: tile.ramp ? 0.45 : 0.22,
          width: Math.max(1, ink * 0.7),
        });
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
