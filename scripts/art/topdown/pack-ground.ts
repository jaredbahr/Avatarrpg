/**
 * Ba Dan's top-down ground (ADR 0104 §3, phase T3): the prototype's ground bake
 * (`prototypes/topdown/src/v13/ground.js` `bakeGround`) re-implemented over RGBA buffers, run on the
 * game's layout (`src/content/topdownLayouts.ts`), and packed into lossless 1 px plates and an
 * upright atlas under `public/art/topdown/ba-dan/`, with the numbers the scene needs in
 * `src/content/scenes/baDan.topdown.art.ts`.
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
import { format, resolveConfig } from 'prettier';
import { shelfPack, composeAtlas } from '../lib/atlas';
import type { Image } from '../lib/image';
import { readPng } from '../lib/image';
import { encodeWebpLossless } from '../lib/webp';
import {
  alphaOf,
  floorReaction,
  groundKit,
  hardShadowMask,
  paintMask,
  type HardShadowOptions,
  type RgbaImage,
  type ShadowMask,
} from '../../../src/render/shadow/hardShadowMask';
import {
  CANAL,
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
import type { TopDownObject } from '../../../src/content/topdownLayout';
import { BA_DAN_TOPDOWN_LAYOUT } from '../../../src/content/topdownLayouts';
import cliffPatterns from './cliff-patterns.json' with { type: 'json' };

export const ASSETS = 'prototypes/topdown/assets';
export const OUT = 'public/art/topdown/ba-dan';
export const URL_ROOT = 'art/topdown/ba-dan';
export const DATA = 'src/content/scenes/baDan.topdown.art.ts';
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
    const dir = o.sprite.startsWith('house_') ? 'objects_bd13' : 'objects12';
    sprites.set(o.sprite, dehalo(load(`${ASSETS}/${dir}/${o.sprite}.png`)));
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

/* ------------------------------------------------------------------ */
/* The bake                                                            */
/* ------------------------------------------------------------------ */

