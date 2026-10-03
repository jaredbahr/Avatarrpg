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
 * The live marks on the ground — surfaces, ranges, the path, hover, exits and
 * High-contrast rule markers — are a second, transparent picture. Both
 * backends lay it over the flat ground before the ops run, so tops and faces
 * cover the raised cells' flat copy, and each raised top then takes its own
 * marks back by the cell's whole lift: however much the art already paints,
 * a mark sits where a tap picks its tile.
 *
 * It is plain data in screen pixels so the two backends interpret one list.
 * Board correctness, so both draw every op. What they must not do is pay for
 * it every frame (an iPad holds 2732x2048 device pixels, 22 MiB a layer):
 *
 * - The ops, less the live marks, are drawn once into a *lift layer* no
 *   bigger than the raised blocks on screen (`LiftPlan.bounds`), and redrawn
 *   only when the camera, the viewport or the ground under them changes. The
 *   static marks (surfaces and seams over art, rule markers) are baked in at
 *   their full lift, drawn straight under each top's translated transform.
 * - Each frame the flat ground and its marks are drawn as they always were,
 *   and the layer goes over them in one bounded copy, covering the raised
 *   blocks' flat marks.
 * - The live marks (ranges, hover, path, aim, exits, ground fx) then go on
 *   the raised tops that have any near them (`markedCells`), in painter
 *   order: `marksSchedule` also re-covers a later, taller block from the
 *   layer where it stands in front of a top that took marks.
 *
 * `liftCost` counts what the pass does, for the render-cost probe.
 */

import type { Grid, Tile, Vec2 } from '../../core/types';
import { TILE, type Camera } from '../camera';
import { ELEVATION } from '../palettes';
import type { MapView } from '../view';
import { aimArcPoints } from './arc';
import { decorSignature } from './board';
import { TIER_LIFT, liftAt } from './elevation';

export interface Pt {
  readonly x: number;
  readonly y: number;
}

export type LiftOp =
  /**
   * Redraw inside `poly`, sampled `shift` pixels further down: a top or an
   * exposed face from the flat ground, an overlay from the live marks.
   */
  | {
      readonly kind: 'top' | 'face' | 'overlay';
      readonly poly: readonly Pt[];
      readonly shift: number;
    }
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

/** A screen rectangle in CSS pixels. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** One cell's share of the pass, in painter order. */
export interface LiftCell {
  readonly x: number;
  readonly y: number;
  /** Its lift in tiles; 0 for a flat cell shaded by a taller neighbour. */
  readonly lift: number;
  /** Everything drawn for it, overlay included. */
  readonly ops: readonly LiftOp[];
  /** The lifted top its marks go on, and how far they rise; null when flat. */
  readonly top: readonly Pt[] | null;
  readonly shift: number;
  /** What its top and faces cover, which a mark from behind must not show through. */
  readonly block: readonly (readonly Pt[])[];
  readonly blockBounds: Rect | null;
}

export interface LiftPlan {
  readonly key: string;
  /** The cells with ops that reach the viewport, in painter order. */
  readonly cells: readonly LiftCell[];
  /** What the lift layer must hold: every op, clipped to the viewport. */
  readonly bounds: Rect | null;
  /** Where the ground that the tops, faces and static marks copy from lies. */
  readonly sources: Rect | null;
}

/**
 * The render-cost probe (dev console and e2e: `window.fnt.liftCost`). Counts
 * only grow; a caller diffs two readings. `heldPx` is what the pass holds
 * right now in extra canvases or render targets, in device pixels.
 */
export const liftCost = {
  /** Frames drawn with raised ground on screen. */
  frames: 0,
  /** Times the lift layer was redrawn. */
  layerBuilds: 0,
  /** Renders into a WebGL target, and the device pixels they covered. */
  targetRenders: 0,
  targetPx: 0,
  /** Canvas 2D copies between canvases, and the device pixels they read. */
  copies: 0,
  copiedPx: 0,
  /** Raised tops that took live marks. */
  markedTops: 0,
  heldPx: 0,
};

