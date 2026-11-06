/**
 * Ba Dan's top-down ground (ADR 0104 §3, phase T3): the prototype's ground bake
 * (`prototypes/topdown/src/v13/ground.js` `bakeGround`) re-implemented over RGBA buffers, run on the
 * game's layout (`src/content/topdownLayouts.ts`), and packed into lossless 1 px plates and an
 * upright atlas under `public/art/topdown/ba-dan/`, with the scene the runtime draws beside them
 * (`scene.json`, a `MapScene`: an asset, so none of it is in the bundle).
 *
 *   node --import tsx scripts/art/topdown/pack-ground.ts [--check]
 *
 * Deterministic: integer, unscaled blits, the prototype's seeded generator continued from the rim's
 * bites in a fixed call order, and the owner's `hardShadowMask` (`src/render/shadow/`) for every
 * static shadow. `--check` bakes in memory and fails when a shipped file differs, is missing or is
 * not the packer's.
 *
 * - **Plates**: the Wang terrain (32 px tiles from `prototypes/topdown/assets/tiles/`, the
 *   `tileKey` of `build13.py` 55-66), the cliff rim (`cliff-patterns.json`, recovered from the
 *   prototype page), the per-pixel grass edges, the verge, the void's steps, the river steps and
 *   the walkway over the lip, and every static object's grounding: the seam, contact and cast,
 *   the house aprons and doorsteps, the grass kit's contact layer. Flat objects (the bridge, the
 *   walkway, the steps, flowers and tufts) are drawn into the plates.
 * - **Uprights**: every standing object with its grass fringe (the kit's tufts and a house's skirt)
 *   composited over its foot, trimmed, in one atlas.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { shelfPack, composeAtlas } from '../lib/atlas';
import type { Image } from '../lib/image';
import { readPng } from '../lib/image';
import { BA_DAN_VILLAGE } from '../../../src/content/maps/village';
import { encodeWebpLossless } from '../lib/webp';
import {
  alphaOf,
  floorReaction,
  groundKit,
  hardShadowMask,
  paintMask,
  SHADOW,
  type HardShadowOptions,
  type RgbaImage,
  type ShadowMask,
} from '../../../src/render/shadow/hardShadowMask';
import {
  COLS,
  ORIGIN,
  PLATE_H,
  PLATE_W,
  RNG_AFTER_RIM,
  ROWS,
  TILE as T,
  bottomV,
  cliffCode,
  inMass,
  makeLcg,
  rightV,
  tileCorners,
  vnoise,
  hash2,
  vt,
  wangSet,
  type Terrain,
} from '../../../src/content/scenes/baDan.topdown.terrain';
import type { MapScene, SceneScenery } from '../../../src/core/types';
import type { TopDownObject } from '../../../src/content/topdownLayout';
import { BA_DAN_TOPDOWN_LAYOUT } from '../../../src/content/topdownLayouts';
import cliffPatterns from './cliff-patterns.json' with { type: 'json' };

export const ASSETS = 'prototypes/topdown/assets';
export const OUT = 'public/art/topdown/ba-dan';
export const URL_ROOT = 'art/topdown/ba-dan';
/**
 * The scene the runtime draws (`MapScene`), as an asset beside its plates: fetched under
 * `?style=topdown` only, so none of it is in the bundle (`src/content/topdown.ts`).
 */
export const SCENE = `${OUT}/scene.json`;
/** The margin round an upright for its fringe (the grass kit's `m`). */
const M = 10;
const GUTTER = 1;
const ATLAS_WIDTH = 1024;

/** `build13.py` 55-66: which corner terrain the Wang bit 1 means in each set (measured there by colour). */
const TILE_KEY = { gc: 'C', canal: 'C', dirt: 'G' } as const;
const SET_DIRS = { gc: 'gc32', canal: 'canal32', dirt: 'dirt32' } as const;

const GR = ['#243d33', '#35593f', '#4f7d4a', '#7aa05a', '#a9c46f', '#c9d98a'] as const;
const DIRT = ['#3a2e2c', '#5a3d2b', '#7d5434'] as const;
const STONE = ['#5d5b63', '#85807f', '#aea89c'] as const;
const SHADOW_RGB = [0x32, 0x21, 0x25] as const;

/* ------------------------------------------------------------------ */
/* Pixels                                                              */
/* ------------------------------------------------------------------ */

type Rgb = readonly [number, number, number];
const hex = (h: string): Rgb => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const blank = (width: number, height: number): RgbaImage => ({
  width,
  height,
  data: new Uint8ClampedArray(width * height * 4),
});
const at = (a: ArrayLike<number>, i: number): number => a[i] ?? 0;

function load(path: string): RgbaImage {
  const png = readPng(path);
  return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
}

/** Source-over of one straight-alpha pixel onto `dst` at index `j`, rounded. */
function over(d: Uint8ClampedArray, j: number, r: number, g: number, b: number, a: number): void {
  if (a <= 0) return;
  const da = at(d, j + 3) / 255;
  const oa = a + da * (1 - a);
  const mix = (s: number, t: number): number => (s * a + t * da * (1 - a)) / oa;
  d[j] = Math.round(mix(r, at(d, j)));
  d[j + 1] = Math.round(mix(g, at(d, j + 1)));
  d[j + 2] = Math.round(mix(b, at(d, j + 2)));
  d[j + 3] = Math.round(oa * 255);
}

/** `drawImage`, unscaled: `src`'s rect (sx, sy, w, h) source-over at (dx, dy), clipped. */
function draw(
  dst: RgbaImage,
  src: RgbaImage,
  dx: number,
  dy: number,
  sx = 0,
  sy = 0,
  w = src.width,
  h = src.height,
): void {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const X = dx + x,
        Y = dy + y;
      if (X < 0 || Y < 0 || X >= dst.width || Y >= dst.height) continue;
      const s = ((sy + y) * src.width + sx + x) * 4;
      const a = at(src.data, s + 3) / 255;
      if (!a) continue;
      over(
        dst.data,
        (Y * dst.width + X) * 4,
        at(src.data, s),
        at(src.data, s + 1),
        at(src.data, s + 2),
        a,
      );
    }
}

/** `fillRect` with an rgba fill, source-over, clipped. */
function fill(dst: RgbaImage, x: number, y: number, w: number, h: number, c: Rgb, a = 1): void {
  for (let Y = Math.max(0, y); Y < Math.min(dst.height, y + h); Y++)
    for (let X = Math.max(0, x); X < Math.min(dst.width, x + w); X++)
      over(dst.data, (Y * dst.width + X) * 4, c[0], c[1], c[2], a);
}

function crop(src: RgbaImage, sx: number, sy: number, w: number, h: number): RgbaImage {
  const out = blank(w, h);
  draw(out, src, 0, 0, sx, sy, w, h);
  return out;
}

const lum = (d: ArrayLike<number>, j: number): number =>
  0.299 * at(d, j) + 0.587 * at(d, j + 1) + 0.114 * at(d, j + 2);

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

interface Sources {
  /** Wang tiles per set, by corner bits (`c0101`). */
  wang: Record<keyof typeof SET_DIRS, Map<string, RgbaImage>>;
  variants: { G: RgbaImage[]; C: RgbaImage[]; C2: RgbaImage[] };
  cliff: RgbaImage[];
  objects: Map<string, RgbaImage>;
}

function loadSources(objects: readonly TopDownObject[]): Sources {
  const tiles = `${ASSETS}/tiles`;
  const wang = Object.fromEntries(
    Object.entries(SET_DIRS).map(([set, dir]) => {
      const m = new Map<string, RgbaImage>();
      for (let i = 0; i < 16; i++) {
        const bits = i.toString(2).padStart(4, '0');
        m.set(bits, load(`${tiles}/${dir}/c${bits}.png`));
      }
      return [set, m];
    }),
  ) as Sources['wang'];
  const strip = (dir: string): RgbaImage[] =>
    readdirSync(`${tiles}/${dir}`)
      .filter((f) => /^tile_\d+\.png$/.test(f))
      .sort((a, b) => Number(a.slice(5, -4)) - Number(b.slice(5, -4)))
      .map((f) => crop(load(`${tiles}/${dir}/${f}`), 0, 0, T, T));
  const cliff = cliffPatterns.tiles.map((t) => load(`${tiles}/cliff32/${t.file}`));
  const sprites = new Map<string, RgbaImage>();
  for (const o of objects) {
    if (sprites.has(o.sprite)) continue;
    // T3's redraws (the straight-on bridge) take precedence over the v12 objects
    const dir = existsSync(`${ASSETS}/objects_t3/${o.sprite}.png`)
      ? 'objects_t3'
      : o.sprite.startsWith('house_')
        ? 'objects_bd13'
        : 'objects12';
    sprites.set(o.sprite, dehalo(stripDisc(load(`${ASSETS}/${dir}/${o.sprite}.png`))));
  }
  return {
    wang,
    variants: { G: strip('var_grass'), C: strip('var_cobble'), C2: strip('var_cobble2') },
    cliff,
    objects: sprites,
  };
}