/** A placed object in the prototype's plate px: its sprite's top-left, size and base. */
interface Placed {
  readonly o: TopDownObject;
  readonly img: RgbaImage;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly base: number;
}

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
      // grass, cobble and dirt meet per pixel (the prototype's G/C and G/D pairs, and here also
      // where the south lane's cobbles meet the river path's dirt)
      const soft = c.every((v) => v === 'G' || v === 'C' || v === 'D');
      if (soft && !c.every((v) => v === c[0])) {
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
        if (tile) draw(g, tile, x * T, y * T);
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
            j = (py * T + px) * 4,
            o = (wy * PW + wx) * 4;
          d[o] = at(s.data, j);
          d[o + 1] = at(s.data, j + 1);
          d[o + 2] = at(s.data, j + 2);
          d[o + 3] = 255;
          classes[wy * PW + wx] = paving ? (isDirt ? CLASS.D : CLASS.C) : CLASS.G;
        }
    }
  }

  // 1c. where a road or court reaches the rim, its paving runs on over the grass lip to a ragged end,
  // so it never stops on the tile line beside the lip (a straight edge the eye reads as a ruler)
  {
    const pureC = src.wang.gc.get('1111');
    if (!pureC) throw new Error('missing cobble');
    const paint = (x: number, y: number): void => {
      const i = y * PW + x,
        k = (((y % T) * T + (x % T)) * 4) as number;
      d[i * 4] = at(pureC.data, k);
      d[i * 4 + 1] = at(pureC.data, k + 1);
      d[i * 4 + 2] = at(pureC.data, k + 2);
      classes[i] = CLASS.C;
    };
    // along each side: (start, step) for a run from the last ground pixel out over the lip
    const runs: [number, number, number, number][] = [];
    for (let y = 0; y < PH; y++) {
      for (let x = 1; x < PW; x++)
        if (classes[y * PW + x - 1] === CLASS.G && classes[y * PW + x] === CLASS.C && x % T === 0)
          runs.push([x - 1, y, -1, 0]);
      for (let x = 0; x < PW - 1; x++)
        if (
          classes[y * PW + x] === CLASS.C &&
          classes[y * PW + x + 1] === CLASS.G &&
          (x + 1) % T === 0
        )
          runs.push([x + 1, y, 1, 0]);
    }
    for (const [x0, y, dx] of runs) {
      const tx = Math.floor(x0 / T),
        ty = Math.floor(y / T);
      if (!tileCorners(tx, ty).includes('V')) continue; // only over the rim's lip tile
      const reach = 10 + Math.round(vnoise(x0, y, 39, 3) * 6);
      for (let k = 0, x = x0; k < reach && classes[y * PW + x] === CLASS.G; k++, x += dx)
        paint(x, y);
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
          k = ((wy % T) * T + (wx % T)) * 4;
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
  const canalTop = CANAL.row * T - 18,
    canalBot = CANAL.row * T + 22;
  for (const p of placed) {
    const { o, img } = p;
    if (o.kind === 'walkway') {
      walkway(g, p, src);
      continue;
    }
    if (isFlat(p) || o.kind === 'steps') continue;
    if (o.kind === 'bridge') {
      const bm = hardShadowMask(alphaOf(img), img.width, img.height, {
        flat: true,
        band: 4,
        base: 34,
      });
      paintMask(g, bm, p.x - bm.pad, p.y);
      bridgeShadow(g, p, canalTop, canalBot);
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
          : { overhang: ow8 };
    const soft = under === 'G' || under === 'D';
    if (o.kind === 'house') {
      houseApron(g, p);
      houseDoorstep(g, p);
      houseSideShadow(g, p, soft ? 0.6 : 0.78);
    }
    const m = hardShadowMask(alphaOf(img), img.width, img.height, opts);
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
      paintMask(g, m, p.x - m.pad, p.y);
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

/** The bridge's own silhouette laid on the water to its lower right (v13 `bridgeShadow`). */
function bridgeShadow(g: RgbaImage, o: Placed, top: number, bot: number): void {
  const A = alphaOf(o.img),
    W = o.w,
    Hh = o.h,
    x0 = o.x - 2,
    y0 = top - 4,
    w = W + 26,
    h = bot - top + 12;
  const reg = crop(g, x0, y0, w, h),
    dd = reg.data,
    m = new Uint8Array(w * h);
  for (let y = 0; y < Hh; y++) {
    const wy = o.y + y;
    if (wy < top - 3 || wy > bot + 2) continue;
    const off = 8 + Math.round(vnoise(3, wy, 77, 2.5) * 1.4);
    for (let x = 0; x < W; x++) {
      if (!at(A, y * W + x)) continue;
      const sx = o.x + x + off - x0,
        sy = wy + 4 - y0;
      if (sx >= 0 && sy >= 0 && sx < w && sy < h) m[sy * w + sx] = 1;
    }
  }
  const water = (j: number): boolean =>
    at(dd, j + 2) > at(dd, j) + 18 && at(dd, j + 1) > at(dd, j) + 10;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x,
        j = i * 4;
      if (!m[i] || !water(j)) continue;
      const rim = !m[i + 1] || !m[i + w] || !m[i - w],
        core = m[i - 3] && m[i - 6];
      if (rim && (x + y) % 2) continue;
      const a = rim ? 0.32 : core ? 0.5 : 0.42;
      dd[j] = at(dd, j) * (1 - a) + 0x32 * a;
      dd[j + 1] = at(dd, j + 1) * (1 - a) + 0x21 * a;
      dd[j + 2] = at(dd, j + 2) * (1 - a) + 0x25 * a;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const X = x0 + x,
        Y = y0 + y;
      if (X < 0 || Y < 0 || X >= g.width || Y >= g.height) continue;
      const s = (y * w + x) * 4,
        t = (Y * g.width + X) * 4;
      for (let c = 0; c < 3; c++) g.data[t + c] = at(dd, s + c);
    }
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
  files.set(DATA, await dataModule(uprights, ATLAS_WIDTH, height));
  return files;
}

interface UprightData {
  id: string;
  sourceRect: { x: number; y: number; width: number; height: number };
  x: number;
  y: number;
  width: number;
  height: number;
}

async function dataModule(uprights: UprightData[], w: number, h: number): Promise<string> {
  const ground = {
    url: `${URL_ROOT}/ground.webp`,
    x: ORIGIN.x,
    y: ORIGIN.y,
    width: PLATE_W,
    height: PLATE_H,
  };
  const text = [
    '/**',
    ' * Generated by `scripts/art/topdown/pack-ground.ts`; do not edit by hand.',
    ' *',
    " * Ba Dan's top-down ground (ADR 0104, T3): the baked plate (terrain, rim, every static shadow and",
    ' * the flat dressing) and where each upright sits in its atlas and in top-down world px (40 a cell).',
    ' * The upright ids are the objects of `baDan.topdown.ts`.',
    ' */',
    "import type { SceneImage } from '../../core/types';",
    '',
    `export const BA_DAN_TOPDOWN_GROUND: readonly SceneImage[] = [${JSON.stringify(ground)}];`,
    '',
    `export const BA_DAN_TOPDOWN_UPRIGHT_ATLAS = ${JSON.stringify({ url: `${URL_ROOT}/uprights.webp`, width: w, height: h })} as const;`,
    '',
    '/** Each upright: its rect in the atlas and its top-left in world px. */',
    `export const BA_DAN_TOPDOWN_UPRIGHTS: Readonly<Record<string, { readonly sourceRect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }; readonly x: number; readonly y: number; readonly width: number; readonly height: number }>> = ${JSON.stringify(Object.fromEntries(uprights.map(({ id, ...rest }) => [id, rest])))};`,
    '',
    '/** The rectangle the plate covers, for the camera (`MapScene.paintExtent`). */',
    `export const BA_DAN_TOPDOWN_EXTENT = ${JSON.stringify({ x: ORIGIN.x, y: ORIGIN.y, width: PLATE_W, height: PLATE_H })} as const;`,
    '',
  ].join('\n');
  return format(text, { ...(await resolveConfig(DATA)), filepath: DATA });
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