const ids = new WeakMap<object, number>();
let nextId = 1;
/** A number per object, for cache keys that must change when the object does. */
export function identity(value: object | null | undefined): number {
  if (!value) return 0;
  let id = ids.get(value);
  if (id === undefined) ids.set(value, (id = nextId++));
  return id;
}

let plan: LiftPlan | undefined;

/**
 * The ops for this board through this camera, kept until either moves: the
 * backend asks every frame, and most frames nothing on the ground changes.
 * Cells whose ops miss the viewport are left out.
 */
export function liftPlan(
  grid: Grid,
  camera: Camera,
  artLift: number | readonly number[],
  contrast: boolean,
): LiftPlan {
  const { width, height, dpr } = camera.viewport;
  const key = [
    decorSignature(grid),
    camera.scale,
    camera.offsetX,
    camera.offsetY,
    width,
    height,
    dpr,
    artLift,
    contrast,
  ].join('|');
  if (plan?.key === key) return plan;
  const screen = { x: 0, y: 0, w: width, h: height };
  const cells: LiftCell[] = [];
  let bounds: Rect | null = null;
  let sources: Rect | null = null;
  const input = {
    grid,
    project: (pos: Vec2) => camera.project(pos),
    tilePx: TILE * camera.scale,
    artLift,
    contrast,
  };
  for (const { x, y, ops } of liftCells(input)) {
    const reach = clip(opsBounds(ops), screen);
    if (!reach) continue;
    bounds = union(bounds, reach);
    let top: readonly Pt[] | null = null;
    let shift = 0;
    const block: (readonly Pt[])[] = [];
    for (const op of ops) {
      if (!('shift' in op)) continue;
      sources = union(sources, clip(polyBounds(op.poly, op.shift), screen));
      if (op.kind === 'overlay') ({ poly: top, shift } = op);
      else block.push(op.poly);
    }
    cells.push({
      x,
      y,
      lift: liftAt(grid, { x, y }, 'oblique'),
      ops,
      top,
      shift,
      block,
      blockBounds: block.reduce<Rect | null>((r, poly) => union(r, polyBounds(poly, 0)), null),
    });
  }
  plan = { key, cells, bounds: snapOut(bounds, dpr), sources: snapOut(sources, dpr) };
  return plan;
}

export function union(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

export function clip(a: Rect | null, b: Rect): Rect | null {
  if (!a) return null;
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.w, b.x + b.w) - x;
  const h = Math.min(a.y + a.h, b.y + b.h) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}

/** Out to whole device pixels, so a layer's texels sit on the screen's. */
export function snapOut(rect: Rect | null, dpr: number): Rect | null {
  if (!rect) return null;
  const x = Math.floor(rect.x * dpr) / dpr;
  const y = Math.floor(rect.y * dpr) / dpr;
  return {
    x,
    y,
    w: Math.ceil((rect.x + rect.w) * dpr) / dpr - x,
    h: Math.ceil((rect.y + rect.h) * dpr) / dpr - y,
  };
}

/** A polygon's box, `down` pixels lower: where a copy with that shift reads. */
export function polyBounds(poly: readonly Pt[], down: number): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of poly) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  // A pixel of slack for the antialiased edge.
  return { x: x0 - 1, y: y0 + down - 1, w: x1 - x0 + 2, h: y1 - y0 + 2 };
}

function opsBounds(ops: readonly LiftOp[]): Rect | null {
  let out: Rect | null = null;
  for (const op of ops) {
    if (op.kind !== 'line') {
      out = union(out, polyBounds(op.poly, 0));
      continue;
    }
    const pad = op.width / 2;
    const r = polyBounds([op.a, op.b], 0);
    out = union(out, { x: r.x - pad, y: r.y - pad, w: r.w + 2 * pad, h: r.h + 2 * pad });
  }
  return out;
}

/** What the live marks read from the view: the marks that change between frames. */
export type LiveMarks = Pick<
  MapView,
  | 'overlays'
  | 'hoverTile'
  | 'path'
  | 'pathFrom'
  | 'aimArc'
  | 'exits'
  | 'exit'
  | 'emitters'
  | 'cliffEdges'
  | 'obscuringTiles'
