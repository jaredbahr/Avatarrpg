/**
 * The top-down board's combat overlays without a grid (ADR 0104 sections 2 and 6; #457), in the
 * prototype's look (`prototypes/topdown/src/b3/surfvis.js` `bakePreview`, `footsteps`, `ring`; its
 * draw order in `draw.js` `drawPreviews`), drawn from the game's own rules through the view model:
 *
 * - **Reach**: the move overlay's cells (the reducer's 8-way reachable set) as a warm tinted wash with
 *   a solid 1 px rim on its edge (#699); shown only while no ability is armed.
 * - **Targets**: units on a valid target tile get a small ring; a ground target with nobody on it
 *   gets the target wash, so a wall or a blast aimed at open ground still shows where it may land.
 *   Height reach (`rangeBonus`) washes its cells in the party's cream.
 * - **Area**: the armed ability's area as an ember wash; every figure in it gets a hit ring, cream
 *   for the party and red for the rest.
 * - **Path**: paired footprints along `view.path` and a ring at its end.
 * - **Cover**: a shield pip by the aimed target's ring when it is in cover (`hasCover` with the
 *   board's roster), struck through when the ability ignores cover (`requiresLineOfSight: false`).
 *
 * Everything lands in one RGBA layer the size of the board, at one texel a world px, which both
 * backends draw nearest under the figures and over the ground and its surfaces. Each wash's mask is
 * cached by its cell set and kind, so moving the pointer only re-lays the footprints and rings.
 */
import { SQUARE_FOOTPRINTS, footprintCells } from '../../core/rules/footprint';
import type { Grid, Vec2 } from '../../core/types';
import type { RgbaImage } from '../shadow/hardShadowMask';
import type { MapView } from '../view';
import { BoundedLru } from './lru';
import { CS, clipMask, groundOk, metaMask, reachOf, type Board } from './organic';

export type Rgb = readonly [number, number, number];

/** `draw.js`: the walk's warm wash, the blow's ember area, the rings' colours. */
export const REACH_RGB: Rgb = [242, 196, 120];
export const AREA_RGB: Rgb = [214, 92, 70];
export const TARGET_RGB: Rgb = [242, 140, 110];
export const PARTY_RGB: Rgb = [242, 212, 122];
export const ENEMY_RGB: Rgb = [242, 120, 96];
/** The shadow colour, for the footprints' print and the pips' outline. */
const INK: Rgb = [50, 33, 37];

/** `bakePreview`'s organic mask: seed 171, edge 0.5, the wide (blob) shape. */
export const WASH_SEED = 171;
export const WASH_EDGE = 0.5;

/** A wash of cells in one colour. */
export interface WashArea {
  readonly cells: readonly Vec2[];
  readonly color: Rgb;
}

/** A 1 px pixel ellipse on the ground, centred at world px (x, y). */
export interface Ring {
  readonly x: number;
  readonly y: number;
  readonly color: Rgb;
  readonly w: number;
  readonly h: number;
}

/** The cover cue by the aimed target's ring: in cover, or in cover the ability ignores. */
export interface CoverPip {
  readonly x: number;
  readonly y: number;
  readonly kind: 'covered' | 'ignored';
}

export interface WashSpec {
  readonly grid: Grid;
  /** Drawn in order; a later wash lies over an earlier one. */
  readonly washes: readonly WashArea[];
  /** The route to walk: from the walker's cell along `path`. */
  readonly steps: { readonly from: Vec2; readonly path: readonly Vec2[] } | null;
  readonly rings: readonly Ring[];
  readonly pips: readonly CoverPip[];
}

/** A cell's foot point in world px (`cellX`, `cellY` in `head.js`). */
export function cellFoot(pos: Vec2): Vec2 {
  return { x: pos.x * CS + CS / 2, y: pos.y * CS + CS - 9 };
}

const masks = new BoundedLru<string, Uint8Array>(8);
const grounds = new WeakMap<Grid, Uint8Array>();