/**
 * Recolours the outer outline only: a light, near-grey pixel on the edge of a sprite's lowest 35 %
 * (a backdrop plate's trace, or a lit step's edge against the clear) takes the darkest tone of its
 * opaque neighbours, so nothing pale rims an object where it meets the ground. `art-lessons.md`:
 * recolour only the outer outline, never by a global threshold.
 */
export function dehalo(img: RgbaImage): RgbaImage {
  const W = img.width,
    H = img.height,
    p = new Uint8ClampedArray(img.data);
  const a = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= W || y >= H ? 0 : at(img.data, (y * W + x) * 4 + 3);
  const n4 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  for (let y = Math.ceil(H * 0.65); y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (!a(x, y) || n4.every(([dx, dy]) => a(x + dx, y + dy))) continue;
      const r = at(img.data, i),
        g = at(img.data, i + 1),
        b = at(img.data, i + 2);
      if (0.299 * r + 0.587 * g + 0.114 * b <= 150 || Math.max(r, g, b) - Math.min(r, g, b) >= 30)
        continue;
      let best = -1,
        bl = 1e9;
      for (const [dx, dy] of n4) {
        if (!a(x + dx, y + dy)) continue;
        const j = ((y + dy) * W + x + dx) * 4,
          l = lum(img.data, j);
        if (l < bl) {
          bl = l;
          best = j;
        }
      }
      if (best >= 0) for (let c = 0; c < 3; c++) p[i + c] = at(img.data, best + c);
    }
  return { width: W, height: H, data: p };
}

/**
 * The pixels of a dark ground disc baked under a sprite (v12's banner pole stands on a black
 * ellipse): in the lowest rows, the near-black, unsaturated pixels outside the columns of the stem
 * that comes down into them, and below the stem's own last coloured pixel. Under a dozen such
 * pixels is an outline, not a disc, and nothing is returned. The grounding is the bake's, so the
 * sprite must not bring its own.
 */
export function bakedDisc(img: RgbaImage): number[] {
  const W = img.width,
    H = img.height,
    d = img.data;
  const op = (x: number, y: number): boolean => at(d, (y * W + x) * 4 + 3) > 0;
  const dark = (x: number, y: number): boolean => {
    const i = (y * W + x) * 4,
      hi = Math.max(at(d, i), at(d, i + 1), at(d, i + 2)),
      lo = Math.min(at(d, i), at(d, i + 1), at(d, i + 2));
    return op(x, y) && hi < 60 && hi - lo < 25;
  };
  let bottom = -1;
  for (let y = H - 1; y >= 0 && bottom < 0; y--)
    for (let x = 0; x < W; x++) if (op(x, y)) bottom = y;
  if (bottom < 0) return [];
  const span = (y: number): [number, number] => {
    let l = W,
      r = -1;
    for (let x = 0; x < W; x++)
      if (op(x, y)) {
        l = Math.min(l, x);
        r = Math.max(r, x);
      }
    return [l, r];
  };
  // the disc's top: the highest row, within the lowest 15 %, where dark pixels run wider than the row above
  const zone = Math.max(6, Math.round(H * 0.15));
  let top = -1;
  for (let y = Math.max(1, bottom - zone + 1); y <= bottom && top < 0; y++) {
    const [l, r] = span(y),
      [la, ra] = span(y - 1);
    if (ra < 0 || r < 0) continue;
    let wide = 0;
    for (let x = l; x <= r; x++) if ((x < la - 1 || x > ra + 1) && dark(x, y)) wide++;
    if (wide >= 4) top = y;
  }
  if (top < 0) return [];
  const [lo, hi] = span(top - 1);
  let stemEnd = top - 1;
  for (let y = top; y <= bottom; y++)
    for (let x = lo; x <= hi; x++) if (op(x, y) && !dark(x, y)) stemEnd = y;
  const out: number[] = [];
  for (let y = top; y <= bottom; y++)
    for (let x = 0; x < W; x++)
      if (dark(x, y) && (x < lo || x > hi || y > stemEnd)) out.push(y * W + x);
  return out.length >= 12 ? out : [];
}

/** The sprite without its baked ground disc (`bakedDisc`). */
export function stripDisc(img: RgbaImage): RgbaImage {
  const p = new Uint8ClampedArray(img.data);
  for (const i of bakedDisc(img)) p[i * 4 + 3] = 0;
  return { width: img.width, height: img.height, data: p };
}

/* ------------------------------------------------------------------ */
/* The bake                                                            */
/* ------------------------------------------------------------------ */

/** A placed object in the prototype's plate px: its sprite's top-left, size and base. */
export interface Placed {
  readonly o: TopDownObject;
  readonly img: RgbaImage;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly base: number;
}

/**
 * The ford in plate px (ADR 0104, T3; owner, 2026-11-06): the east-west road runs west into water
 * spilled from the canal. `road` is the long, shallow sheet over the road (an east-west ellipse
 * that covers the game's ford cells (0, 7) and (0, 8) at their centres and stops short of where a
 * figure stands in (1, 7) and (1, 8)); `mouth` is the deeper water where the canal spills over its
 * kerb. `box` is the stretch the ford repaints.
 */
export const FORD_POOL = {
  road: { cx: 114, cy: 512, rx: 54, ry: 38 },
  mouth: { cx: 112, cy: 466, rx: 30, ry: 16 },
  box: { x0: 64, y0: 464, x1: 192, y1: 584 },
} as const;

/** Each pixel's terrain class as the bake laid it, for the edge checks. */
export const CLASS = { G: 0, C: 1, W: 2, D: 3, face: 4, void: 5 } as const;

export interface ShadowRecord {
  readonly id: string;
  readonly m: ShadowMask;
  readonly dx: number;
  readonly dy: number;
}

export interface Upright {
  readonly id: string;
  readonly image: RgbaImage;
  /** Top-left in game world px. */
  readonly x: number;
  readonly y: number;
}

export interface Baked {
  readonly ground: RgbaImage;
  /** The plate before any object was grounded on it (no cast, apron or kit): clean ground. */
  readonly clean: RgbaImage;
  /** Terrain class per plate pixel (`CLASS`), before any object or shadow. */
  readonly classes: Uint8Array;
  /** Plate pixels any object's sprite covers (uprights and flats). */
  readonly cover: Uint8Array;
  readonly shadows: readonly ShadowRecord[];
  readonly uprights: readonly Upright[];
  readonly placed: readonly Placed[];
}

/**
 * Where a dirt pixel samples the one plain dirt tile: quilted (`art-lessons.md`: one Wang tile sampled
 * by modulo is wallpaper) over wide, warped regions, each with its own offset and some mirrored, so its
 * streaks never line up in a grid. The plain tile is seamless, so only the regions' wandering borders
 * can show a join.
 */
const QUILT = [
  [0, 0, false],
  [11, 19, true],
  [23, 5, false],
  [6, 27, true],
] as const;
export function dirtIndex(wx: number, wy: number): number {
  const r = Math.max(0, Math.min(3, Math.floor((vnoise(wx, wy, 61, 48) + 1) * 2)));
  const [ox, oy, flip] = QUILT[r] ?? QUILT[0];
  const u = (wx + ox) % T,
    v = (wy + oy) % T;
  return (v * T + (flip ? T - 1 - u : u)) * 4;
}

/** Cliff tile index for tile (x, y): exact pattern first, else the nearest (the prototype's `cliffTile`). */
const CLIFF = cliffPatterns.tiles
  .map((t, i) => ({ i, pat: t.pat, spec: t.pat.filter((v) => v !== 255).length }))
  .sort((a, b) => b.spec - a.spec || a.i - b.i);