>;

/**
 * The cells a live mark may reach, with a cell round each for strokes and for
 * the lifted top that overhangs the cell behind; null when there are none.
 * Over art on WebGL the surfaces are live too (they ripple), so `surfaces`
 * says how far each tile's surface reaches (0 for none drawn), and the grid
 * lines reach every tile.
 */
export function markedCells(
  grid: Grid,
  view: LiveMarks,
  extra: { surfaces?: (tile: Tile, pos: Vec2) => number; gridLines?: boolean } = {},
): Uint8Array | null {
  const { width, height } = grid;
  const out = new Uint8Array(width * height);
  if (extra.gridLines) return out.fill(1);
  let any = false;
  const mark = (fx: number, fy: number, reach = 1) => {
    const cx = Math.floor(fx);
    const cy = Math.floor(fy);
    for (let y = Math.max(0, cy - reach); y <= Math.min(height - 1, cy + reach); y++)
      for (let x = Math.max(0, cx - reach); x <= Math.min(width - 1, cx + reach); x++) {
        out[y * width + x] = 1;
        any = true;
      }
  };
  for (const layer of view.overlays) for (const p of layer.tiles) mark(p.x, p.y);
  for (const p of view.obscuringTiles ?? []) mark(p.x, p.y);
  // Cliff hatching is authored on the higher cell's lip; always schedule that
  // top for the lift pass even when no other live overlay crosses it.
  for (const edge of view.cliffEdges ?? []) mark(edge.pos.x, edge.pos.y);
  if (view.hoverTile) mark(view.hoverTile.x, view.hoverTile.y);
  for (const p of view.path) mark(p.x, p.y);
  if (view.path.length && view.pathFrom) mark(view.pathFrom.x, view.pathFrom.y);
  const arc = view.aimArc;
  if (arc) for (const p of aimArcPoints(arc.from, arc.to, arc.arc)) mark(p.x, p.y);
  for (const exit of view.exits ?? (view.exit ? [view.exit] : [])) mark(exit.pos.x, exit.pos.y);
  for (const { def, from, to } of view.emitters) {
    if (def.layer !== 'under') continue;
    // A spray reaches past the line it flies along.
    for (let y = Math.min(from.y, to.y); y <= Math.max(from.y, to.y) + 1; y++)
      for (let x = Math.min(from.x, to.x); x <= Math.max(from.x, to.x) + 1; x++) mark(x, y, 2);
  }
  const surfaces = extra.surfaces;
  if (surfaces)
    grid.tiles.forEach((tile, i) => {
      const pos = { x: i % width, y: Math.floor(i / width) };
      const reach = tile.surface ? surfaces(tile, pos) : 0;
      if (reach > 0) mark(pos.x, pos.y, reach);
    });
  return any ? out : null;
}

/**
 * Groups rectangles that touch or nearly do, so a target cropped to each
 * group holds what they cover and not the empty board between two far ones.
 * Returns each group's box and the indices of the rectangles in it.
 */
export function clusters(rects: readonly Rect[]): { rect: Rect; members: number[] }[] {
  const out = rects.map((rect, i) => ({ rect, members: [i] }));
  const area = (r: Rect) => r.w * r.h;
  for (let merged = true; merged;) {
    merged = false;
    for (let i = 0; i < out.length && !merged; i++)
      for (let j = i + 1; j < out.length && !merged; j++) {
        const [a, b] = [out[i], out[j]];
        const both = a && b && union(a.rect, b.rect);
        // Joined only when the box round both wastes little on the gap.
        if (!a || !b || !both || area(both) > 1.25 * (area(a.rect) + area(b.rect))) continue;
        out[i] = { rect: both, members: [...a.members, ...b.members] };
        out.splice(j, 1);
        merged = true;
      }
  }
  return out;
}

export interface MarkStep {
  readonly cell: LiftCell;
  /** Copy the layer back over its block first: a top behind it took marks. */
  readonly recover: boolean;
  /** Draw the live marks on its top. */
  readonly marks: boolean;
}