/** The board's "may a patch lie here" mask, once per grid object. */
function groundFor(grid: Grid): Uint8Array {
  let g = grounds.get(grid);
  if (!g) {
    g = groundOk(grid);
    grounds.set(grid, g);
  }
  return g;
}

const cellKey = (cells: readonly Vec2[]): string =>
  cells
    .map((c) => `${c.x},${c.y}`)
    .sort()
    .join(';');

/**
 * The organic mask of `cells` on `grid` (`organicMask(..., 171, 0.5, 1, true)`), cached by the cell
 * set and the board's blocked cells.
 */
export function washMask(grid: Grid, cells: readonly Vec2[]): Uint8Array {
  const blockedKey = grid.tiles.map((t) => (t.blocked ? 1 : 0)).join('');
  const key = `${grid.width}x${grid.height}|${blockedKey}|${cellKey(cells)}`;
  const hit = masks.get(key);
  if (hit) return hit;
  const board: Board = { w: grid.width, h: grid.height };
  const on = new Set(cells.map((c) => c.y * grid.width + c.x));
  const isOn = (x: number, y: number): boolean => on.has(y * grid.width + x);
  const region = reachOf(board, cells);
  const BW = board.w * CS,
    BH = board.h * CS;
  const m = region
    ? clipMask(
        metaMask(board, isOn, WASH_SEED, WASH_EDGE, region),
        board,
        isOn,
        groundFor(grid),
        (x, y) => grid.tiles[y * grid.width + x]?.blocked ?? true,
        region,
      )
    : new Uint8Array(BW * BH);
  masks.set(key, m);
  return m;
}

/** How many wash masks are cached (bounded). */
export function cachedWashMasks(): number {
  return masks.size;
}

/** Test seam: forget every cached mask. */
export function resetWashCache(): void {
  masks.clear();
}

/** Source-over of a straight-alpha colour onto a straight-alpha layer pixel. */
function over(d: Uint8ClampedArray, i: number, c: Rgb, a: number): void {
  const sa = a / 255,
    da = (d[i + 3] ?? 0) / 255,
    oa = sa + da * (1 - sa);
  if (oa <= 0) return;
  for (let k = 0; k < 3; k++) d[i + k] = ((c[k] ?? 0) * sa + (d[i + k] ?? 0) * da * (1 - sa)) / oa;
  d[i + 3] = oa * 255;
}

/**
 * The wash (#699): a 1 px solid rim traced on the mask's edge over a brighter tinted fill, so the
 * reachable ground reads at a glance on every top-down ground.
 */
function layWash(d: Uint8ClampedArray, BW: number, BH: number, m: Uint8Array, c: Rgb): void {
  for (let y = 1; y < BH - 1; y++)
    for (let x = 1; x < BW - 1; x++) {
      const i = y * BW + x;
      if (m[i]) over(d, i * 4, c, m[i - 1] && m[i + 1] && m[i - BW] && m[i + BW] ? 96 : 255);
    }
}

function px(d: Uint8ClampedArray, BW: number, BH: number, x: number, y: number, c: Rgb, a = 255) {
  if (x < 0 || y < 0 || x >= BW || y >= BH) return;
  over(d, (y * BW + x) * 4, c, a);
}

/** `ring`: 64 points round an ellipse, one px each. */
function layRing(d: Uint8ClampedArray, BW: number, BH: number, r: Ring): void {
  for (let a = 0; a < 64; a++) {
    const t = (a / 64) * Math.PI * 2;
    px(
      d,
      BW,
      BH,
      Math.round(r.x + Math.cos(t) * r.w),
      Math.round(r.y + Math.sin(t) * r.h),
      r.color,
    );
  }
}

/**
 * `footsteps`: paired 2×2 prints about every 9 px, 2 px to alternate sides, each with a 1 px cream
 * cap, from the walker's feet along the path; then a ring at the end.
 */