function cliffTile(x: number, y: number): number {
  let best = -1,
    bestCost = 1e9;
  for (const t of CLIFF) {
    let cost = 0;
    for (let r = 0; r < 4; r++)
      for (let c = 1; c <= 2; c++) {
        const v = at(t.pat, r * 4 + c),
          w = cliffCode(x + c - 1, y + r - 1);
        if (v === 255 || v === w) continue;
        cost += v === 1 || w === 1 ? 4 : 1;
      }
    if (cost === 0) return t.i;
    if (cost < bestCost) {
      bestCost = cost;
      best = t.i;
    }
  }
  return best;
}

export function bake(objects: readonly TopDownObject[] = BA_DAN_TOPDOWN_LAYOUT.objects): Baked {
  const src = loadSources(objects);
  const grnd = makeLcg(RNG_AFTER_RIM);
  const PW = PLATE_W,
    PH = PLATE_H;
  const g = blank(PW, PH);
  const d = g.data;
  const classes = new Uint8Array(PW * PH).fill(CLASS.void);
  const placed: Placed[] = objects.map((o) => {
    const img = src.objects.get(o.sprite);
    if (!img) throw new Error(`no sprite ${o.sprite}`);
    const base = o.base - ORIGIN.y;
    return {
      o,
      img,
      x: Math.round(o.x - ORIGIN.x - img.width / 2),
      y: base - img.height,
      w: img.width,
      h: img.height,
      base,
    };
  });
  const houses = placed.filter((p) => p.o.kind === 'house');
  const isFlat = (p: Placed): boolean => p.o.kind === 'flat';
  const nearHouse = (x: number, y: number): boolean =>
    houses.some(
      (o) =>
        x * T + 16 > o.x + 4 &&
        x * T + 16 < o.x + o.w - 4 &&
        y * T >= o.base - 14 &&
        y * T <= o.base - 2,
    );
  const setClass = (x: number, y: number, w: number, h: number, c: number): void => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) classes[yy * PW + xx] = c;
  };
  const classOf = (t: Terrain): number => (t === 'V' ? CLASS.void : CLASS[t]);

  // 0. the void
  const VOID = cliffPatterns.void as unknown as Rgb;
  fill(g, 0, 0, PW, PH, VOID);

  /**
   * A grass/dirt tile from the dirt Wang set. Its dirt pixels are re-sampled from the plain dirt
   * tile by the quilt wherever they match the plain tile's own colours, so the streaks keep breaking
   * up to the drawn edge, which (and its rim) is the Wang tile's.
   */
  const pureDirt = src.wang.dirt.get('0000');
  const dirtColours = new Set<number>();
  if (pureDirt)
    for (let i = 0; i < T * T; i++)
      dirtColours.add(
        (at(pureDirt.data, i * 4) << 16) |
          (at(pureDirt.data, i * 4 + 1) << 8) |
          at(pureDirt.data, i * 4 + 2),
      );
  const dirtEdge = (x: number, y: number, c: readonly Terrain[]): void => {
    const bits = c.map((v) => (TILE_KEY.dirt === v ? '1' : '0')).join('');
    const tile = src.wang.dirt.get(bits);
    if (!tile || !pureDirt) throw new Error(`missing dirt tile ${bits}`);
    for (let py = 0; py < T; py++)
      for (let px = 0; px < T; px++) {
        const j = (py * T + px) * 4,
          wx = x * T + px,
          wy = y * T + py,
          o = (wy * PW + wx) * 4;
        const r = at(tile.data, j),
          gg = at(tile.data, j + 1),
          b = at(tile.data, j + 2);
        const plain = dirtColours.has((r << 16) | (gg << 8) | b);
        const k = dirtIndex(wx, wy);
        d[o] = plain ? at(pureDirt.data, k) : r;
        d[o + 1] = plain ? at(pureDirt.data, k + 1) : gg;
        d[o + 2] = plain ? at(pureDirt.data, k + 2) : b;
        d[o + 3] = 255;
        classes[wy * PW + wx] = gg > r + 8 && gg > b + 8 ? CLASS.G : CLASS.D;
      }
  };

  // 1. terrain: the Wang pairs inside the mass, the cliff set at its rim
  const MIXED: [number, number, Terrain[]][] = [];
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const c = tileCorners(x, y);
      if (c.includes('V')) {
        if (
          [
            cliffCode(x, y),
            cliffCode(x + 1, y),
            cliffCode(x, y + 1),
            cliffCode(x + 1, y + 1),
          ].every((v) => v === 0)
        )
          continue;
        const i = cliffTile(x, y);
        const tile = src.cliff[i];
        if (tile) {
          draw(g, tile, x * T, y * T);
          // the lip: grass where green, the void where dark, the cut face between
          for (let py = 0; py < T; py++)
            for (let px = 0; px < T; px++) {
              const j = ((y * T + py) * PW + x * T + px) * 4;
              const r = at(d, j),
                gg = at(d, j + 1),
                b = at(d, j + 2);
              classes[(y * T + py) * PW + x * T + px] =
                gg > r + 14 && gg > b + 8 ? CLASS.G : lum(d, j) < 40 ? CLASS.void : CLASS.face;
            }
        }
        continue;
      }
      // grass and dirt meet on the dirt Wang set's own transition tiles (their drawn, dark-rimmed
      // edge), quilted on the dirt side; grass and cobble (and cobble and dirt) meet per pixel, as the
      // prototype's grass/cobble pairs do
      const uniform = c.every((v) => v === c[0]);
      if (!uniform && c.every((v) => v === 'G' || v === 'D')) {
        dirtEdge(x, y, c);
        continue;
      }
      const soft = c.every((v) => v === 'G' || v === 'C' || v === 'D');
      if (soft && !uniform) {
        MIXED.push([x, y, c]);
        continue;
      }
      const set = wangSet(c) ?? 'gc';
      const bits = c.map((v) => (TILE_KEY[set] === v ? '1' : '0')).join('');
      const pure = c.every((v) => v === c[0]);
      let drawn = false;
      if (pure && c[0] === 'C') {
        const road = y >= 15 && y <= 16 && x >= 4 && x <= 33,
          r = grnd();
        let v = -1;
        if (nearHouse(x, y)) v = 0;
        else if (road && r < 0.5) v = 1;
        if (v >= 0) {
          const n = v * 4 + Math.floor(grnd() * 4);
          const tile = src.variants.C2[n];
          if (tile) draw(g, tile, x * T, y * T);
          drawn = true;
        } else if (grnd() < 0.3) {
          const pool = grnd() < 0.12 ? [4, 5, 6, 7] : [0, 1, 2, 3, 12, 13, 14, 15];
          const tile = src.variants.C[at(pool, Math.floor(grnd() * pool.length))];
          if (tile) draw(g, tile, x * T, y * T);
          drawn = true;
        }
      } else if (pure && c[0] === 'G' && grnd() < 0.45) {
        const tile = src.variants.G[Math.floor(grnd() * src.variants.G.length)];
        if (tile) draw(g, tile, x * T, y * T);
        drawn = true;
      }
      if (!drawn) {
        const tile = src.wang[set].get(bits);
        if (tile && pure && c[0] === 'D')
          for (let py = 0; py < T; py++)
            for (let px = 0; px < T; px++) {
              const o = ((y * T + py) * PW + x * T + px) * 4,
                k = dirtIndex(x * T + px, y * T + py);
              for (let ch = 0; ch < 4; ch++) d[o + ch] = at(tile.data, k + ch);
            }
        else if (tile) draw(g, tile, x * T, y * T);
      }
      if (pure) setClass(x * T, y * T, T, T, classOf(c[0] ?? 'G'));
      else
        for (let py = 0; py < T; py++)
          for (let px = 0; px < T; px++) {
            const j = ((y * T + py) * PW + x * T + px) * 4;
            const water = at(d, j + 2) > at(d, j) + 18 && at(d, j + 1) > at(d, j) + 10;
            classes[(y * T + py) * PW + x * T + px] = water ? CLASS.W : CLASS.C;
          }
    }

  // 1b. the grass/cobble (and grass/dirt) edge per pixel: the corners' paving interpolated across the
  // cell and wobbled by two octaves of value noise, each side sampling its own pure tile. Where cobble
  // and dirt share a tile, the same interpolation with its own noise picks which paving shows.
  {
    const pureG = src.wang.gc.get('0000'),
      pureC = src.wang.gc.get('1111'),
      pureD = src.wang.dirt.get('0000');
    if (!pureG || !pureC || !pureD) throw new Error('missing pure tiles');
    const GT = [pureG, ...src.variants.G];
    const CT = [pureC, ...[0, 1, 2, 3, 12, 13, 14, 15].map((i) => src.variants.C[i] ?? pureC)];
    for (const [x, y, c] of MIXED) {
      const dirt = c.includes('D'),
        both = dirt && c.includes('C'),
        k = c.map((v) => (v === 'C' || v === 'D' ? 1 : 0)),
        kd = c.map((v) => (v === 'D' ? 1 : 0));
      const gt = GT[Math.floor(grnd() * GT.length)] ?? pureG;
      const cobble = !dirt || both ? (CT[Math.floor(grnd() * CT.length)] ?? pureC) : pureC;
      for (let py = 0; py < T; py++)
        for (let px = 0; px < T; px++) {
          const u = (px + 0.5) / T,
            v = (py + 0.5) / T,
            wx = x * T + px,
            wy = y * T + py;
          const f =
            at(k, 0) * (1 - u) * (1 - v) +
            at(k, 1) * u * (1 - v) +
            at(k, 2) * (1 - u) * v +
            at(k, 3) * u * v +
            vnoise(wx, wy, 21, 11) * 0.24 +
            vnoise(wx, wy, 23, 4) * 0.1;
          const fd = both
            ? at(kd, 0) * (1 - u) * (1 - v) +
              at(kd, 1) * u * (1 - v) +
              at(kd, 2) * (1 - u) * v +
              at(kd, 3) * u * v +
              vnoise(wx, wy, 25, 9) * 0.24 +
              vnoise(wx, wy, 27, 4) * 0.1
            : dirt
              ? 1
              : 0;
          const paving = f > 0.5,
            isDirt = paving && fd > 0.5,
            s = paving ? (isDirt ? pureD : cobble) : gt,
            j = isDirt ? dirtIndex(wx, wy) : (py * T + px) * 4,
            o = (wy * PW + wx) * 4;
          d[o] = at(s.data, j);
          d[o + 1] = at(s.data, j + 1);
          d[o + 2] = at(s.data, j + 2);
          d[o + 3] = 255;
          classes[wy * PW + wx] = paving ? (isDirt ? CLASS.D : CLASS.C) : CLASS.G;
        }
    }
  }

  // 1c. where a road, court or path reaches the rim, its cobble or dirt runs on over the grass lip to
  // a ragged end, so it never stops on the tile line beside the lip (a straight edge the eye reads as
  // a ruler)
  {
    const pureC = src.wang.gc.get('1111'),
      pureD = src.wang.dirt.get('0000');
    if (!pureC || !pureD) throw new Error('missing pure tiles');
    const paint = (x: number, y: number, cls: number): void => {
      const i = y * PW + x,
        k = cls === CLASS.D ? dirtIndex(x, y) : ((y % T) * T + (x % T)) * 4,
        t = cls === CLASS.D ? pureD : pureC;
      d[i * 4] = at(t.data, k);
      d[i * 4 + 1] = at(t.data, k + 1);
      d[i * 4 + 2] = at(t.data, k + 2);
      classes[i] = cls;
    };
    const paving = (c: number | undefined): boolean => c === CLASS.C || c === CLASS.D;
    // (first lip pixel x, y, step x, step y, the paving's class), across every tile line
    const runs: [number, number, number, number, number][] = [];
    for (let y = 0; y < PH; y++)
      for (let x = 0; x < PW; x++) {
        const here = classes[y * PW + x];
        if (!paving(here) || here === undefined) continue;
        if (x % T === 0 && x > 0 && classes[y * PW + x - 1] === CLASS.G)
          runs.push([x - 1, y, -1, 0, here]);
        if ((x + 1) % T === 0 && x + 1 < PW && classes[y * PW + x + 1] === CLASS.G)
          runs.push([x + 1, y, 1, 0, here]);
        if (y % T === 0 && y > 0 && classes[(y - 1) * PW + x] === CLASS.G)
          runs.push([x, y - 1, 0, -1, here]);
        if ((y + 1) % T === 0 && y + 1 < PH && classes[(y + 1) * PW + x] === CLASS.G)
          runs.push([x, y + 1, 0, 1, here]);
      }
    for (const [x0, y0, dx, dy, cls] of runs) {
      if (!tileCorners(Math.floor(x0 / T), Math.floor(y0 / T)).includes('V')) continue; // the lip tile only
      const reach = 10 + Math.round(vnoise(x0, y0, 39, 3) * 6);
      for (
        let k = 0, x = x0, y = y0;
        k < reach && classes[y * PW + x] === CLASS.G;
        k++, x += dx, y += dy
      )
        paint(x, y, cls);
    }
  }

  // 2. the verge: darker joints where cobble meets grass, and tufts creeping over the stones
  {
    const isGrass = (i: number): boolean =>
      at(d, i + 1) > at(d, i) + 14 && at(d, i + 1) > at(d, i + 2) + 8;
    const isStone = (i: number): boolean => {
      const r = at(d, i),
        gg = at(d, i + 1),
        b = at(d, i + 2);
      return Math.abs(r - gg) < 22 && Math.abs(gg - b) < 22 && r > 70 && r < 200;
    };
    const darken: [number, number][] = [];
    const ring = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2],
    ] as const;
    for (let y = 2; y < PH - 2; y++)
      for (let x = 2; x < PW - 2; x++) {
        const i = (y * PW + x) * 4;
        if (!isStone(i)) continue;
        let near = 0;
        for (const [dx, dy] of ring)
          if (isGrass(((y + dy) * PW + x + dx) * 4)) {
            near = Math.abs(dx) + Math.abs(dy);
            break;
          }
        if (near) darken.push([i, near === 1 ? 0.38 : 0.2]);
      }
    for (const [i, a] of darken) {
      d[i] = at(d, i) * (1 - a) + 0x32 * a;
      d[i + 1] = at(d, i + 1) * (1 - a) + 0x21 * a;
      d[i + 2] = at(d, i + 2) * (1 - a) + 0x25 * a;
    }
    let creep = 0;
    for (let k = 0; k < 2600 && creep < 260; k++) {
      const [i] = darken[Math.floor(grnd() * darken.length)] ?? [0];
      const p = i / 4,
        x = p % PW,
        y = Math.floor(p / PW);
      if (grnd() < 0.6) continue;
      creep++;
      for (let b = 0; b < 3; b++) {
        const len = 2 + Math.floor(grnd() * 3),
          lean = b - 1;
        for (let s = 0; s < len; s++)
          fill(
            g,
            x + Math.round(lean * s * 0.5),
            y + 1 - s,
            1,
            1,
            hex(s >= len - 1 ? GR[4] : GR[2]),
          );
      }
    }
  }

  // 2b. the canal runs on to the west lip: the tiles under the rim's grass lip take the canal's own columns
  {
    const sx = 82,
      sy = 416,
      sw = 14,
      sh = 64;
    const strip = crop(g, sx, sy, sw, sh);
    for (let y = 0; y < sh; y++)
      for (let x = 0; x < sw; x++) {
        const s = (y * sw + x) * 4,
          o = ((sy + y) * PW + sx - 32 + x) * 4;
        for (let c = 0; c < 4; c++) d[o + c] = at(strip.data, s + c);
        classes[(sy + y) * PW + sx - 32 + x] = classes[(sy + y) * PW + sx + x] ?? CLASS.W;
      }
  }

  const sprite = (p: Placed): RgbaImage => p.img;
  const shadows: ShadowRecord[] = [];

  // 3. the river path carried over the south lip and down the face as steps
  const steps = placed.find((p) => p.o.kind === 'steps');
  if (steps) {
    const dirtTile = src.wang.dirt.get('0000');
    if (!dirtTile) throw new Error('missing dirt');
    const cx = steps.x + Math.round(steps.w / 2),
      B = bottomV(Math.floor(cx / T));
    const x0 = cx - 46,
      w = 2 * T + 28,
      y0 = (B - 1) * T,
      h = T + 24;
    for (let yy = 0; yy < h; yy++)
      for (let xx = 0; xx < w; xx++) {
        const wx = x0 + xx,
          wy = y0 + yy,
          half = 30 - yy * 0.3 + vnoise(wx, wy, 51, 4) * 4;
        if (Math.abs(wx - cx) > half || wy > B * T + 17 + vnoise(wx, 0, 53, 3) * 2) continue;
        const j = (wy * PW + wx) * 4,
          k = dirtIndex(wx, wy);
        d[j] = at(dirtTile.data, k);
        d[j + 1] = at(dirtTile.data, k + 1);
        d[j + 2] = at(dirtTile.data, k + 2);
        classes[wy * PW + wx] = CLASS.D;
      }
    const st = sprite(steps);
    const sm = hardShadowMask(alphaOf(st), st.width, st.height, { flat: true, band: 3 });
    paintMask(g, sm, steps.x - sm.pad, steps.y);
    draw(g, st, steps.x, steps.y);
    for (let k = 0; k < 4; k++)
      fill(
        g,
        steps.x - 2,
        steps.y + 22 + k * 10,
        st.width + 4,
        k === 3 ? st.height : 10,
        [20, 15, 17],
        0.16 + k * 0.2,
      );
  }

  // 3b. the ford: the east-west road runs west into water spilled over the canal's kerb. The terrain
  // keeps its water vertices (the game's ford cells stay water); the bake draws the road going on
  // under a long, shallow sheet, its stones showing through darkened and blued, deep only at the
  // canal mouth. Opaque glints at two scales and an upper-left catch keep it wet rather than a
  // shadow (art-lessons, the surfaces pass); the dry side gets a 1-2 px wet band, no ring; the
  // canal's mossy kerb line turns down round the mouth as an end cap.
  {
    const water = src.wang.canal.get('0000'),
      cobble = src.wang.gc.get('1111'),
      dirtTile = src.wang.dirt.get('0000');
    if (!water || !cobble || !dirtTile) throw new Error('missing ford tiles');
    const { road, mouth, box } = FORD_POOL;
    const bw = box.x1 - box.x0,
      bh = box.y1 - box.y0;
    // how far into the water each pixel is: under 1 is water; the edge wanders on slow noise,
    // drawn out east-west along the road
    const reach = (x: number, y: number): number => {
      const w = 1 + vnoise(x * 0.6, y, 61, 9) * 0.1 + vnoise(x, y, 63, 4) * 0.035;
      const r = Math.hypot((x - road.cx) / road.rx, (y - road.cy) / road.ry);
      const m = Math.hypot((x - mouth.cx) / mouth.rx, (y - mouth.cy) / mouth.ry);
      return Math.min(r, m) / w;
    };
    const depth = new Float32Array(bw * bh);
    for (let y = 0; y < bh; y++)
      for (let x = 0; x < bw; x++) depth[y * bw + x] = reach(box.x0 + x, box.y0 + y);
    const wet = (x: number, y: number): boolean =>
      x >= box.x0 && y >= box.y0 && x < box.x1 && y < box.y1
        ? at(depth, (y - box.y0) * bw + x - box.x0) < 1
        : y < box.y0 && classes[y * PW + x] === CLASS.W;
    // the road surface under it: the drawn cobble where there is cobble, the plain tile where the
    // canal set drew its channel, worn to dirt in east-west ruts
    const surface = (x: number, y: number, i: number, j: number): number[] => {
      const t = ((y % T) * T + (x % T)) * 4;
      const rut =
        vnoise(x * 0.25, y, 69, 3) > 0.35 && Math.abs(y - road.cy) < 30 && reach(x, y) < 1;
      if (rut) {
        const k = dirtIndex(x, y);
        return [0, 1, 2].map((ch) => at(dirtTile.data, k + ch));
      }
      const moss = at(d, j + 1) > at(d, j) + 10 && at(d, j + 1) > at(d, j + 2) + 4;
      return classes[i] === CLASS.C && !moss
        ? [0, 1, 2].map((ch) => at(d, j + ch))
        : [0, 1, 2].map((ch) => at(cobble.data, t + ch));
    };
    const kerbFrom = (x: number, y: number): number => ((y * PW + x + 160) * 4) as number;
    for (let y = box.y0; y < box.y1; y++)
      for (let x = box.x0; x < box.x1; x++) {
        const i = y * PW + x,
          j = i * 4,
          r = at(depth, (y - box.y0) * bw + x - box.x0);
        const grass = classes[i] === CLASS.G;
        const oldWater = classes[i] === CLASS.W;
        const t = ((y % T) * T + (x % T)) * 4;
        if (r < 1) {
          const ground = surface(x, y, i, j);
          // deep at the canal mouth, shallow over the road: the stones darkened and blued
          const deep = y < 478 + vnoise(x, y, 71, 5) * 4 && r < 0.85;
          const a = deep ? 1 : r < 0.55 ? 0.62 : 0.45;
          const c = [0, 1, 2].map(
            (ch) => at(water.data, t + ch) * a + at(ground, ch) * 0.82 * (1 - a),
          );
          // the upper-left catch: the first wet pixel below or right of dry ground
          const catchLight =
            !deep && (!wet(x - 1, y) || !wet(x, y - 1)) && vnoise(x, y, 79, 3) > -0.1;
          // glints at two scales: single pixels, and short east-west streaks
          const glint = !deep && hash2(x, y, 73) > 0.993;
          const streak =
            !deep && y % 4 === 0 && vnoise(x * 0.5, y, 75, 3) > 0.55 && hash2(x >> 2, y, 77) > 0.5;
          const out = catchLight ? [150, 170, 172] : glint || streak ? [176, 196, 196] : c;
          for (let ch = 0; ch < 3; ch++) d[j + ch] = at(out, ch);
          d[j + 3] = 255;
          classes[i] = CLASS.W;
          continue;
        }
        // the dry side: the canal's kerb moss runs on and turns down round the mouth (its end cap);
        // a 1-2 px wet band hugs the water; the old channel becomes road
        const nearWater = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [2, 0],
          [-2, 0],
          [0, 2],
          [0, -2],
        ].some(([dx, dy]) => wet(x + (dx ?? 0), y + (dy ?? 0)));
        const kerbRow = y < box.y0 + 3;
        if (kerbRow && !grass) {
          const k = kerbFrom(x, y);
          for (let ch = 0; ch < 3; ch++) d[j + ch] = at(d, k + ch);
          classes[i] = CLASS.C;
          continue;
        }
        if (nearWater && y < mouth.cy + mouth.ry + 4 && !grass) {
          // the cap: moss down the mouth's edge, as the kerb's own line
          const k = kerbFrom(x, box.y0 + 1);
          for (let ch = 0; ch < 3; ch++) d[j + ch] = at(d, k + ch);
          classes[i] = CLASS.C;
          continue;
        }
        // the old channel's mossy kerb line goes too: the road runs on to the water
        const moss = at(d, j + 1) > at(d, j) + 10 && at(d, j + 1) > at(d, j + 2) + 4;
        if (!oldWater && !nearWater && !(moss && !grass) && r > 1.25) continue;
        const ground = grass ? [0, 1, 2].map((ch) => at(d, j + ch)) : surface(x, y, i, j);
        const damp = nearWater ? 0.72 : 1;
        for (let ch = 0; ch < 3; ch++) d[j + ch] = at(ground, ch) * damp;
        d[j + 3] = 255;
        if (!grass) classes[i] = CLASS.C;
      }
  }

  // 4. the void: deeper toward the world's edge, in hard steps
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      if (tileCorners(x, y).some((v) => v !== 'V')) continue;
      let dist = 9;
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++)
          if (inMass(x + dx, y + dy)) dist = Math.min(dist, Math.max(Math.abs(dx), Math.abs(dy)));
      const a = dist <= 1 ? 0 : dist === 2 ? 0.18 : dist === 3 ? 0.32 : 0.45;
      if (a) fill(g, x * T, y * T, T, T, [10, 7, 9], a);
    }

  // the clean ground, before any object is grounded: what a cast is measured against
  const clean: RgbaImage = { width: PW, height: PH, data: new Uint8ClampedArray(d) };

  // 5. the shadows and contact kits of every static object (flat dressing first: every shadow lands on it)
  for (const p of placed) if (isFlat(p)) draw(g, p.img, p.x, p.y);
  const fringes = new Map<Placed, RgbaImage>();
  for (const p of placed) {
    const { o, img } = p;
    if (o.kind === 'walkway') {
      walkway(g, p, src);
      continue;
    }
    if (isFlat(p) || o.kind === 'steps') continue;
    if (o.kind === 'bridge') {
      // the seam and contact where the south abutment meets the bank, then the deck's own cast on the water
      const bm = hardShadowMask(alphaOf(img), img.width, img.height, { flat: true, band: 3 });
      paintMask(g, bm, p.x - bm.pad, p.y);
      paintMask(g, bridgeCast(p, classes), p.x, p.y);
      draw(g, img, p.x, p.y);
      continue;
    }
    const under = vt(Math.floor((p.x + p.w / 2) / T), Math.floor((p.base - 2) / T));
    const ow8 = Math.max(8, Math.round(img.width * 0.15)),
      bushy = o.sprite === 'bush';
    const opts: HardShadowOptions =
      o.kind === 'house'
        ? { overhang: ow8, band: 6 }
        : o.kind === 'tree' && !bushy
          ? {
              dir: { x: 0.42, y: 0.3 },
              foot: 8,
              sweep: 1,
              reach: Math.min(52, Math.max(12, Math.round(img.height * 0.32))),
            }
          : o.kind === 'prop'
            ? // a prop's whole silhouette laid down the light, one shape (the column cast of v12
              // left a stall's posts as separate streaks and a lamp or a pole with next to none)
              {
                overhang: ow8,
                dir: { x: 0.42, y: 0.3 },
                sweep: 1,
                reach: Math.min(24, Math.max(10, Math.round(img.height * 0.3))),
              }
            : { overhang: ow8 };
    const soft = under === 'G' || under === 'D';
    if (o.kind === 'house') {
      houseApron(g, p);
      houseDoorstep(g, p);
      houseSideShadow(g, p, soft ? 0.6 : 0.78);
    }
    const m = hardShadowMask(alphaOf(img), img.width, img.height, opts);
    if (o.kind === 'prop') coherentCast(m);
    shadows.push({ id: o.id, m, dx: p.x - m.pad, dy: p.y });
    if (soft) {
      const kit = groundKit(img, p.x * 7 + p.base, {
        tall: o.kind === 'tree' ? 7 : 5,
        density: o.kind === 'house' ? 0.6 : 1,
      });
      if (kit) {
        draw(g, kit.contact, p.x - kit.m, p.y - kit.m);
        fringes.set(p, kit.fringe);
      }
      paintByGround(g, m, p.x - m.pad, p.y, classes);
    } else {
      paintMask(g, m, p.x - m.pad, p.y, 1.3);
      floorReaction(g, m, p.x - m.pad, p.y, p.x * 31 + p.base);
    }
    if (o.kind === 'house') {
      const f = fringes.get(p) ?? blank(p.w + 2 * M, p.h + 2 * M);
      fringes.set(p, f);
      houseSkirt(f, p);
    }
  }

  // the uprights: each standing object with its fringe over its foot, trimmed
  const cover = new Uint8Array(PW * PH);
  const uprights: Upright[] = [];
  for (const p of placed) {
    const a = alphaOf(p.img);
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++) {
        const X = p.x + x,
          Y = p.y + y;
        if (at(a, y * p.w + x) && X >= 0 && Y >= 0 && X < PW && Y < PH) cover[Y * PW + X] = 1;
      }
    if (
      p.o.kind === 'flat' ||
      p.o.kind === 'bridge' ||
      p.o.kind === 'walkway' ||
      p.o.kind === 'steps'
    )
      continue;
    const full = blank(p.w + 2 * M, p.h + 2 * M);
    draw(full, p.img, M, M);
    const f = fringes.get(p);
    if (f) draw(full, f, 0, 0);
    const t = trim(full);
    uprights.push({
      id: p.o.id,
      image: t.image,
      x: p.x + ORIGIN.x - M + t.x,
      y: p.y + ORIGIN.y - M + t.y,
    });
  }
  return { ground: g, clean, classes, cover, shadows, uprights, placed };
}

