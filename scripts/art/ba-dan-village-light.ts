/**
 * Shared world-space light and shadow for every Ba Dan ground plate.
 *
 * The village ground is lit once, as a pure function of the world pixel, so
 * every plate that overlaps another agrees exactly (the same contract as
 * `ba-dan-village-material.ts`, whose colour this is applied after).
 *
 * Geometry is read from the live scene, never copied: every house, stall,
 * planter, the bridge and the surround walls become simple volumes (axis
 * aligned in the logical ground, with a height range in screen pixels), and
 * every tree contributes its own painted silhouette. Shadows follow the game's
 * one key (`CAST_PER_PIXEL`): a point `h` screen pixels above the ground lands
 * `0.42h` right and `0.27h` down, the same shear the unit shadows use. A ground
 * pixel is shadowed when walking back toward the light by that shear meets a
 * volume, so a roof casts the shape of a roof, a stall a short table, a tree a
 * broken canopy.
 *
 * - Penumbra: each height slice is softened by `PENUMBRA_BASE + PENUMBRA_PER_PX*h`
 *   (ground pixels), so a shadow is crisp at the caster's base and soft at the
 *   far tip.
 * - Dapple: tree shade is the canopy silhouette with light holes at leaf-cluster
 *   scale, denser near the trunk.
 * - Occlusion: a tight soft darkening at every footprint, stronger where a
 *   shadow side meets the ground.
 * - Open ground: a gentle warm lift with slow drift; shade is cooler and darker.
 *
 * The runtime still draws its own contact shadow under scenery
 * (`src/render/grounding.ts`). `contactAlpha` reproduces it so `litRgb` never
 * stacks the two: inside its reach the baked colour is brought back toward
 * lit, and `ba-dan-ground-composite.ts` lays the runtime ink over the plates to
 * preview the sum.
 */
import { BA_DAN_VILLAGE } from '../../src/content/maps/village';
import { BA_DAN_DRESSING, BA_DAN_SCENE } from '../../src/content/scenes/baDan';
import type { SceneScenery, TerrainId } from '../../src/core/types';
import { CAST_PER_PIXEL, SHADOW_RGB } from '../../src/render/lighting';
import { SURFACE_STYLES, TERRAIN_STYLES } from '../../src/render/palettes';
import { tileNoise } from '../../src/render/painters/shapes';
import { readImage } from './lib/image';
import { treeSpecs } from './ba-dan-trees';
import { box, dressingVolumes, wallVolumes } from './ba-dan-volumes';
import type { Rect, Volume } from './ba-dan-volumes';

type Rgb = readonly [number, number, number];

/** World pixels per ground-plane tile unit once the 2:1 squash is undone. */
const GROUND_PX_PER_TILE = 90.5;
const ORIGIN = 1024;

export function worldToLogical(wx: number, wy: number): { x: number; y: number } {
  const dx = (wx - ORIGIN) / 64;
  const dy = wy / 32;
  return { x: (dx + dy) / 2, y: (dy - dx) / 2 };
}
export function logicalToWorld(x: number, y: number): { x: number; y: number } {
  return { x: ORIGIN + (x - y) * 64, y: (x + y) * 32 };
}

/**
 * Penumbra half-width in ground pixels: crisp at the base, wide at the tip. The
 * growth is small on purpose: at 0.1 a roof's far edge was 16 ground pixels
 * soft, which washed the roof's outline out of the shadow.
 */
export const PENUMBRA_BASE = 0.8;
export const PENUMBRA_PER_PX = 0.04;
export const penumbra = (h: number): number => PENUMBRA_BASE + PENUMBRA_PER_PX * h;
/** Stalls, planters and the bridge are low: their edge stays harder than a house's. */
const SMALL_KINDS: ReadonlySet<Volume['kind']> = new Set(['stall', 'planter', 'bridge', 'prop']);
const SMALL_EDGE = 0.6;
/** Ground pixels shadowed at full strength darken to this multiple of the lit ground. */
export const SHADOW_MULTIPLY: Rgb = [0.59, 0.6, 0.67];
/** The lit open ground's warm lift. */
export const SUN_TINT: Rgb = [1.045, 1.02, 0.965];

export { box };
export type { Rect, Volume };

/**
 * The v3 true-geometry pieces (`scripts/art/ba-dan-guides/pieces.py`) are drawn at 1.5 image
 * pixels per world pixel and shown at 2/3, so every height below is the guide's own
 * in world pixels. Piece-local footprint coordinates are added to the footprint's origin
 * tile. The body is 1.7 tiles deep at the +x side of the footprint (with the porch
 * ledge behind its east wall); the rest of the footprint westward is a low terrace.
 */
const PLINTH_H = 26;
const TERRACE_H = 8;
/** Eave line at the wall top; the roof tip kicks 8 below it over the +x overhang. */
const WALL_TOP = 140;
const EAVE_DROP = 8;
const RIDGE_RISE = 46;
/** Ridge beam, a narrow square above the ridge line. */
const RIDGE_BEAM = 5;
const BODY_DEPTH = 1.7;
const OVERHANG_E = 0.15;
const OVERHANG_W = 0.15;
const OVERHANG_Y = 0.2;
/** Plinth ledge west, north and south of the walls; the door side's is the porch. */
const LEDGE = 0.25;
const PORCH = 0.45;

/** Bounding tiles of a piece's footprint. */
function footprintBox(piece: SceneScenery): Rect {
  const xs = piece.footprint.map((c) => c.x);
  const ys = piece.footprint.map((c) => c.y);
  return {
    x0: Math.min(...xs),
    x1: Math.max(...xs) + 1,
    y0: Math.min(...ys),
    y1: Math.max(...ys) + 1,
  };
}

/**
 * A house as built: the plinth over its whole footprint, the plaster box on it up to
 * the eave line, then a gabled roof with its ridge along y, a flat kick over the
 * overhang and the slopes closing to the ridge beam.
 */