function laySteps(
  d: Uint8ClampedArray,
  BW: number,
  BH: number,
  from: Vec2,
  path: readonly Vec2[],
): void {
  const start = cellFoot(from);
  let fx = start.x,
    fy = start.y - 2,
    k = 0;
  for (const cell of path) {
    const foot = cellFoot(cell),
      tx = foot.x,
      ty = foot.y - 2,
      n = Math.max(1, Math.round(Math.hypot(tx - fx, ty - fy) / 9));
    for (let i = 1; i <= n; i++) {
      const x = fx + ((tx - fx) * i) / n,
        y = fy + ((ty - fy) * i) / n,
        side = k++ % 2 ? 2 : -2,
        ox = ty - fy ? side : 0,
        oy = tx - fx ? side : 0;
      const X = Math.round(x + ox),
        Y = Math.round(y + oy);
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ] as const)
        px(d, BW, BH, X + dx, Y + dy, INK, 0.7 * 255);
      px(d, BW, BH, X, Y - 1, PARTY_RGB, 0.55 * 255);
      px(d, BW, BH, X + 1, Y - 1, PARTY_RGB, 0.55 * 255);
    }
    fx = tx;
    fy = ty;
  }
  if (path.length) layRing(d, BW, BH, { x: fx, y: fy + 2, color: PARTY_RGB, w: 10, h: 4 });
}

/** A 5×6 shield, by row: 1 the outline, 2 the fill. */
const SHIELD = ['11111', '12221', '12221', '12221', '01210', '00100'] as const;

/**
 * The cover pip: a small shield in the party's cream with a dark outline; struck through in the
 * enemy red, its fill dimmed, when the ability arcs over the cover.
 */
function layPip(d: Uint8ClampedArray, BW: number, BH: number, pip: CoverPip): void {
  const fill: Rgb = pip.kind === 'covered' ? PARTY_RGB : [150, 132, 118];
  SHIELD.forEach((row, y) =>
    [...row].forEach((v, x) => {
      if (v === '1') px(d, BW, BH, pip.x + x, pip.y + y, INK);
      if (v === '2') px(d, BW, BH, pip.x + x, pip.y + y, fill);
    }),
  );
  if (pip.kind === 'ignored')
    for (let k = 0; k < 7; k++) px(d, BW, BH, pip.x - 1 + k, pip.y + 6 - k, ENEMY_RGB);
}

/** The whole overlay layer for `spec`: board-sized RGBA, one texel a world px. */
export function washImage(spec: WashSpec): RgbaImage {
  const BW = spec.grid.width * CS,
    BH = spec.grid.height * CS,
    data = new Uint8ClampedArray(BW * BH * 4);
  for (const wash of spec.washes)
    if (wash.cells.length) layWash(data, BW, BH, washMask(spec.grid, wash.cells), wash.color);
  if (spec.steps) laySteps(data, BW, BH, spec.steps.from, spec.steps.path);
  for (const ring of spec.rings) layRing(data, BW, BH, ring);
  for (const pip of spec.pips) layPip(data, BW, BH, pip);
  return { width: BW, height: BH, data };
}

/* ------------------------------------------------------------------ */
/* From the view model                                                 */
/* ------------------------------------------------------------------ */

const posKey = (p: Vec2): string => `${p.x},${p.y}`;

/** A figure's foot in world px: the foot of the middle of its footprint's lowest row. */
function footOf(cells: readonly Vec2[]): Vec2 {
  const low = Math.max(...cells.map((c) => c.y));
  const row = cells.filter((c) => c.y === low);
  const x = row.reduce((sum, c) => sum + c.x, 0) / row.length;
  return { x: Math.round(x * CS + CS / 2), y: low * CS + CS - 9 };
}

/**
 * What the top-down overlay layer shows for `view` (see the module comment). `square` says whether a
 * 2-tile unit covers a 2×2 square (`SQUARE_FOOTPRINTS`) or the legacy 2×1.
 */