function trim(img: RgbaImage): { image: RgbaImage; x: number; y: number } {
  let x0 = img.width,
    y0 = img.height,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++)
      if (at(img.data, (y * img.width + x) * 4 + 3)) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  return { image: crop(img, x0, y0, x1 - x0 + 1, y1 - y0 + 1), x: x0, y: y0 };
}

/** The sprite's foundation: the columns its bottom six rows cover. */
function foundation(p: Placed): [number, number] {
  const A = alphaOf(p.img);
  let x0 = p.w,
    x1 = 0;
  for (let y = p.h - 6; y < p.h; y++)
    for (let x = 0; x < p.w; x++)
      if (at(A, y * p.w + x)) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
  return [x0, x1];
}

/** A packed-earth apron along a house's front, so no grass touches the footing (v15 `houseApron`). */
function houseApron(g: RgbaImage, o: Placed): void {
  const [x0, x1] = foundation(o);
  for (let x = x0 - 6; x <= x1 + 6; x++) {
    const wx = o.x + x,
      edge = x < x0 || x > x1,
      dd = (edge ? 6 : 12) + Math.round(vnoise(wx, o.base, 41, 3) * 2.2);
    for (let k = -1; k < dd; k++) {
      if (k < 0 && edge) continue;
      const t = vnoise(wx, o.base + k, 43, 2.5);
      if (k >= dd - 2 && (wx + k) & 1) continue;
      if (k < 1) fill(g, wx, o.base + k, 1, 1, SHADOW_RGB, 0.8);
      else
        fill(
          g,
          wx,
          o.base + k,
          1,
          1,
          hex(k < 2 ? DIRT[0] : k < dd - 2 ? (t > 0.15 ? DIRT[2] : DIRT[1]) : DIRT[1]),
        );
    }
  }
  for (let i = 0, n = Math.round((x1 - x0) / 9); i < n; i++) {
    const sx = o.x + x0 - 3 + Math.floor(hash2(i, o.base, 47) * (x1 - x0 + 6)),
      sy = o.base + 3 + (i % 4);
    fill(g, sx, sy, 2, 1, hex(STONE[1]));
    fill(g, sx, sy, 1, 1, hex(STONE[2]));
  }
}