/**
 * The raised tops that take live marks, in painter order. A taller block just
 * in front, drawn later, may stand over such a top, so that block is flagged
 * to be copied back from the layer before its own marks go on.
 */
export function marksSchedule(plan: LiftPlan, grid: Grid, marked: Uint8Array | null): MarkStep[] {
  if (!marked) return [];
  const steps: MarkStep[] = [];
  const flagged = new Set<number>();
  for (const cell of plan.cells) {
    if (!cell.top) continue;
    const index = cell.y * grid.width + cell.x;
    const marks = marked[index] === 1;
    const recover = flagged.has(index);
    if (!marks && !recover) continue;
    steps.push({ cell, recover, marks });
    if (!marks) continue;
    // A lift of at most half a tile reaches back one cell, so whatever can
    // stand over this top is a step or two in front of it.
    for (let dy = 0; dy <= 2; dy++)
      for (let dx = 0; dx <= 2; dx++) {
        const x = cell.x + dx;
        const y = cell.y + dy;
        if ((dx || dy) && liftAt(grid, { x, y }, 'oblique') > cell.lift)
          flagged.add(y * grid.width + x);
      }
  }
  return steps;
}

export function liftOps(input: LiftInput): LiftOp[] {
  return liftCells(input).flatMap((cell) => cell.ops);
}