export function washSpec(view: MapView, square = SQUARE_FOOTPRINTS): WashSpec {
  const layer = (kind: string) => view.overlays.find((o) => o.kind === kind)?.tiles ?? [];
  const move = layer('move'),
    targets = layer('target'),
    area = layer('area'),
    bonus = layer('rangeBonus');
  const cells = (u: MapView['units'][number]) => footprintCells(u.pos, u.size, square);
  const living = view.units.filter((u) => !u.fallen);
  const washes: WashArea[] = [];
  const rings: Ring[] = [];
  if (area.length) {
    washes.push({ cells: area, color: AREA_RGB });
    const hit = new Set(area.map(posKey));
    for (const u of living)
      if (cells(u).some((c) => hit.has(posKey(c)))) {
        rings.push({
          ...footOf(cells(u)),
          color: u.faction === 'enemy' ? ENEMY_RGB : PARTY_RGB,
          w: 10,
          h: 4,
        });
      }
  } else if (targets.length) {
    const valid = new Set(targets.map(posKey));
    const standing = new Set<string>();
    for (const u of living)
      if (cells(u).some((c) => valid.has(posKey(c)))) {
        for (const c of cells(u)) standing.add(posKey(c));
        rings.push({ ...footOf(cells(u)), color: TARGET_RGB, w: 9, h: 3 });
      }
    const open = targets.filter((c) => !standing.has(posKey(c)));
    if (open.length) washes.push({ cells: open, color: TARGET_RGB });
    if (bonus.length) washes.push({ cells: bonus, color: PARTY_RGB });
  } else if (move.length) {
    washes.push({ cells: move, color: REACH_RGB });
  }
  // the cell under the pointer, as a small ring (the oblique board's hover cell)
  if (view.hoverTile) rings.push({ ...footOf([view.hoverTile]), color: PARTY_RGB, w: 9, h: 3 });
  const pips: CoverPip[] = [];
  const cue = view.targetReticle;
  if (cue?.cover) {
    const target = living.find((u) => cells(u).some((c) => c.x === cue.pos.x && c.y === cue.pos.y));
    const foot = footOf(target ? cells(target) : [cue.pos]);
    pips.push({ x: foot.x + 12, y: foot.y - 6, kind: cue.cover });
  }
  return {
    grid: view.grid,
    washes,
    steps: view.path.length && view.pathFrom ? { from: view.pathFrom, path: view.path } : null,
    rings,
    pips,
  };
}

const gridIds = new WeakMap<Grid, number>();
let nextGridId = 0;

/** A key that changes exactly when the layer for `spec` would: the grid object, then the marks. */
export function washKey(spec: WashSpec): string {
  let id = gridIds.get(spec.grid);
  if (id === undefined) {
    id = nextGridId++;
    gridIds.set(spec.grid, id);
  }
  return JSON.stringify([
    id,
    spec.washes.map((w) => [w.color, cellKey(w.cells)]),
    spec.steps && [spec.steps.from, spec.steps.path],
    spec.rings,
    spec.pips,
  ]);
}

/**
 * Whether a board draws its overlays as the organic layer: the top-down board, except under High
 * contrast, which keeps the crisp per-cell squares so the rules read without the picture.
 */
export function drawsWash(view: Pick<MapView, 'crispOverlays'>, projection: string): boolean {
  return projection === 'topdown' && !view.crispOverlays;
}

let last: { key: string; image: RgbaImage | null } | null = null;

/** The overlay layer for `view`, rebuilt only when what it shows changes; null when it is empty. */
export function washLayer(view: MapView, square = SQUARE_FOOTPRINTS): RgbaImage | null {
  const spec = washSpec(view, square);
  const empty = !spec.washes.length && !spec.steps && !spec.rings.length && !spec.pips.length;
  const key = empty ? '' : washKey(spec);
  if (last?.key === key) return last.image;
  last = { key, image: empty ? null : washImage(spec) };
  return last.image;
}