/** Two flagstones from the art's step slab over the apron (v15 `houseDoorstep`). */
function houseDoorstep(g: RgbaImage, o: Placed): void {
  const cx = o.x + (o.w >> 1),
    w = o.o.sprite === 'house_merchant' ? 44 : 22,
    x0 = cx - (w >> 1),
    b = o.base;
  for (let r = 0; r < 2; r++) {
    const y = b + 2 + r * 6,
      xo = r ? 3 : 0,
      ww = w - 4 - r * 4;
    fill(g, x0 + xo + 2, y - 1, ww, 7, hex('#3e3d47'));
    fill(g, x0 + xo + 3, y, ww - 2, 4, hex('#85807f'));
    fill(g, x0 + xo + 3, y, ww - 2, 1, hex('#aea89c'));
    fill(g, x0 + xo + 3, y + 4, ww - 2, 1, hex('#5d5b63'));
  }
}

/** The straight-on wall's cast: a parallelogram right of the foundation and a strip under the apron (v15). */
function houseSideShadow(g: RgbaImage, o: Placed, alpha: number): void {
  const [x0, x1] = foundation(o);
  for (let k = 1; k <= 22; k++) {
    const wx = o.x + x1 + k,
      top = o.base - 30 + Math.floor(k * 0.6),
      bot = o.base + 9 + Math.floor(k * 0.4) + Math.round(vnoise(wx, o.base, 93, 3) * 0.8);
    fill(g, wx, top, 1, bot - top, SHADOW_RGB, alpha);
  }
  for (let x = x0 + 8; x <= x1 + 22; x++) {
    const wx = o.x + x;
    fill(
      g,
      wx,
      o.base + 9 + (x > x1 ? Math.floor((x - x1) * 0.3) : 0),
      1,
      5 + Math.round(vnoise(wx, o.base, 95, 3) * 0.7),
      SHADOW_RGB,
      alpha,
    );
  }
}