function houseVolumes(piece: SceneScenery): Volume[] {
  const f = footprintBox(piece);
  const wx1 = f.x1 - PORCH;
  const wx0 = wx1 - BODY_DEPTH;
  const wy0 = f.y0 + LEDGE;
  const wy1 = f.y1 - LEDGE;
  const xm = (wx0 + wx1) / 2;
  const half = BODY_DEPTH / 2;
  const eave: Rect = {
    x0: wx0 - OVERHANG_W,
    x1: wx1 + OVERHANG_E,
    y0: wy0 - OVERHANG_Y,
    y1: wy1 + OVERHANG_Y,
  };
  const tip = WALL_TOP - EAVE_DROP;
  const ridge = WALL_TOP + RIDGE_RISE;
  const roof: Volume = {
    id: `${piece.id}-roof`,
    kind: 'roof',
    hMin: tip,
    hMax: ridge + RIDGE_BEAM,
    section: (h) => {
      if (h < tip || h > ridge + RIDGE_BEAM) return null;
      // Under the eave line the slab is the whole overhang.
      if (h < WALL_TOP) return eave;
      if (h > ridge) return { ...eave, x0: xm - 0.08, x1: xm + 0.08 };
      const w = (half * (ridge - h)) / RIDGE_RISE;
      return { ...eave, x0: xm - w, x1: xm + w };
    },
  };
  return [
    // The plinth and the walls stand on the body only; the terrace behind is a low slab.
    box(
      `${piece.id}-terrace`,
      'house',
      { x0: f.x0, x1: wx0 - LEDGE, y0: f.y0, y1: f.y1 },
      0,
      TERRACE_H,
    ),
    box(`${piece.id}-plinth`, 'house', { ...f, x0: wx0 - LEDGE }, 0, PLINTH_H),
    box(`${piece.id}-wall`, 'house', { x0: wx0, x1: wx1, y0: wy0, y1: wy1 }, PLINTH_H, tip),
    roof,
  ];
}

/** The 2x1 table: legs, drawer shelf, 6 px top at 36 and trays 9 px above it. */
function stallVolumes(piece: SceneScenery): Volume[] {
  const { x0: x, y0: y } = footprintBox(piece);
  const top: Rect = { x0: x + 0.06, x1: x + 1.94, y0: y + 0.08, y1: y + 0.92 };
  const shelf: Rect = { x0: x + 0.23, x1: x + 1.77, y0: y + 0.18, y1: y + 0.82 };
  const trays: Rect = { x0: x + 0.12, x1: x + 1.88, y0: y + 0.18, y1: y + 0.82 };
  const leg = (cx: number, cy: number): Rect => ({
    x0: x + cx,
    x1: x + cx + 0.09,
    y0: y + cy,
    y1: y + cy + 0.09,
  });
  return [
    box(`${piece.id}-top`, 'stall', top, 30, 36),
    box(`${piece.id}-trays`, 'stall', trays, 36, 45),
    box(`${piece.id}-shelf`, 'stall', shelf, 8, 20),
    box(`${piece.id}-leg-a`, 'stall', leg(0.11, 0.13), 0, 30),
    box(`${piece.id}-leg-b`, 'stall', leg(1.8, 0.13), 0, 30),
    box(`${piece.id}-leg-c`, 'stall', leg(0.11, 0.78), 0, 30),
    box(`${piece.id}-leg-d`, 'stall', leg(1.8, 0.78), 0, 30),
  ];
}

/** Stone rim to 26 and a mound of planting to 42, on the footprint as it is (2x1 or 1x2). */
function planterVolumes(piece: SceneScenery): Volume[] {
  const f = footprintBox(piece);
  const rim: Rect = { x0: f.x0 + 0.03, x1: f.x1 - 0.03, y0: f.y0 + 0.03, y1: f.y1 - 0.03 };
  const mound: Rect = { x0: f.x0 + 0.3, x1: f.x1 - 0.3, y0: f.y0 + 0.3, y1: f.y1 - 0.3 };
  return [
    box(`${piece.id}-rim`, 'planter', rim, 0, 26),
    box(`${piece.id}-bed`, 'planter', mound, 26, 42),
  ];
}

function bridgeVolumes(): Volume[] {
  // The v3 bridge (`pieces.py`): 1x3 at (9,5). Two abutment stones per bank to 9, a deck
  // 8..15 over x 0.14..0.86 between y 0.92 and 2.08 of the piece, side beams to 21 and
  // four posts to 35 (cap to 39) at the deck corners.
  const X = 9;
  const Y = 5;
  const post = (x0: number, y0: number): Rect => ({
    x0: X + x0,
    x1: X + x0 + 0.1,
    y0: Y + y0,
    y1: Y + y0 + 0.1,
  });
  return [
    ...[0.52, 2.06].flatMap((ya, i) =>
      [0.08, 0.52].map((xa, j) =>
        box(
          `bridge-abutment-${i}${j}`,
          'bridge',
          { x0: X + xa, x1: X + xa + 0.4, y0: Y + ya, y1: Y + ya + 0.42 },
          0,
          9,
        ),
      ),
    ),
    box('bridge-deck', 'bridge', { x0: X + 0.14, x1: X + 0.86, y0: Y + 0.92, y1: Y + 2.08 }, 8, 15),
    box(
      'bridge-beam-w',
      'bridge',
      { x0: X + 0.04, x1: X + 0.14, y0: Y + 0.92, y1: Y + 2.08 },
      7,
      21,
    ),
    box(
      'bridge-beam-e',
      'bridge',
      { x0: X + 0.86, x1: X + 0.96, y0: Y + 0.92, y1: Y + 2.08 },
      7,
      21,
    ),
    ...[0.04, 0.86].flatMap((x, i) => [
      box(`bridge-post-n${i}`, 'bridge', post(x, 0.92), 7, 39),
      box(`bridge-post-s${i}`, 'bridge', post(x, 1.98), 7, 39),
    ]),
  ];
}

export interface TreeCaster {
  readonly piece: SceneScenery;
  readonly footX: number;
  readonly footY: number;
  readonly alpha: Uint8Array;
  readonly levels: readonly Float32Array[];
  readonly width: number;
  readonly height: number;
  readonly rise: number;
}

const BLUR_RADII = [0, 1.5, 3, 5, 8, 12] as const;