/** The ops cell by cell, in painter order; cells with none are left out. */
export function liftCells(input: LiftInput): { x: number; y: number; ops: LiftOp[] }[] {
  const { grid, project, tilePx, artLift, contrast } = input;
  // Art painted at the full lift draws its own blocks; it stays in charge.
  const full = typeof artLift === 'number' && artLift >= TIER_LIFT;
  const lift = (x: number, y: number) => liftAt(grid, { x, y }, 'oblique');
  const out: { x: number; y: number; ops: LiftOp[] }[] = [];
  const point = (gx: number, gy: number, up: number): Pt => {
    const p = project({ x: gx, y: gy });
    return { x: p.x, y: p.y - up * tilePx };
  };
  // A painted silhouette hairline, not the old two-pixel technical drawing.
  const ink = Math.max(0.75, tilePx * 0.012);

  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) cells.push({ x, y });
  cells.sort((p, q) => p.x + p.y - (q.x + q.y) || p.x - q.x);

  for (const { x, y } of cells) {
    const tile = at(grid, x, y);
    if (!tile || tile.blocked) continue;
    const ops: LiftOp[] = [];
    out.push({ x, y, ops });
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
    const top = quad(0, 0, 1, 1, mine);
    const marks: LiftOp = { kind: 'overlay', poly: top, shift: mine * tilePx };
    if (full) {
      // Only the marks move: the art is put back over the block's whole
      // outline, top and faces, as it was painted, then its marks go on top.
      // That outline is the top's back corners and the flat cell's front ones.
      if (mine > 0)
        ops.push(
          {
            kind: 'top',
            poly: [
              point(x, y, mine),
              point(x + 1, y, mine),
              point(x + 1, y, 0),
              point(x + 1, y + 1, 0),
              point(x, y + 1, 0),
              point(x, y + 1, mine),
            ],
            shift: 0,
          },
          marks,
        );
      continue;
    }
    if (mine > 0) {
      // Authored ground pages deliberately carry transparent cells. Give a
      // lifted slab an opaque stone body before sampling that painting, or
      // the lower dirt remains visible through the top and its risers.
      ops.push({ kind: 'fill', poly: top, color: ELEVATION.topBase, alpha: 1 });
      // The quarry pages bake a ledge's own faces and two-pixel ink round each
      // cell's edge. Sampled whole, that lands on the lifted top as a second,
      // translucent-looking ledge outline, so the painting is taken only
      // inside a margin and the procedural silhouette draws the edge.
      const [c0, c1, c2, c3] = top as [Pt, Pt, Pt, Pt];
      const mid = { x: (c0.x + c2.x) / 2, y: (c0.y + c2.y) / 2 };
      // A deck painted a whole tier up (the Driller's gantry) is an object with
      // its own outline, so it keeps its painting as drawn.
      const authored = art >= TIER_LIFT;
      const keep = authored ? 1 : 1 - ELEVATION.topMargin;
      const inner = [c0, c1, c2, c3].map((c) => ({
        x: mid.x + (c.x - mid.x) * keep,
        y: mid.y + (c.y - mid.y) * keep,
      }));
      ops.push({ kind: 'top', poly: inner, shift: (mine - art) * tilePx });
      // What the margin cannot reach (ink between paving regions, stepped courses
      // painted for a flatter board) is knocked back toward the stone body, so
      // the painting texture stone rather than outline it.
      if (!authored)
        ops.push({ kind: 'fill', poly: inner, color: ELEVATION.topBase, alpha: ELEVATION.topWash });
      ops.push({
        kind: 'fill',
        poly: top,
        color: ELEVATION.tint,
        alpha: ELEVATION.tintPerTier * tile.elevation * (contrast ? 2 : 1),
      });
    }

    // A higher block shades this cell's top through the shared cast shadow
    // (lighting.ts structureShadowPolygons), not a second band drawn here: two
    // darkenings of one shadow, and three stacked steps that read as stripes.
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

    // A ramp tilts toward its low side (the front one first, so a corner reads
    // one way): it takes a graded darkening toward that edge, in steps too small
    // to see. Ruled treads were tried; across a bench of ramps they ran as one
    // long stripe the length of the wall, the fault the owner flagged.
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
      const slope = ELEVATION.rampSlope;
      for (let i = 1; i <= slope.steps; i++) {
        const [p, q] = [at(0), at((i / slope.steps) * slope.reach)].sort((m, n) => m - n) as [
          number,
          number,
        ];
        ops.push({
          kind: 'fill',
          poly: along ? quad(0, p, 1, q, mine) : quad(p, 0, q, 1, mine),
          color: ELEVATION.shadow,
          alpha: slope.alpha,
        });
      }
    }
    ops.push(marks);

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
        const inset = 0.04;
        const ia = point(x + ax - side.dx * inset, y + ay - side.dy * inset, mine);
        const ib = point(x + bx - side.dx * inset, y + by - side.dy * inset, mine);
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
        kind: 'fill',
        poly: band(0, 1),
        // A painted face is a gantry's open undercroft, not stone: dark, but solid.
        color: painted
          ? ELEVATION.undercroft
          : side.dy === 1
            ? ELEVATION.southBase
            : ELEVATION.eastBase,
        alpha: 1,
      });
      if (painted)
        ops.push({
          kind: 'face',
          poly: band(0, 1),
          shift: (mine - art) * tilePx,
        });
      if (!painted) {
        // The base already is the key-lit face tone. A tight foot glaze gives
        // it weight without projecting the top texture down at another scale.
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
      // Base occlusion: a dark band on the lower ground where the face lands,
      // tight and then soft, so the block is seated rather than laid on it.
      for (const [reach, alpha] of ELEVATION.footBands) {
        const drop = reach * tilePx;
        ops.push({
          kind: 'fill',
          poly: [
            footA,
            footB,
            { x: footB.x, y: footB.y + drop },
            { x: footA.x, y: footA.y + drop },
          ],
          color: ELEVATION.shadow,
          alpha,
        });
      }
      // The face foot is seated by occlusion, not another ruled edge. Ink is
      // reserved for the block silhouette at the top lip.
      ops.push({
        kind: 'line',
        a: lipA,
        b: lipB,
        color: ELEVATION.ink,
        alpha: contrast ? 1 : 0.85,
        width: ink,
      });
      const lipInset = 0.035;
      const rimA = point(x + ax - side.dx * lipInset, y + ay - side.dy * lipInset, mine);
      const rimB = point(x + bx - side.dx * lipInset, y + by - side.dy * lipInset, mine);
      ops.push({ kind: 'line', a: rimA, b: rimB, color: ELEVATION.rim, alpha: 0.6, width: ink });
    }
  }
  return out.filter((cell) => cell.ops.length > 0);
}