/** Worn earth, tufts and stones lying over a house's plinth foot, into its fringe (v12 `houseSkirt`). */
function houseSkirt(f: RgbaImage, o: Placed): void {
  const b = o.base - o.y;
  let s = o.x * 31 + o.base * 7;
  const r = (): number => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296;
  const dot = (x: number, y: number, w: number, h: number, c: string): void =>
    fill(f, x + M, y + M, w, h, hex(c));
  const x0 = -6,
    x1 = o.w + 6;
  for (let x = x0 + 2; x < x1 - 4;) {
    const w = 4 + Math.floor(r() * 6),
      rows = [0.4, 0.75, 1, 0.8, 0.35];
    for (let i = 0; i < w; i++)
      rows.forEach((pr, k) => {
        if (r() < pr * (i === 0 || i === w - 1 ? 0.55 : 1))
          dot(x + i, b - 2 + k, 1, 1, k === 4 ? DIRT[0] : (i + k) % 3 ? DIRT[1] : DIRT[2]);
      });
    x += w + 3 + Math.floor(r() * 12);
  }
  for (let x = x0; x < x1;) {
    const edge = x < 2 || x > o.w - 3,
      roll = r() - (edge ? 0.25 : 0);
    if (roll < 0.22) {
      for (let k = 0; k < 3 + Math.floor(r() * 2); k++) {
        const lean = (r() - 0.5) * 1.6;
        dot(x + Math.round(lean * k * 0.5), b + 1 - k, 1, 1, k >= 2 ? GR[4] : k ? GR[3] : GR[1]);
      }
      dot(x + 1, b + 1, 1, 1, GR[2]);
      x += 2;
    } else if (roll < 0.42) {
      const w = 2 + Math.floor(r() * 3);
      dot(x, b - 1, w, 2, DIRT[2]);
      dot(x, b - 1, w, 1, DIRT[1]);
      dot(x + 1, b + 1, w, 1, DIRT[0]);
      x += w;
    } else if (roll < 0.56) {
      dot(x, b - 1, 2, 2, STONE[1]);
      dot(x, b - 1, 1, 1, STONE[2]);
      dot(x + 1, b, 1, 1, STONE[0]);
      x += 3;
    } else if (roll < 0.62) {
      dot(x, b, 3, 1, GR[1]);
      dot(x + 1, b - 1, 1, 1, GR[2]);
      x += 3;
    } else x += 1 + Math.floor(r() * 3);
  }
}