function blurAlpha(alpha: Uint8Array, w: number, h: number, radius: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = (alpha[i] ?? 0) / 255;
  if (radius <= 0) return out;
  const r = Math.max(1, Math.round(radius));
  const tmp = new Float32Array(w * h);
  for (const pass of [0, 1]) {
    const src = pass === 0 ? out : tmp;
    const dst = pass === 0 ? tmp : out;
    const len = pass === 0 ? w : h;
    const lines = pass === 0 ? h : w;
    const stride = pass === 0 ? 1 : w;
    const lineStride = pass === 0 ? w : 1;
    for (let line = 0; line < lines; line++) {
      let sum = 0;
      const base = line * lineStride;
      for (let k = -r; k <= r; k++)
        sum += src[base + Math.max(0, Math.min(len - 1, k)) * stride] ?? 0;
      for (let k = 0; k < len; k++) {
        dst[base + k * stride] = sum / (2 * r + 1);
        sum -= src[base + Math.max(0, k - r) * stride] ?? 0;
        sum += src[base + Math.min(len - 1, k + r + 1) * stride] ?? 0;
      }
    }
  }
  return out;
}

/**
 * One caster per tree, from the trees themselves (`ba-dan-trees.ts`) and not from the scene:
 * the scene draws some of them as one clump sprite, but each tree still casts its own
 * silhouette from its own root, exactly as it did when it was a piece of its own.
 */
async function loadTreeCasters(): Promise<TreeCaster[]> {
  const casters: TreeCaster[] = [];
  const grids = new Map<string, { alpha: Uint8Array; levels: Float32Array[] }>();
  for (const spec of treeSpecs()) {
    const { width, height } = spec;
    const key = `${spec.master}|${spec.flip ? 1 : 0}`;
    let grid = grids.get(key);
    if (!grid) {
      const source = readImage(`art/source/ba-dan-restyle/fine/${spec.master}-village-tree.png`);
      const alpha = new Uint8Array(width * height);
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const u = (x + 0.5) / width;
          const sx = Math.min(source.width - 1, Math.floor((spec.flip ? 1 - u : u) * source.width));
          const sy = Math.min(source.height - 1, Math.floor(((y + 0.5) / height) * source.height));
          alpha[y * width + x] = source.data[(sy * source.width + sx) * 4 + 3] ?? 0;
        }
      grid = { alpha, levels: BLUR_RADII.map((r) => blurAlpha(alpha, width, height, r)) };
      grids.set(key, grid);
    }
    const { alpha, levels } = grid;
    const piece: SceneScenery = {
      id: spec.id,
      url: `${spec.master}-village-tree`,
      x: spec.x,
      y: spec.y,
      width,
      height,
      footprint: [spec.cell],
      depth: spec.depth,
      ...(spec.flip ? { flip: true } : {}),
    };
    // Where the tree is DRAWN: a crown moved off its cells casts from the drawn root.
    const tile = spec.depth;
    const footY = (tile.x + tile.y + 1) * 32;
    casters.push({
      piece,
      footX: ORIGIN + (tile.x - tile.y) * 64,
      footY,
      alpha,
      levels,
      width,
      height,
      rise: footY - piece.y,
    });
  }
  return casters;
}

const SCENERY = BA_DAN_SCENE.scenery;
export const VILLAGE_VOLUMES: readonly Volume[] = [
  ...SCENERY.filter((p) => p.id.endsWith('-house')).flatMap(houseVolumes),
  ...SCENERY.filter((p) => /true-merchant-display(-[bc])?\.webp$/.test(p.url)).flatMap(
    stallVolumes,
  ),
  ...SCENERY.filter(
    (p) => /true-low-planter(-1x2)?\.webp$/.test(p.url) || p.id.startsWith('north-terrace-'),
  ).flatMap(planterVolumes),
  ...bridgeVolumes(),
  ...BA_DAN_DRESSING.flatMap(([image, x, y], i) => dressingVolumes(`d${i}`, image, x, y)),
  ...wallVolumes(),
];
/** One caster per tree piece, rooted where the tree is drawn. */
export const TREES = await loadTreeCasters();

// ---------------------------------------------------------------------------
// Spatial index: a coarse grid of world-pixel cells listing what can shade them.
// ---------------------------------------------------------------------------

const CELL = 64;
const INDEX = new Map<number, number[]>();
const cellKey = (cx: number, cy: number): number => (cy + 200) * 1000 + (cx + 200);

interface Shape {
  readonly volume?: Volume;
  readonly tree?: TreeCaster;
}
const SHAPES: Shape[] = [];

function register(shape: Shape, x0: number, y0: number, x1: number, y1: number): void {
  const id = SHAPES.length;
  SHAPES.push(shape);
  for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++)
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
      const key = cellKey(cx, cy);
      const list = INDEX.get(key);
      if (list) list.push(id);
      else INDEX.set(key, [id]);
    }
}

for (const volume of VILLAGE_VOLUMES) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (
    let h = volume.hMin;
    h <= volume.hMax + 0.001;
    h += Math.max(2, (volume.hMax - volume.hMin) / 24)
  ) {
    const s = volume.section(Math.min(h, volume.hMax));
    if (!s) continue;
    for (const [lx, ly] of [
      [s.x0, s.y0],
      [s.x1, s.y0],
      [s.x0, s.y1],
      [s.x1, s.y1],
    ] as const) {
      const w = logicalToWorld(lx, ly);
      x0 = Math.min(x0, w.x + h * CAST_PER_PIXEL.x);
      x1 = Math.max(x1, w.x + h * CAST_PER_PIXEL.x);
      y0 = Math.min(y0, w.y + h * CAST_PER_PIXEL.y);
      y1 = Math.max(y1, w.y + h * CAST_PER_PIXEL.y);
    }
  }
  const pad = 4 + PENUMBRA_BASE + PENUMBRA_PER_PX * volume.hMax * 1.5;
  register({ volume }, x0 - pad, y0 - pad, x1 + pad, y1 + pad);
}
for (const tree of TREES) {
  const pad = 24;
  register(
    { tree },
    tree.piece.x - pad,
    tree.footY - pad,
    tree.piece.x + tree.piece.width + tree.rise * CAST_PER_PIXEL.x + pad,
    tree.footY + tree.rise * CAST_PER_PIXEL.y + pad,
  );
}

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------

function hash2(x: number, y: number, salt: number): number {
  let h =
    Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise2(x: number, y: number, salt: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = hash2(x0, y0, salt) * (1 - sx) + hash2(x0 + 1, y0, salt) * sx;
  const bottom = hash2(x0, y0 + 1, salt) * (1 - sx) + hash2(x0 + 1, y0 + 1, salt) * sx;
  return top * (1 - sy) + bottom * sy;
}
const smooth = (a: number, b: number, v: number): number => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------
// Cast shadow
// ---------------------------------------------------------------------------

function rectSd(r: Rect, x: number, y: number): number {
  const cx = (r.x0 + r.x1) / 2;
  const cy = (r.y0 + r.y1) / 2;
  const qx = Math.abs(x - cx) - (r.x1 - r.x0) / 2;
  const qy = Math.abs(y - cy) - (r.y1 - r.y0) / 2;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
}

const H_STEP = 3;

/** `volume.section(h)` is a pure function of `h`, and the sampler asks the same few heights per pixel. */
const SECTIONS = new WeakMap<Volume, Map<number, Rect | null>>();
function sectionAt(volume: Volume, h: number): Rect | null {
  let byHeight = SECTIONS.get(volume);
  if (!byHeight) SECTIONS.set(volume, (byHeight = new Map()));
  let s = byHeight.get(h);
  if (s === undefined) byHeight.set(h, (s = volume.section(h)));
  return s;
}

/**
 * Cover of one volume alone at a world pixel; `shadowCover` is the max over everything.
 * `z0` lifts the receiving plane: the point is on the horizontal plane `z0` screen pixels
 * above the ground pixel (wx, wy), and only slices above it can shade it.
 */
export function volumeShadow(volume: Volume, wx: number, wy: number, z0 = 0): number {
  let best = 0;
  const top = Math.ceil(volume.hMax / H_STEP) * H_STEP;
  for (let h = 0; h <= top; h += H_STEP) {
    const hh = Math.min(h, volume.hMax);
    if (hh < volume.hMin - 0.001 || hh <= z0 + 0.5) continue;
    const s = sectionAt(volume, hh);
    if (!s) continue;
    const rise = hh - z0;
    const g = worldToLogical(wx - rise * CAST_PER_PIXEL.x, wy - rise * CAST_PER_PIXEL.y);
    const sigma = penumbra(rise) * (SMALL_KINDS.has(volume.kind) ? SMALL_EDGE : 1);
    // Outside the rectangle the distance is at least its larger axis gap, so most
    // slices are rejected before the hypot.
    const qx = Math.abs(g.x - (s.x0 + s.x1) / 2) - (s.x1 - s.x0) / 2;
    const qy = Math.abs(g.y - (s.y0 + s.y1) / 2) - (s.y1 - s.y0) / 2;
    if (Math.max(qx, qy) * GROUND_PX_PER_TILE > sigma) continue;
    const sd = rectSd(s, g.x, g.y) * GROUND_PX_PER_TILE;
    if (sd > sigma) continue;
    // Taller slices are a little lighter: sky fills in under a high caster.
    const cover =
      smooth(sigma, -sigma, sd) * (1 - 0.07 * Math.min(1, hh / 170)) * (volume.density ?? 1);
    if (cover > best) best = cover;
  }
  // A surround wall's shadow on the lawn runs out over the first third of a tile instead of
  // ending on a line (the board's edge), which read as a dark tile-shaped slab beside the wall.
  if (volume.kind === 'wall' && best > 0) {
    const foot = sectionAt(volume, 1);
    const g = worldToLogical(wx, wy);
    if (foot) best *= 1 - smooth(0, 34, rectSd(foot, g.x, g.y) * GROUND_PX_PER_TILE);
  }
  return best;
}

/**
 * Shadow of some volumes on the horizontal plane `z0` above a ground pixel: how the packer
 * carries a house's roof shadow across the plinth top and the steps of the painted piece, so
 * it agrees with the ground shadow just beyond the plinth's edge.
 */
export function shadowOnPlane(
  volumes: readonly Volume[],
  wx: number,
  wy: number,
  z0: number,
): number {
  let best = 0;
  for (const v of volumes) best = Math.max(best, volumeShadow(v, wx, wy, z0));
  return best;
}

function treeShadow(tree: TreeCaster, wx: number, wy: number): number {
  const rise = (wy - tree.footY) / CAST_PER_PIXEL.y;
  if (rise < -2 || rise > tree.rise) return 0;
  const r = Math.max(0, rise);
  const sx = wx - r * CAST_PER_PIXEL.x - tree.piece.x;
  const sy = tree.footY - r - tree.piece.y;
  if (sx < 0 || sx >= tree.width || sy < 0 || sy >= tree.height) return 0;
  const radius = 0.5 + 0.04 * r;
  let level = 0;
  while (level < BLUR_RADII.length - 2 && (BLUR_RADII[level + 1] ?? 99) < radius) level++;
  const lo = BLUR_RADII[level] ?? 0;
  const hi = BLUR_RADII[level + 1] ?? lo + 1;
  const k = Math.max(0, Math.min(1, (radius - lo) / (hi - lo)));
  const i = Math.floor(sy) * tree.width + Math.floor(sx);
  const a = (tree.levels[level]?.[i] ?? 0) * (1 - k) + (tree.levels[level + 1]?.[i] ?? 0) * k;
  if (a <= 0.01) return 0;
  // Dapple: light holes at leaf-cluster scale, more of them the farther the
  // leaves hang from the trunk, none right at the trunk's foot.
  const gy = wy * 2;
  const n =
    noise2(wx / 7, gy / 7, 301) * 0.5 +
    noise2(wx / 3.1, gy / 3.1, 303) * 0.3 +
    noise2(wx / 1.7, gy / 1.7, 305) * 0.2;
  const dense = 1 - smooth(10, 120, r);
  const holes = smooth(0.4 + 0.2 * dense, 0.68 + 0.22 * dense, n + 0.1 * (1 - dense) - 0.1 * dense);
  // A sapling's crown is already sparse: fewer holes, or its shade all but vanishes.
  const dapple = 1 - holes * ((tree.width <= 150 ? 0.55 : 0.92) - 0.5 * dense);
  // Leaf shade is not solid: lighter than a wall's shadow, darkest at the trunk.
  return Math.min(1, a * 1.15) * dapple * (0.8 + 0.12 * dense);
}

/** Cast-shadow coverage 0..1 at a world pixel centre. */
export function shadowCover(wx: number, wy: number): number {
  const list = INDEX.get(cellKey(Math.floor(wx / CELL), Math.floor(wy / CELL)));
  if (!list) return 0;
  let best = 0;
  for (const id of list) {
    const shape = SHAPES[id];
    if (!shape) continue;
    const c = shape.volume ? volumeShadow(shape.volume, wx, wy) : treeShadow(shape.tree!, wx, wy);
    if (c > best) {
      best = c;
      if (best > 0.99) break;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Occlusion and the runtime's contact shadow
// ---------------------------------------------------------------------------

/** Footprint cells of every piece the runtime seats with a contact shadow. */
const CONTACT_CELLS = new Map<number, number>();
const CONTACT_ALL = new Set<number>();
for (const piece of SCENERY) {
  if (piece.footprint.length === 0 || piece.contactShadow === false) continue;
  const inset = piece.footprint.length === 1 ? 0.24 : 0;
  for (const cell of piece.footprint) {
    const key = (cell.y + 100) * 1000 + (cell.x + 100);
    CONTACT_CELLS.set(key, Math.max(CONTACT_CELLS.get(key) ?? 0, inset));
    CONTACT_ALL.add(key);
  }
}
const OCCLUDERS = new Set<number>(CONTACT_ALL);
// Trees opt out of the runtime's footprint ring (`contactShadow: false`, a whole-tile box that
// read as a dark slab with a thin black border round a trunk a fraction of its width): the drawn
// root seats the ground here, as a soft round shade (`treeOcclusion`), not as a cell.
const TREE_ROOTS = new Map<number, { x: number; y: number }[]>();
for (const { piece } of TREES) {
  const tile = piece.depth ?? piece.footprint[0];
  if (!tile) continue;
  const key = (Math.floor(tile.y) + 100) * 1000 + (Math.floor(tile.x) + 100);
  const list = TREE_ROOTS.get(key) ?? [];
  list.push({ x: tile.x + 0.5, y: tile.y + 0.5 });
  TREE_ROOTS.set(key, list);
}
// Surround runs carry `contactShadow: false`; their foot still seats the
// ground. It does so by the wall's own footprint rectangle (`WALL_FEET`), not by the
// whole tile cells it touches: a cell's flat occlusion plus the wall's shadow on itself
// baked a hard-edged dark slab on the lawn beside the wall wherever the wall art does
// not reach the cell's far edge.
const WALL_FEET: readonly Rect[] = VILLAGE_VOLUMES.filter((v) => v.kind === 'wall').flatMap((v) => {
  const s = v.section(1);
  return s ? [s] : [];
});
/** Ground-pixel distance to the nearest surround wall's footprint; negative under it. */
function wallDistancePx(x: number, y: number): number {
  let best = Infinity;
  for (const r of WALL_FEET) {
    // Outside a rectangle the distance is at least its larger axis gap: skip those that cannot win.
    const gap =
      Math.max(
        Math.abs(x - (r.x0 + r.x1) / 2) - (r.x1 - r.x0) / 2,
        Math.abs(y - (r.y0 + r.y1) / 2) - (r.y1 - r.y0) / 2,
      ) * GROUND_PX_PER_TILE;
    if (gap > 0 && gap >= best) continue;
    best = Math.min(best, rectSd(r, x, y) * GROUND_PX_PER_TILE);
  }
  return best;
}

/** Mirrors the runtime's band table (`OCCLUSION` in `src/render/grounding.ts`). */
const RUNTIME_BANDS: readonly (readonly [number, number])[] = [
  [0.05, 0.55],
  [0.1, 0.45],
  [0.16, 0.34],
  [0.23, 0.24],
  [0.31, 0.14],
  [0.4, 0.07],
];

/** Distance in tiles from a logical point to the nearest cell of a set; negative inside. */
function cellDistance(
  set: ReadonlyMap<number, number> | ReadonlySet<number>,
  x: number,
  y: number,
  reach: number,
): number {
  let best = Infinity;
  const r = Math.ceil(reach + 0.5);
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  for (let cy = fy - r; cy <= fy + r; cy++)
    for (let cx = fx - r; cx <= fx + r; cx++) {
      const key = (cy + 100) * 1000 + (cx + 100);
      if (!set.has(key)) continue;
      const inset = set instanceof Map ? (set.get(key) ?? 0) : 0;
      const d = Math.max(Math.abs(x - cx - 0.5), Math.abs(y - cy - 0.5)) - (0.5 - inset);
      if (d < best) best = d;
    }
  return best;
}

/** The runtime's own contact-shadow ink alpha at a world pixel (0 outside its reach). */
export function contactAlpha(wx: number, wy: number): number {
  const p = worldToLogical(wx, wy);
  const d = cellDistance(CONTACT_CELLS, p.x, p.y, 0.5);
  if (d > 0.4) return 0;
  return RUNTIME_BANDS.find(([reach]) => d < reach)?.[1] ?? 0;
}

/** Soft occlusion 0..1 hugging every footprint, past the runtime's reach too. */
export function occlusionAt(wx: number, wy: number, cast: number): number {
  const p = worldToLogical(wx, wy);
  const d = cellDistance(OCCLUDERS, p.x, p.y, 1);
  const dd = Math.max(0, d);
  const cells = d > 0.9 ? 0 : Math.exp(-dd / 0.16) * 0.2 + Math.exp(-dd / 0.5) * 0.06;
  const ao = Math.max(cells, treeOcclusion(wx, wy));
  return Math.min(0.34, ao * (1 + 1.1 * cast));
}

/** Soft round occlusion at a tree's drawn root: strongest on the trunk, gone within half a tile. */
function treeOcclusion(wx: number, wy: number): number {
  const p = worldToLogical(wx, wy);
  let best = 0;
  const fx = Math.floor(p.x);
  const fy = Math.floor(p.y);
  for (let cy = fy - 1; cy <= fy + 1; cy++)
    for (let cx = fx - 1; cx <= fx + 1; cx++)
      for (const root of TREE_ROOTS.get((cy + 100) * 1000 + (cx + 100)) ?? []) {
        const r = Math.hypot(p.x - root.x, p.y - root.y);
        if (r < 0.7) best = Math.max(best, 0.26 * Math.exp(-((r / 0.3) ** 2)));
      }
  return best;
}

/** The same soft occlusion hugging a surround wall's foot rectangle (0 far from any). */
function wallOcclusion(wx: number, wy: number): number {
  const p = worldToLogical(wx, wy);
  const dd = Math.max(0, wallDistancePx(p.x, p.y) / GROUND_PX_PER_TILE);
  if (dd > 0.9) return 0;
  return Math.exp(-dd / 0.16) * 0.2 + Math.exp(-dd / 0.5) * 0.06;
}

// ---------------------------------------------------------------------------
// Baked ground contact: every true piece, from its exact foot rectangles
// ---------------------------------------------------------------------------

/**
 * Where a true piece stands on the ground: each volume that starts at height 0, in
 * the guide's own coordinates (`pieces.py`), so a plinth, a table leg, a planter rim and
 * an abutment stone each have their own foot rather than the footprint's tile box.
 * The pieces opt out of the runtime's footprint ring (`contactShadow: false` in
 * `baDan.ts`), so this is the whole of their ground contact:
 *
 * - a tight dark line hugging the foot (`LINE_PX`, 0.55 of the ground),
 * - a soft falloff over `FALLOFF_PX` to 0.85, then a faint tail to nothing,
 * - the same all the way round, lit sides included.
 *
 * A piece's feet combine by their strongest, so the seam between a house's terrace and
 * its plinth does not double; different pieces multiply, so the gap between a plinth
 * and a planter, or two abutment stones, is darker than either edge, as an inside
 * corner is.
 */
export interface Foot {
  readonly id: string;
  readonly piece: string;
  readonly kind: Volume['kind'];
  readonly height: number;
  readonly rect: Rect;
}
/** The scenery piece a foot belongs to: a dressing part is `<placement id>-<part>`, the rest name their piece. */
const DRESSING_IDS = BA_DAN_DRESSING.map((_, i) => `d${i}`).sort((a, b) => b.length - a.length);
const pieceOf = (id: string): string =>
  DRESSING_IDS.find((d) => id.startsWith(`${d}-`)) ??
  id.replace(/-(terrace|plinth|rim|leg-[a-d]|abutment-\d\d)$/, '');
export const FEET: readonly Foot[] = VILLAGE_VOLUMES.filter(
  (v) => v.hMin === 0 && v.kind !== 'wall',
).map((v) => ({
  id: v.id,
  piece: pieceOf(v.id),
  kind: v.kind,
  height: v.hMax,
  rect: v.section(0) as Rect,
}));

/** Ground pixels of the dark line, of the falloff after it, and of the faint tail. */
export const LINE_PX = 2.6;
export const FALLOFF_PX = 12;
export const TAIL_PX = 14;
export const LINE_GROUND = 0.55;
export const FALLOFF_GROUND = 0.85;

/** Strength and reach of a foot: a thin leg or a low terrace does not seat like a plinth. */
function footWeight(foot: Foot): { k: number; reach: number } {
  if (foot.kind === 'stall') return { k: 0.78, reach: 0.55 };
  // A post, a leg of a rack, a wheel's tread: a thin foot seats like a table leg.
  if (
    foot.kind === 'prop' &&
    Math.min(foot.rect.x1 - foot.rect.x0, foot.rect.y1 - foot.rect.y0) < 0.2
  )
    return { k: 0.78, reach: 0.55 };
  if (foot.height <= TERRACE_H) return { k: 0.75, reach: 0.8 };
  if (foot.kind === 'bridge') return { k: 1, reach: 0.85 };
  return { k: 1, reach: 1 };
}

/** What a foot leaves of the ground `d` ground pixels from its edge (1 = untouched). */
export function contactGround(d: number, k = 1, reach = 1): number {
  const e = Math.max(0, d) / reach;
  let m: number;
  if (e <= LINE_PX) m = LINE_GROUND;
  else if (e <= LINE_PX + FALLOFF_PX) {
    const t = (e - LINE_PX) / FALLOFF_PX;
    m = LINE_GROUND + (FALLOFF_GROUND - LINE_GROUND) * (1 - (1 - t) * (1 - t));
  } else
    m =
      FALLOFF_GROUND +
      (1 - FALLOFF_GROUND) * smooth(LINE_PX + FALLOFF_PX, LINE_PX + FALLOFF_PX + TAIL_PX, e);
  return 1 - (1 - m) * k;
}

const FOOT_REACH_TILES = 0.45;
const FOOT_INDEX = new Map<number, Foot[]>();
for (const foot of FEET) {
  const r = foot.rect;
  for (
    let ty = Math.floor(r.y0 - FOOT_REACH_TILES);
    ty <= Math.floor(r.y1 + FOOT_REACH_TILES);
    ty++
  )
    for (
      let tx = Math.floor(r.x0 - FOOT_REACH_TILES);
      tx <= Math.floor(r.x1 + FOOT_REACH_TILES);
      tx++
    ) {
      const key = (ty + 100) * 1000 + (tx + 100);
      const list = FOOT_INDEX.get(key);
      if (list) list.push(foot);
      else FOOT_INDEX.set(key, [foot]);
    }
}

/** Ground-pixel distance outside the nearest foot of any true piece (0 or less inside; Infinity far off). */
export function footDistancePx(wx: number, wy: number): number {
  const p = worldToLogical(wx, wy);
  let best = Infinity;
  for (const foot of FOOT_INDEX.get((Math.floor(p.y) + 100) * 1000 + (Math.floor(p.x) + 100)) ?? [])
    best = Math.min(best, rectSd(foot.rect, p.x, p.y) * GROUND_PX_PER_TILE);
  return best;
}

/** The nearest true-piece foot at a world pixel: its ground-pixel distance and the scenery piece it belongs to. */
export function footAt(wx: number, wy: number): { d: number; piece: string } {
  const p = worldToLogical(wx, wy);
  let best = { d: Infinity, piece: '' };
  for (const foot of FOOT_INDEX.get((Math.floor(p.y) + 100) * 1000 + (Math.floor(p.x) + 100)) ??
    []) {
    const d = rectSd(foot.rect, p.x, p.y) * GROUND_PX_PER_TILE;
    if (d < best.d) best = { d, piece: foot.piece };
  }
  return best;
}

/** What the true pieces' feet leave of the lit ground at a world pixel (1 = untouched). */
export function contactMultiplier(wx: number, wy: number): number {
  const p = worldToLogical(wx, wy);
  const best = new Map<string, number>();
  for (const foot of FOOT_INDEX.get((Math.floor(p.y) + 100) * 1000 + (Math.floor(p.x) + 100)) ??
    []) {
    const d = rectSd(foot.rect, p.x, p.y) * GROUND_PX_PER_TILE;
    if (d <= 0) continue;
    const { k, reach } = footWeight(foot);
    const m = contactGround(d, k, reach);
    if (m < (best.get(foot.piece) ?? 1)) best.set(foot.piece, m);
  }
  let out = 1;
  for (const m of best.values()) out *= m;
  // Two pieces' edges at once is an inside corner: no darker than the line itself twice.
  return Math.max(0.36, out);
}

/**
 * Sky occlusion under what hangs over the ground: a table's top and the bridge's deck.
 * The cast shadow of a low top lands mostly under it but shifted down-right, leaving
 * the strip at its up-left edge lit; the ground between the legs is dark all the way
 * across, soft at the edge. Returns the share of light taken (0 = none).
 */
const OVERHANGS = VILLAGE_VOLUMES.filter((v) => v.hMin > 0 && /-top$|bridge-deck$/.test(v.id)).map(
  (v) => ({
    rect: v.section(v.hMin) as Rect,
    height: v.hMin,
    take: v.id === 'bridge-deck' ? 0.3 : 0.34,
  }),
);
export function overhangTake(wx: number, wy: number): number {
  const p = worldToLogical(wx, wy);
  let best = 0;
  for (const o of OVERHANGS) {
    const sd = rectSd(o.rect, p.x, p.y) * GROUND_PX_PER_TILE;
    // Softer the higher the top is; a leg's own corner sits under it, so inside it is full.
    const sigma = 3 + 0.22 * o.height;
    if (sd > sigma) continue;
    best = Math.max(best, o.take * smooth(sigma, -sigma, sd));
  }
  return best;
}

// ---------------------------------------------------------------------------
// The runtime's ground joins
// ---------------------------------------------------------------------------

/**
 * Ba Dan is a `partial` scene, so the renderer bakes the rules grid's ground
 * joins and lays them over the finished plates (`decorMode` 'seams',
 * `src/render/backends/pixi.ts`, `canvas2d.ts`; baked by
 * `src/render/decorSheets.ts` through `paintTileSeams` in quiet mode, over the
 * contact shadow). On every open tile whose neighbour is another material, the
 * neighbour's colour is washed along the shared edge as a ragged wedge: a few
 * pixels deep at 23% (grass over paving, paving over grass, water over a kerb at
 * 16%). That is the pale green line along the paving side of every lawn
 * boundary and the translucent band along a canal kerb: the plates cannot show
 * what is drawn over them, so the bake pre-compensates (`unseam`) and the
 * composite reproduces the wash (`withRuntimeSeams`).
 *
 * The wedge is a pure function of the tile and the pixel inside it, from the
 * same `tileNoise` the painter uses, so it is the same polygon the renderer
 * lays down. If the renderer stops drawing seams over this scene, set
 * `COMPENSATE_RUNTIME_SEAMS` to false and regenerate the plates.
 */
export const COMPENSATE_RUNTIME_SEAMS = true;

type SeamMaterial = TerrainId | 'water';
interface SeamTile {
  readonly material: SeamMaterial;
  readonly blocked: boolean;
  readonly elevation: number;
}
/** The painter's quiet wedge: depth as a share of the tile, and its alpha. */
const SEAM_DEPTH = 0.13 * 0.7;
const SEAM_ALPHA = 0.42 * 0.55;
const SEAM_ALPHA_WET = 0.3 * 0.55;

function seamTileAt(x: number, y: number): SeamTile | undefined {
  const { rows, legend, width, height } = BA_DAN_VILLAGE;
  if (x < 0 || y < 0 || x >= width || y >= height) return undefined;
  const template = legend[rows[y]?.[x] ?? ''];
  if (!template) return undefined;
  const water = template.surface === 'water' || template.terrain === 'water_deep';
  return {
    material: water ? 'water' : template.terrain,
    blocked: template.blocked === true,
    elevation: template.elevation ?? 0,
  };
}

const hexRgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
const SEAM_COLOURS: Readonly<Record<string, Rgb>> = {
  ...Object.fromEntries(Object.entries(TERRAIN_STYLES).map(([k, v]) => [k, hexRgb(v.fill)])),
  water: hexRgb(SURFACE_STYLES.water.fill),
};

export interface SeamWash {
  readonly rgb: Rgb;
  readonly alpha: number;
}

/** The washes the renderer lays over a world pixel, in the order it lays them. */
export function runtimeSeams(wx: number, wy: number): readonly SeamWash[] {
  const g = worldToLogical(Math.floor(wx) + 0.5, Math.floor(wy) + 0.5);
  const tx = Math.floor(g.x);
  const ty = Math.floor(g.y);
  const tile = seamTileAt(tx, ty);
  // A blocked tile has no join of its own; painted water is skipped outright.
  if (!tile || tile.blocked || tile.material === 'water') return [];
  const u = g.x - tx;
  const v = g.y - ty;
  const neighbours = [
    seamTileAt(tx, ty - 1),
    seamTileAt(tx + 1, ty),
    seamTileAt(tx, ty + 1),
    seamTileAt(tx - 1, ty),
  ];
  const out: SeamWash[] = [];
  for (let side = 0; side < 4; side++) {
    const other = neighbours[side];
    if (!other || other.elevation !== tile.elevation || other.material === tile.material) continue;
    // Undo the painter's rotation: `a` runs along the joined edge, `b` away from it.
    const [a, b] = [
      [u, v],
      [v, 1 - u],
      [1 - u, 1 - v],
      [1 - v, u],
    ][side] as [number, number];
    const k = Math.min(5, Math.max(0, Math.floor(a * 6)));
    const depthAt = (i: number): number =>
      SEAM_DEPTH * (0.3 + 0.7 * tileNoise(tx, ty, 120 + side * 8 + i));
    const d0 = depthAt(k);
    const d1 = depthAt(k + 1);
    const edge = d0 + (d1 - d0) * (a * 6 - k);
    if (b < 0 || b > edge) continue;
    const wet = other.material === 'water';
    out.push({
      rgb: SEAM_COLOURS[other.material] ?? [0, 0, 0],
      alpha: wet ? SEAM_ALPHA_WET : SEAM_ALPHA,
    });
  }
  return out;
}

/** What a player sees of a baked colour once the renderer's joins are over it. */
export function withRuntimeSeams(
  wx: number,
  wy: number,
  rgb: readonly number[],
): [number, number, number] {
  const out: [number, number, number] = [rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0];
  for (const wash of runtimeSeams(wx, wy))
    for (let c = 0; c < 3; c++) out[c] = out[c]! * (1 - wash.alpha) + wash.rgb[c]! * wash.alpha;
  return [clamp255(out[0]), clamp255(out[1]), clamp255(out[2])];
}

/** The colour that, once the renderer's joins are over it, lands on `target`. */
function unseam(target: number, washes: readonly SeamWash[], channel: number): number {
  let value = target;
  for (let i = washes.length - 1; i >= 0; i--) {
    const wash = washes[i]!;
    value = (value - wash.rgb[channel]! * wash.alpha) / (1 - wash.alpha);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Open-ground light
// ---------------------------------------------------------------------------

/** Slow, small, warm drift of the sun over open ground; ±6.5%, no vignette. */
export function sunLift(wx: number, wy: number): Rgb {
  const { x, y } = worldToLogical(wx, wy);
  const n = noise2(x / 7.5, y / 7.5, 311) * 0.6 + noise2(x / 2.6, y / 2.6, 313) * 0.4;
  const k = 1 + (n - 0.5) * 0.13;
  return [SUN_TINT[0] * k, SUN_TINT[1] * k, SUN_TINT[2] * (1 + (n - 0.5) * 0.04)];
}

export interface LightSample {
  /** Per-channel multiply for the lit and shaded ground together. */
  readonly mul: Rgb;
  readonly cast: number;
}

/** The unit-less multiplier to apply to a surface colour at a world pixel. */
export function lightAt(wx: number, wy: number, seat = 0): LightSample {
  const px = Math.floor(wx) + 0.5;
  const py = Math.floor(wy) + 0.5;
  const sun = sunLift(px, py);
  // The ground under a surround wall is not in its own shadow: the wall art hides it, and
  // where it does not the lawn shows as lawn, with only the soft foot occlusion.
  const p = worldToLogical(px, py);
  const wallPx = wallDistancePx(p.x, p.y);
  const cast = shadowCover(px, py) * smooth(-2, 12, wallPx);
  // `seat` (0..1) is a flat surface laid at a piece's foot, a door landing: it is a floor, not a
  // wall's foot, so the foot line and the corner occlusion take far less of it and what is
  // left is the shade it is really in.
  const keep = 1 - 0.7 * seat;
  const ao =
    Math.min(
      0.34,
      Math.max(occlusionAt(px, py, cast), 0.4 * wallOcclusion(px, py) * (1 + 1.1 * cast)),
    ) * keep;
  const feet = (1 - (1 - contactMultiplier(px, py)) * keep) * (1 - overhangTake(px, py));
  const dark = (c: number): number => (1 - cast * (1 - SHADOW_MULTIPLY[c]!)) * (1 - ao) * feet;
  return { mul: [sun[0] * dark(0), sun[1] * dark(1), sun[2] * dark(2)], cast };
}

/**
 * The multiplier of open ground at a world pixel from the sun and the pieces' own cast shadow
 * only (no trees, no foot line or occlusion): what a blade of grass standing clear of a wall
 * is lit by, for the fringe the packer paints into a piece's own bottom edge.
 */
export function openLightAt(wx: number, wy: number): Rgb {
  const sun = sunLift(wx, wy);
  const cast = shadowOnPlane(VILLAGE_VOLUMES, wx, wy, 0);
  return [0, 1, 2].map((c) => sun[c]! * (1 - cast * (1 - SHADOW_MULTIPLY[c]!))) as unknown as Rgb;
}

const clamp255 = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));

/**
 * The baked colour of a ground pixel: lit and shaded, with the runtime's
 * contact ink accounted for. Over the runtime ink the pixel lands on the
 * intended shade; where the contact band is dense the bake simply stays lit
 * rather than darkening twice.
 */
export function litRgb(
  wx: number,
  wy: number,
  rgb: readonly number[],
  seat = 0,
): [number, number, number] {
  const { mul } = lightAt(wx, wy, seat);
  const c = contactAlpha(Math.floor(wx) + 0.5, Math.floor(wy) + 0.5);
  const washes = COMPENSATE_RUNTIME_SEAMS ? runtimeSeams(wx, wy) : [];
  // A wash that is darker than bright paving puts a ceiling on what can be
  // seen through it: even a white texel shows at most `reach`. Clamping each
  // channel to it would tint the line (red falls short first, which read as a
  // pale green band), so the whole target eases down together, keeping its hue.
  const reach = [0, 1, 2].map((k) => {
    let v = 255 * (1 - c) + SHADOW_RGB[k]! * c;
    for (const wash of washes) v = v * (1 - wash.alpha) + wash.rgb[k]! * wash.alpha;
    return v;
  });
  let ease = 1;
  for (let k = 0; k < 3; k++) {
    const want = (rgb[k] ?? 0) * mul[k]!;
    if (want > 0) ease = Math.min(ease, reach[k]! / want);
  }
  const out: [number, number, number] = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    // The renderer lays the contact ink, then its joins, over what we bake:
    // work back from the colour the player should see through both.
    const lit = unseam((rgb[k] ?? 0) * mul[k]! * ease, washes, k);
    const free = unseam((rgb[k] ?? 0) * SUN_TINT[k]! * ease, washes, k);
    // Solve for the colour that lands on `lit`, never brighter than the open lit ground.
    const solved = c > 0 ? (lit - SHADOW_RGB[k]! * c) / (1 - c) : lit;
    out[k] = clamp255(Math.min(solved, free));
  }
  return out;
}

/** What a player sees: the baked colour with the runtime's contact ink over it. */
export function withRuntimeContact(
  wx: number,
  wy: number,
  rgb: readonly number[],
): [number, number, number] {
  const c = contactAlpha(Math.floor(wx) + 0.5, Math.floor(wy) + 0.5);
  return [0, 1, 2].map((k) => clamp255((rgb[k] ?? 0) * (1 - c) + SHADOW_RGB[k]! * c)) as [
    number,
    number,
    number,
  ];
}