/**
 * `paintMask` for an object on soft ground whose cast runs on to the paving beside it: the pixels
 * on paving take the paving's stronger scale (1.3, as an object standing on paving does), so a
 * lamp at a lane's edge shows its cast on the cobbles as clearly as on the grass.
 */
function paintByGround(
  g: RgbaImage,
  m: ShadowMask,
  dx: number,
  dy: number,
  classes: Uint8Array,
): void {
  const d = g.data;
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++) {
      const X = dx + x,
        Y = dy + y,
        v = at(m.alpha, y * m.width + x);
      if (!v || X < 0 || Y < 0 || X >= g.width || Y >= g.height) continue;
      const a = (v * (classes[Y * g.width + X] === CLASS.C ? 1.3 : 1)) / 255,
        j = (Y * g.width + X) * 4;
      for (let c = 0; c < 3; c++) d[j + c] = at(d, j + c) * (1 - a) + at(SHADOW_RGB, c) * a;
    }
}

/**
 * Closes the gaps inside a cast so it reads as one shape: along each row, a run of at most `gap`
 * clear pixels between two shaded ones takes the cast tone, after the same down each column for
 * at most 3. A prop on legs (a stall, a notice board) projects each leg and its top separately.
 */
export function coherentCast(m: ShadowMask, gap = 10): void {
  const { width: W, height: H, alpha: A } = m;
  for (let x = 0; x < W; x++) {
    let last = -1;
    for (let y = 0; y < H; y++) {
      if (!at(A, y * W + x)) continue;
      if (last >= 0 && y - last > 1 && y - last - 1 <= 3)
        for (let k = last + 1; k < y; k++) A[k * W + x] = 125;
      last = y;
    }
  }
  for (let y = 0; y < H; y++) {
    let last = -1;
    for (let x = 0; x < W; x++) {
      if (!at(A, y * W + x)) continue;
      if (last >= 0 && x - last > 1 && x - last - 1 <= gap)
        for (let k = last + 1; k < x; k++) A[y * W + k] = 125;
      last = x;
    }
  }
}

/**
 * The bridge's cast: its own silhouette moved to the lower right (the light is top left), kept only
 * where it lands on open water, at the cast tone. One hard shape, no dither, so the deck reads as
 * standing over the channel, never as a flat plate on it. Drawn at the sprite's top-left.
 */
export function bridgeCast(p: Placed, classes: Uint8Array, off = { x: 6, y: 4 }): ShadowMask {
  const A = alphaOf(p.img),
    W = p.w + off.x,
    H = p.h + off.y,
    alpha = new Uint8ClampedArray(W * H);
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (!at(A, y * p.w + x)) continue;
      const sx = x + off.x,
        sy = y + off.y,
        wx = p.x + sx,
        wy = p.y + sy;
      if (
        wx < 0 ||
        wy < 0 ||
        wx >= PLATE_W ||
        wy >= PLATE_H ||
        classes[wy * PLATE_W + wx] !== CLASS.W
      )
        continue;
      if (sx < p.w && sy < p.h && at(A, sy * p.w + sx)) continue;
      alpha[sy * W + sx] = 125;
    }
  return { width: W, height: H, alpha, pad: 0, base: p.h - 1, reach: undefined, color: SHADOW };
}

/** The east road's cobbles run on over the lip to the walkway's deck, which goes out into the dark. */
function walkway(g: RgbaImage, o: Placed, src: Sources): void {
  const pureC = src.wang.gc.get('1111');
  if (!pureC) throw new Error('missing cobble');
  const x0 = rightV(16) * T - 10,
    x1 = o.x + 6,
    w = x1 - x0,
    y0 = o.y - 10;
  for (let yy = 0; yy < o.h + 20; yy++)
    for (let xx = 0; xx < w; xx++) {
      const wy = y0 + yy,
        top = o.y - 2 + Math.round(vnoise(x0 + xx, 0, 31, 5) * 4),
        bot = o.base + 2 + Math.round(vnoise(x0 + xx, 1, 33, 5) * 4);
      if (wy < top || wy > bot || (xx < 10 && vnoise(xx, wy, 35, 4) < -0.2)) continue;
      const j = (wy * g.width + x0 + xx) * 4,
        k = ((((wy % T) + T) % T) * T + ((x0 + xx) % T)) * 4;
      g.data[j] = at(pureC.data, k);
      g.data[j + 1] = at(pureC.data, k + 1);
      g.data[j + 2] = at(pureC.data, k + 2);
      g.data[j + 3] = 255;
    }
  // where the road meets the lip above and below the deck, its cobbles run on over the grass lip to a
  // ragged end, so the paving stops in the ground's own broken edge, not on the tile line
  for (let wy = o.y - 48; wy < o.base + 48; wy++) {
    const probe = (wy * g.width + x0 - 2) * 4;
    const isCobble =
      Math.abs(at(g.data, probe) - at(g.data, probe + 1)) < 22 &&
      at(g.data, probe + 1) <= at(g.data, probe) + 14;
    if (!isCobble) continue;
    const end = x0 + 14 + Math.round(vnoise(0, wy, 37, 3) * 6);
    for (let wx = x0; wx < end; wx++) {
      const j = (wy * g.width + wx) * 4;
      const r = at(g.data, j),
        gg = at(g.data, j + 1),
        b = at(g.data, j + 2);
      if (!(gg > r + 14 && gg > b + 8)) continue;
      const k = (((wy % T) + T) % T) * T * 4 + (wx % T) * 4;
      g.data[j] = at(pureC.data, k);
      g.data[j + 1] = at(pureC.data, k + 1);
      g.data[j + 2] = at(pureC.data, k + 2);
    }
  }
  fill(g, o.x + 6, o.base - 2, o.w - 6, 12, [8, 5, 6], 0.7);
  draw(g, o.img, o.x, o.y);
  for (let k = 0; k < 4; k++)
    fill(g, g.width - 44 + k * 11, o.y - 2, 11, o.h + 14, [24, 18, 20], 0.2 + k * 0.2);
}

/* ------------------------------------------------------------------ */
/* Packing                                                             */
/* ------------------------------------------------------------------ */

const asImage = (img: RgbaImage): Image => ({
  width: img.width,
  height: img.height,
  data: new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength),
});
const lossless = (image: RgbaImage): Promise<Uint8Array> => encodeWebpLossless(asImage(image), 6);

export async function packBaDanGround(baked = bake()): Promise<Map<string, Uint8Array | string>> {
  const files = new Map<string, Uint8Array | string>();
  files.set(`${OUT}/ground.webp`, await lossless(baked.ground));
  const items = [...baked.uprights]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((u) => ({ name: u.id, image: asImage(u.image) }));
  const { placed, height } = shelfPack(items, ATLAS_WIDTH, GUTTER);
  const atlas = composeAtlas(items, placed, ATLAS_WIDTH, height, GUTTER);
  files.set(`${OUT}/uprights.webp`, await encodeWebpLossless(atlas, 6));
  const rects = new Map(placed.map((p) => [p.name, p]));
  const uprights = [...baked.uprights]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((u) => {
      const r = rects.get(u.id);
      if (!r) throw new Error(`unplaced ${u.id}`);
      return {
        id: u.id,
        sourceRect: { x: r.x, y: r.y, width: r.width, height: r.height },
        x: u.x,
        y: u.y,
        width: r.width,
        height: r.height,
      };
    });
  files.set(SCENE, sceneJson(uprights, chimneys(baked), pavedCells(baked)));
  return files;
}

/**
 * Where smoke leaves each house's drawn chimney, in fractional cells (the prototype's
 * `findChimneys`): a narrow run of columns standing well above the roof line beside it, away from
 * the ridge in the middle.
 */
/**
 * The village's cells a figure stands on paving in, as the bake laid the ground: more than half the
 * pixels of the standing box (the cell's centre +-12 by +-8 px, where the feet blob lands) are
 * cobble. Their feet blob is drawn at paving's strength (`MapScene.pavedCells`).
 */
export function pavedCells(baked: Baked): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let cy = 0; cy < BA_DAN_VILLAGE.height; cy++)
    for (let cx = 0; cx < BA_DAN_VILLAGE.width; cx++) {
      const X = cx * 40 + 20 - ORIGIN.x,
        Y = cy * 40 + 20 - ORIGIN.y;
      let paved = 0,
        all = 0;
      for (let y = Y - 8; y <= Y + 8; y++)
        for (let x = X - 12; x <= X + 12; x++) {
          all++;
          if (baked.classes[y * PLATE_W + x] === CLASS.C) paved++;
        }
      if (paved * 2 > all) out.push({ x: cx, y: cy });
    }
  return out;
}

export function chimneys(baked: Baked): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const p of baked.placed) {
    if (p.o.kind !== 'house') continue;
    const A = alphaOf(p.img),
      W = p.w,
      H = p.h,
      top: number[] = new Array<number>(W).fill(H);
    for (let x = 0; x < W; x++)
      for (let y = 0; y < H; y++)
        if (at(A, y * W + x)) {
          top[x] = y;
          break;
        }
    // the plateau of columns 4 to 40 wide that stands furthest above the roof just outside it on both
    // sides, at least 6 px (the redrawn houses' chimneys are wider than the prototype's 16 px test
    // allowed, and the ridge's peak stands only a little above its slopes)
    let best: [number, number] | null = null,
      bestLift = 0;
    for (let x0 = 1; x0 < W - 1;) {
      let x1 = x0;
      while (x1 + 1 < W && Math.abs(at(top, x1 + 1) - at(top, x0)) <= 3) x1++;
      const w = x1 - x0 + 1,
        t = Math.min(...top.slice(x0, x1 + 1));
      const left = at(top, Math.max(0, x0 - 6)),
        right = at(top, Math.min(W - 1, x1 + 6));
      const lift = Math.min(left, right) - t;
      if (w >= 4 && w <= 40 && lift >= 6 && lift > bestLift) {
        best = [Math.round((x0 + x1) / 2), t];
        bestLift = lift;
      }
      x0 = x1 + 1;
    }
    if (best)
      out.push({
        x: +((p.x + best[0] + ORIGIN.x) / 40).toFixed(3),
        y: +((p.y + best[1] + ORIGIN.y) / 40).toFixed(3),
      });
  }
  return out;
}

interface UprightData {
  id: string;
  sourceRect: { x: number; y: number; width: number; height: number };
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Ba Dan's top-down scene (ADR 0104, T3) as the runtime reads it (`MapScene`): the baked plate
 * (terrain, rim, every static shadow and the flat dressing) and each standing piece, cut from the
 * upright atlas and laid out by the placed objects (`baDan.topdown.ts`), sorted by its base and
 * faded or revealing as its kind says. Every static shadow is in the plate, so no piece asks the
 * renderer for a runtime one, and the canal is painted.
 */
export function topdownScene(
  uprights: readonly UprightData[],
  smoke: readonly { x: number; y: number }[],
  paved: readonly { x: number; y: number }[],
): MapScene {
  const byId = new Map(uprights.map((u) => [u.id, u]));
  const scenery: SceneScenery[] = BA_DAN_TOPDOWN_LAYOUT.objects.flatMap((o) => {
    const art = byId.get(o.id);
    if (!art) return [];
    return [
      {
        id: `badan.td.${o.id}`,
        url: `${URL_ROOT}/uprights.webp`,
        sourceRect: art.sourceRect,
        x: art.x,
        y: art.y,
        width: art.width,
        height: art.height,
        footprint: o.footprint,
        depth: o.depth,
        ...(o.exterior && { exterior: true }),
        ...(o.fadeWhenOccluding && { fadeWhenOccluding: true }),
        ...(o.revealOccluded && { revealOccluded: true }),
        contactShadow: false,
        castShadow: false,
      },
    ];
  });
  return {
    paintedWater: true,
    paintExtent: { x: ORIGIN.x, y: ORIGIN.y, width: PLATE_W, height: PLATE_H },
    chimneys: smoke,
    // the trees' trunks, where their leaves drift from
    canopies: BA_DAN_TOPDOWN_LAYOUT.objects
      .filter((o) => o.kind === 'tree' && o.sprite !== 'bush')
      .map((o) => ({ x: o.depth.x, y: o.depth.y - 1 })),
    // The figures' feet blobs in the owner's shadow colour (ADR 0103's grounding); the union's
    // ceiling is paving's 205 of 255 (`pavedCells`), so soft ground's 170 lands as Imagination draws it.
    actorGrounding: { contact: 205 / 255, ink: { r: 0x32, g: 0x21, b: 0x25 } },
    pavedCells: paved,
    ground: [
      { url: `${URL_ROOT}/ground.webp`, x: ORIGIN.x, y: ORIGIN.y, width: PLATE_W, height: PLATE_H },
    ],
    scenery,
  };
}

function sceneJson(
  uprights: readonly UprightData[],
  smoke: readonly { x: number; y: number }[],
  paved: readonly { x: number; y: number }[],
): string {
  return `${JSON.stringify(topdownScene(uprights, smoke, paved))}\n`;
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const files = await packBaDanGround();
  let stale = 0;
  if (!check) mkdirSync(OUT, { recursive: true });
  for (const [path, content] of files) {
    const bytes = typeof content === 'string' ? Buffer.from(content) : Buffer.from(content);
    const same = existsSync(path) && Buffer.compare(readFileSync(path), bytes) === 0;
    if (same) continue;
    stale++;
    if (check) console.error(`stale: ${path}`);
    else writeFileSync(path, bytes);
  }
  const shipped = existsSync(OUT) ? readdirSync(OUT).map((f) => `${OUT}/${f}`) : [];
  const extra = shipped.filter((p) => !files.has(p));
  for (const p of extra) console.error(`not packed: ${p}`);
  const total = [...files]
    .filter(([p]) => p.startsWith(OUT))
    .reduce((sum, [, c]) => sum + (typeof c === 'string' ? Buffer.byteLength(c) : c.length), 0);
  console.log(
    `${files.size} files, ${total} bytes under ${OUT}${check ? `, ${stale} stale` : `, ${stale} written`}`,
  );
  if (check && (stale > 0 || extra.length > 0)) process.exit(1);
}

if (process.argv[1]?.endsWith('pack-ground.ts')) await main();
