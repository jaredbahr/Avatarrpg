/**
 * Organic surfaces on the top-down board (ADR 0104 section 2, "Surfaces"; #458), the prototype's
 * `bakeSurfaces` (`prototypes/topdown/src/b3/surfvis.js`) rebuilt as a pure module over the rules'
 * grid. Each surface's cells become one organic shape (`organic.ts`), painted as a material in
 * opaque pixels:
 *
 * - **mud**: `mudPx`, ported as it is (its twinkling glints are left out);
 * - **oil**: an opaque brown-olive body above the quarry's pit tones, a one-pixel upper-left
 *   rim and a few still, low-contrast streaks (#598), rather than the prototype's near-black oil;
 * - **water** and **ice**: the prototype's were translucent, which `art-lessons.md` records as
 *   reading like a shadow, so both are repainted opaque: water dark at the rim with a pale catch
 *   on its upper-left inside and highlights at two scales; ice pale, opaque and cracked;
 * - **fire**: opaque ash and ember-speckled char (#590), a glow mask laid 'lighter' at 0.12–0.20, and flame sites on a
 *   jittered lattice for the PixelLab ground flames;
 * - **steam**: the narrow mask (`organicMask(..., 161, 0.42)`), as puff sites every 9 px.
 *
 * The masks and the painted layer are kept between frames and recomputed only when the surface
 * cells change, and then only over the dirty rectangle: the cells that changed, grown by the cell a
 * blob can reach. A fresh board recomputes everything once. Deterministic: seeded by cell and px.
 */
import type { Grid, SurfaceId, Vec2 } from '../../core/types';
import type { RgbaImage } from '../shadow/hardShadowMask';
import {
  CS,
  clipMask,
  groundOk,
  hash2,
  insideDist,
  metaMask,
  vnoise,
  type Board,
  type Region,
} from './organic';

/** The materials painted into the layer, in the prototype's order. */
export const MATERIALS = ['mud', 'water', 'oil', 'ice', 'fire'] as const;
export type Material = (typeof MATERIALS)[number];

/** `bakeSurfaces`: each material's seed, and its edge (water's is lower: it spreads). */
export const SEED: Readonly<Record<Material, number>> = {
  mud: 101,
  water: 103,
  oil: 105,
  ice: 107,
  fire: 109,
};
export const EDGE = (m: Material): number => (m === 'water' ? 0.3 : 0.5);

const at = (a: ArrayLike<number>, i: number): number => a[i] ?? 0;

/** A flame site: world px, phase, sheet and its cell. */
export interface FlameSite {
  readonly x: number;
  readonly y: number;
  readonly phase: number;
  readonly sheet: 'fire_ground_a' | 'fire_ground_b' | 'fire_ground_c';
  readonly cell: string;
}

/** A steam puff site: world px and phase (ms). */
export interface SteamSite {
  readonly x: number;
  readonly y: number;
  readonly phase: number;
}

/** What the surfaces draw: the painted layer, the fire's glow mask, the flame and puff sites. */
export interface SurfaceArt {
  readonly layer: RgbaImage;
  readonly glow: RgbaImage;
  readonly flames: readonly FlameSite[];
  readonly steam: readonly SteamSite[];
  /** Bumps whenever the layer's pixels change, for the backends' texture upload. */
  readonly version: number;
}

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */

type Put = (i: number, r: number, g: number, b: number, a: number) => void;

/** Ground (not patch) lies up-left of this pixel, `k` px away (`litEdge`). */
const litEdge = (m: Uint8Array, BW: number, x: number, y: number, k: number): boolean =>
  !at(m, (y - k) * BW + x - k) || (!at(m, (y - k) * BW + x) && !at(m, y * BW + x - k));

/** `mudPx`, as it is (its glint list dropped). */
function mudPx(
  m: Uint8Array,
  D: Uint8Array,
  BW: number,
  x: number,
  y: number,
  i: number,
  e: boolean,
  h: number,
  put: Put,
) {
  const d = at(D, i),
    lit = litEdge(m, BW, x, y, 3);
  if (e) return put(i, 38, 27, 24, 255);
  if (d <= 2) {
    put(i, 60, 42, 32, 255);
    if (d === 2 && lit && h < 0.3) put(i, 120, 88, 60, 255);
    return;
  }
  const n = vnoise(x, y, 143, 8) * 0.6 + vnoise(x, y, 147, 3) * 0.3 + (h - 0.5) * 0.18;
  const rut = Math.abs(vnoise(x + y * 0.35, y, 145, 15)) < 0.045,
    rutLit =
      Math.abs(vnoise(x + y * 0.35 - 1, y - 1, 145, 15)) >= 0.045 &&
      rut === false &&
      Math.abs(vnoise(x + y * 0.35 + 1, y + 1, 145, 15)) < 0.045;
  const pool = vnoise(x, y, 149, 5.5) > 0.62 && d > 4;
  if (pool) {
    const up = vnoise(x - 2, y - 2, 149, 5.5) <= 0.5;
    put(i, 74, 62, 58, 255);
    if (up && h < 0.55) put(i, 150, 112, 78, 255);
    else if (vnoise(x + 2, y + 2, 149, 5.5) <= 0.5) put(i, 52, 40, 36, 255);
    return;
  }
  if (rut) return put(i, 52, 36, 29, 255);
  if (rutLit && h < 0.45) return put(i, 112, 82, 56, 255);
  const [r, g, b] =
    n > 0.34 ? [128, 94, 64] : n > 0.14 ? [104, 76, 52] : n > -0.12 ? [86, 62, 44] : [70, 50, 38];
  put(i, r, g, b, 255);
}

/** Removing this boundary pixel preserves all four-connected foreground paths through its ring. */
function oilSimpleEdge(m: Uint8Array, BW: number, x: number, y: number): boolean {
  let ring = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if ((dx || dy) && at(m, (y + dy) * BW + x + dx)) ring |= 1 << ((dy + 1) * 3 + dx + 1);
  const sides = ring & 0b010101010;
  // Keep the last pixel and require existing four-connected background: no new hole.
  if (!sides || sides === 0b010101010) return false;
  let reached = sides & -sides;
  for (;;) {
    const next =
      reached |
      (ring &
        (((reached & ~0b001001001) >> 1) |
          ((reached & ~0b100100100) << 1) |
          (reached >> 3) |
          (reached << 3)));
    if (next === reached) return (reached & sides) === sides;
    reached = next;
  }
}

/**
 * Stagger the trim peaks, shifting their offset with the world-coordinate
 * noise so flat banks do not acquire evenly spaced teeth.
 */
function oilTrimPriority(x: number, y: number, phase: number): number {
  const across = Math.floor((x + y) / 9);
  const along = Math.floor((x - y) / 9);
  const jitter = Math.floor(4 * hash2(across, along, 197));
  const peakX = (x + phase + (jitter & 1)) % 2 === 0;
  const peakY = (y + phase + (jitter >> 1)) % 2 === 0;
  const shape = 0.65 * vnoise(x, y, 181, 11) + 0.35 * vnoise(x, y, 183, 4);
  return (peakX && peakY ? 1 : 0) + shape + 0.22 * hash2(x, y, 191 + phase);
}

/**
 * Three snapshot passes form shallow, irregular lobes inside the canonical oil.
 * Eight-neighbour priority peaks cannot invalidate one another's connection checks.
 * Their shrinking halos leave the exact six pixels read by shading within the
 * existing nine-pixel repaint apron.
 */
function oilPaintMask(canonical: Uint8Array, BW: number, BH: number, own: Region): Uint8Array {
  let previous = canonical;
  for (let phase = 0; phase < 3; phase++) {
    const region = grow(own, 8 - phase, BW, BH);
    const next = new Uint8Array(BW * BH);
    for (let y = region.y0; y < region.y1; y++)
      next.set(previous.subarray(y * BW + region.x0, y * BW + region.x1), y * BW + region.x0);
    for (let y = Math.max(1, region.y0); y < Math.min(BH - 1, region.y1); y++)
      for (let x = Math.max(1, region.x0); x < Math.min(BW - 1, region.x1); x++) {
        const i = y * BW + x;
        if (!previous[i]) continue;
        const priority = oilTrimPriority(x, y, phase);
        let highest = true;
        for (let dy = -1; dy <= 1 && highest; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const neighbour = oilTrimPriority(x + dx, y + dy, phase);
            if (neighbour > priority || (neighbour === priority && (dy < 0 || (!dy && dx < 0)))) {
              highest = false;
              break;
            }
          }
        if (highest && oilSimpleEdge(previous, BW, x, y)) next[i] = 0;
      }
    previous = next;
  }
  return previous;
}

/** Oil has a darker core, a thin still catch, and one lit pixel at its upper-left rim. */
function oilPx(
  m: Uint8Array,
  D: Uint8Array,
  BW: number,
  x: number,
  y: number,
  i: number,
  e: boolean,
  put: Put,
) {
  const d = at(D, i);
  if (e) {
    if (!at(m, i - 1) || !at(m, i - BW)) return put(i, 111, 102, 69, 255);
    return put(i, 57, 49, 30, 255);
  }
  if (
    d >= 5 &&
    vnoise(x, y, 155, 26) > 0 &&
    vnoise(x, y - 1, 155, 26) <= 0 &&
    vnoise(x, y, 159, 30) > 0
  ) {
    return put(i, 80, 73, 46, 255);
  }
  const w = vnoise(x, y, 141, 18);
  const [r, g, b] =
    d >= 5 ? (w > 0.25 ? [61, 55, 34] : [55, 49, 30]) : w > 0.25 ? [77, 69, 43] : [71, 64, 39];
  put(i, r, g, b, 255);
}

/**
 * Water, repainted opaque (the prototype's 190-alpha body read as a shadow): a dark rim, a pale
 * catch where the light from the upper left meets the inside of the bank, a body that deepens
 * inward, slow broad sheen and rare small glints (highlights at two scales).
 */
function waterPx(
  m: Uint8Array,
  D: Uint8Array,
  BW: number,
  x: number,
  y: number,
  i: number,
  e: boolean,
  h: number,
  put: Put,
) {
  const d = at(D, i);
  if (e) return put(i, 40, 62, 66, 255);
  if (d <= 3 && litEdge(m, BW, x, y, 3)) return put(i, 150, 190, 192, 255);
  if (d <= 2) return put(i, 50, 84, 90, 255);
  if (hash2(x, y, 213) > 0.992 && vnoise(x, y, 215, 6) > 0.1) return put(i, 210, 232, 230, 255);
  if (vnoise(x, y, 211, 16) > 0.5 && vnoise(x + 1, y - 1, 211, 16) <= 0.5)
    return put(i, 112, 160, 164, 255);
  const deep = d >= 6 ? 8 : 0;
  put(i, 58 + h * 12 - deep, 104 + h * 14 - deep, 112 + h * 10 - deep, 255);
}

/**
 * Ice, repainted opaque and pale: a cold rim, a near-white catch on the upper-left inside, a pale
 * body with a slow frost tone, and cracks (the prototype's `vnoise(x, y, 151, 6)` lines) drawn
 * darker than the body, so they read on pale ice.
 */
function icePx(
  m: Uint8Array,
  D: Uint8Array,
  BW: number,
  x: number,
  y: number,
  i: number,
  e: boolean,
  h: number,
  put: Put,
) {
  const d = at(D, i);
  if (e) return put(i, 120, 160, 178, 255);
  if (d <= 3 && litEdge(m, BW, x, y, 3)) return put(i, 242, 250, 252, 255);
  if (Math.abs(vnoise(x, y, 151, 6)) < 0.04) return put(i, 128, 168, 186, 255);
  const frost = vnoise(x, y, 153, 13) > 0.3 ? 10 : 0;
  put(i, 192 + h * 14 + frost, 222 + h * 10 + frost / 2, 234, 255);
}

/** Opaque ash covers the paving; the prototype's ember sites and colours remain. */
function firePx(x: number, y: number, i: number, e: boolean, h: number, put: Put) {
  const v = vnoise(x, y, 113, 4),
    ember = h < 0.035 && !e;
  if (ember) return put(i, 242, 140 + h * 1500, 60, 255);
  if (e) return put(i, 43, 39, 37, 255);
  if (v > 0.35) return put(i, 65, 57, 48, 255);
  put(i, 45 + v * 12, 43 + v * 9, 40 + v * 8, 255);
}

/* ------------------------------------------------------------------ */
/* Masks                                                               */
/* ------------------------------------------------------------------ */

/** Grows a region by `n` px, inside the board. */
function grow(r: Region, n: number, BW: number, BH: number): Region {
  return {
    x0: Math.max(0, r.x0 - n),
    y0: Math.max(0, r.y0 - n),
    x1: Math.min(BW, r.x1 + n),
    y1: Math.min(BH, r.y1 + n),
  };
}

/** The cells a set can reach, as one rectangle: their bounding box grown by a cell. */
function reachRect(board: Board, cells: Iterable<number>): Region | null {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const k of cells) {
    const x = k % board.w,
      y = Math.floor(k / board.w);
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  if (x1 < 0) return null;
  return {
    x0: Math.max(0, (x0 - 1) * CS),
    y0: Math.max(0, (y0 - 1) * CS),
    x1: Math.min(board.w * CS, (x1 + 2) * CS),
    y1: Math.min(board.h * CS, (y1 + 2) * CS),
  };
}

function intersect(a: Region, b: Region): Region | null {
  const r = {
    x0: Math.max(a.x0, b.x0),
    y0: Math.max(a.y0, b.y0),
    x1: Math.min(a.x1, b.x1),
    y1: Math.min(a.y1, b.y1),
  };
  return r.x1 > r.x0 && r.y1 > r.y0 ? r : null;
}

function union(a: Region | null, b: Region | null): Region | null {
  if (!a) return b;
  if (!b) return a;
  return {
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
  };
}

/**
 * The wide organic mask of `on` (`organicMask(isOn, seed, edge, 1, true)`) written into `out` over
 * `dirty` only, exactly as a whole-board computation would leave it there: the shape is computed 4
 * px further out than it is written, which is how far the two majority passes can carry a change.
 */
export function maskInto(
  out: Uint8Array,
  board: Board,
  on: ReadonlySet<number>,
  seed: number,
  edge: number,
  ground: Uint8Array,
  blocked: (x: number, y: number) => boolean,
  dirty: Region,
): void {
  const BW = board.w * CS,
    BH = board.h * CS;
  const work = grow(dirty, 4, BW, BH);
  const isOn = (x: number, y: number): boolean => on.has(y * board.w + x);
  const m = clipMask(metaMask(board, isOn, seed, edge, work), board, isOn, ground, blocked, work);
  for (let y = dirty.y0; y < dirty.y1; y++)
    out.set(m.subarray(y * BW + dirty.x0, y * BW + dirty.x1), y * BW + dirty.x0);
}

/**
 * The narrow mask (`organicMask(isOn, seed, edge)` without `wide`): the cells' smoothstep field
 * plus finer noise, cut at `edge`. Steam's puffs sit on it.
 */
export function narrowMask(
  board: Board,
  on: ReadonlySet<number>,
  seed: number,
  edge: number,
  amp = 1,
): Uint8Array {
  const BW = board.w * CS,
    BH = board.h * CS,
    m = new Uint8Array(BW * BH);
  const v = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= board.w || y >= board.h ? 0 : on.has(y * board.w + x) ? 1 : 0;
  const r = reachRect(board, on);
  if (!r) return m;
  for (let py = r.y0; py < r.y1; py++)
    for (let px = r.x0; px < r.x1; px++) {
      const fx = px / CS - 0.5,
        fy = py / CS - 0.5,
        ix = Math.floor(fx),
        iy = Math.floor(fy),
        sx = fx - ix,
        sy = fy - iy;
      const s0 = sx * sx * (3 - 2 * sx),
        s1 = sy * sy * (3 - 2 * sy);
      const a0 = v(ix, iy),
        a1 = v(ix + 1, iy),
        a2 = v(ix, iy + 1),
        a3 = v(ix + 1, iy + 1);
      if (!(a0 + a1 + a2 + a3)) continue;
      const f = a0 * (1 - s0) * (1 - s1) + a1 * s0 * (1 - s1) + a2 * (1 - s0) * s1 + a3 * s0 * s1;
      const n = (vnoise(px, py, seed, 9) * 0.16 + vnoise(px, py, seed + 1, 2.5) * 0.06) * amp;
      if (f + n > edge) m[py * BW + px] = 1;
    }
  return m;
}

/* ------------------------------------------------------------------ */
/* The board's surfaces, kept between frames                           */
/* ------------------------------------------------------------------ */

/** Which cells hold each surface (painted materials and steam), as cell indices. */
export function surfaceCells(grid: Grid): Map<SurfaceId, Set<number>> {
  const out = new Map<SurfaceId, Set<number>>();
  grid.tiles.forEach((tile, i) => {
    const id = tile.surface?.id;
    if (!id) return;
    let set = out.get(id);
    if (!set) out.set(id, (set = new Set()));
    set.add(i);
  });
  return out;
}

const sameSet = (a: ReadonlySet<number> | undefined, b: ReadonlySet<number> | undefined) =>
  (a?.size ?? 0) === (b?.size ?? 0) && [...(a ?? [])].every((k) => b?.has(k));

/** The cells in one set and not the other, both ways. */
function changed(a: ReadonlySet<number> | undefined, b: ReadonlySet<number> | undefined): number[] {
  const out: number[] = [];
  for (const k of a ?? []) if (!b?.has(k)) out.push(k);
  for (const k of b ?? []) if (!a?.has(k)) out.push(k);
  return out;
}

/**
 * The surfaces of one board, kept between frames. `update(grid)` recomputes only what changed:
 * per material, the masks over the dirty rectangle of its changed cells; the painted layer over the
 * union of those, grown by the 9 px the material painters read; the flame and steam sites when
 * fire or steam changed. The blocked and ground layout is the board's: a new board (another size,
 * another set of blocked cells) starts over.
 */
export class TopdownSurfaces {
  readonly board: Board;
  private readonly BW: number;
  private readonly BH: number;
  private readonly ground: Uint8Array;
  private readonly blocked: Uint8Array;
  private readonly masks = new Map<Material, Uint8Array>();
  private glowMask: Uint8Array;
  private coreMask: Uint8Array;
  private cells = new Map<SurfaceId, Set<number>>();
  private readonly layerData: Uint8ClampedArray;
  private readonly glowData: Uint8ClampedArray;
  private flameSites: FlameSite[] = [];
  private steamSites: SteamSite[] = [];
  private versionNo = 0;
  /** The px the last update recomputed (its dirty rectangle), for the tests and the timing budget. */
  lastDirty: Region | null = null;
  /** The layout key: the board's size and blocked/ground cells. */
  readonly layout: string;

  constructor(grid: Grid) {
    this.board = { w: grid.width, h: grid.height };
    this.BW = grid.width * CS;
    this.BH = grid.height * CS;
    this.ground = groundOk(grid);
    this.blocked = Uint8Array.from(grid.tiles, (t) => (t.blocked ? 1 : 0));
    this.layout = TopdownSurfaces.layoutKey(grid);
    for (const m of MATERIALS) this.masks.set(m, new Uint8Array(this.BW * this.BH));
    this.glowMask = new Uint8Array(this.BW * this.BH);
    this.coreMask = new Uint8Array(this.BW * this.BH);
    this.layerData = new Uint8ClampedArray(this.BW * this.BH * 4);
    this.glowData = new Uint8ClampedArray(this.BW * this.BH * 4);
  }

  /** What makes two grids the same board for the surfaces: size, blocked cells, elevation, pits. */
  static layoutKey(grid: Grid): string {
    return `${grid.width}x${grid.height}|${grid.tiles
      .map(
        (t) =>
          `${t.blocked ? 1 : 0}${t.elevation}${t.terrain === 'pit' || t.terrain === 'water_deep' ? 1 : 0}`,
      )
      .join('')}`;
  }

  get art(): SurfaceArt {
    return {
      layer: { width: this.BW, height: this.BH, data: this.layerData },
      glow: { width: this.BW, height: this.BH, data: this.glowData },
      flames: this.flameSites,
      steam: this.steamSites,
      version: this.versionNo,
    };
  }

  /** Brings the surfaces up to `grid`'s; returns whether anything changed. */
  update(grid: Grid): boolean {
    const next = surfaceCells(grid);
    const isBlocked = (x: number, y: number): boolean =>
      at(this.blocked, y * this.board.w + x) === 1;
    let dirty: Region | null = null;
    for (const m of MATERIALS) {
      const was = this.cells.get(m),
        now = next.get(m);
      if (sameSet(was, now)) continue;
      const rect = reachRect(this.board, changed(was, now));
      if (!rect) continue;
      const mask = this.masks.get(m) as Uint8Array;
      maskInto(mask, this.board, now ?? new Set(), SEED[m], EDGE(m), this.ground, isBlocked, rect);
      if (m === 'fire') {
        maskInto(
          this.glowMask,
          this.board,
          now ?? new Set(),
          109,
          0.38,
          this.ground,
          isBlocked,
          rect,
        );
        maskInto(
          this.coreMask,
          this.board,
          now ?? new Set(),
          109,
          0.62,
          this.ground,
          isBlocked,
          rect,
        );
      }
      dirty = union(dirty, rect);
    }
    const fireChanged = !sameSet(this.cells.get('fire'), next.get('fire'));
    const steamChanged = !sameSet(this.cells.get('steam'), next.get('steam'));
    this.cells = next;
    if (dirty) this.paint(grow(dirty, 9, this.BW, this.BH));
    if (fireChanged) this.siteFlames();
    if (steamChanged) this.siteSteam();
    this.lastDirty = dirty;
    if (dirty || steamChanged) this.versionNo++;
    return Boolean(dirty || steamChanged);
  }

  /** Repaints the layer and the glow over `r` from the current masks (`bakeSurfaces`'s loop). */
  private paint(r: Region): void {
    const { BW, BH } = this;
    const d = this.layerData;
    for (let y = r.y0; y < r.y1; y++) d.fill(0, (y * BW + r.x0) * 4, (y * BW + r.x1) * 4);
    const put: Put = (i, red, g, b, a) => {
      d[i * 4] = red;
      d[i * 4 + 1] = g;
      d[i * 4 + 2] = b;
      d[i * 4 + 3] = a;
    };
    for (const sid of MATERIALS) {
      // each material only where its cells reach, inside the region
      const reach = reachRect(this.board, this.cells.get(sid) ?? []);
      const own = reach && intersect(r, reach);
      if (!own) continue;
      const canonical = this.masks.get(sid) as Uint8Array;
      const m = sid === 'oil' ? oilPaintMask(canonical, BW, BH, own) : canonical;
      // the chamfer reads 8 px in, so it is measured 9 px past the region it paints
      const D =
        sid === 'oil'
          ? insideDist(m, BW, BH, 6, grow(own, 6, BW, BH))
          : insideDist(m, BW, BH, 8, grow(own, 9, BW, BH));
      for (let y = Math.max(1, own.y0); y < Math.min(BH - 1, own.y1); y++)
        for (let x = Math.max(1, own.x0); x < Math.min(BW - 1, own.x1); x++) {
          const i = y * BW + x;
          if (!m[i]) continue;
          const e = !m[i - 1] || !m[i + 1] || !m[i - BW] || !m[i + BW],
            h = hash2(x, y, 131);
          if (sid === 'water') waterPx(m, D, BW, x, y, i, e, h, put);
          else if (sid === 'mud') mudPx(m, D, BW, x, y, i, e, h, put);
          else if (sid === 'oil') oilPx(m, D, BW, x, y, i, e, put);
          else if (sid === 'ice') icePx(m, D, BW, x, y, i, e, h, put);
          else firePx(x, y, i, e, h, put);
        }
    }
    const g = this.glowData;
    for (let y = r.y0; y < r.y1; y++)
      for (let x = r.x0; x < r.x1; x++) {
        const i = y * BW + x;
        if (this.glowMask[i]) g.set([242, 120, 50, 255], i * 4);
        else g.fill(0, i * 4, i * 4 + 4);
      }
  }

  /**
   * The flame sites (`bakeSurfaces`): a jittered lattice 20 px across and 17 down, alternate rows
   * offset 10; a site is kept on the fire mask unless the slow "fierce" noise is low (seed 125,
   * scale 34), it falls in a hole (seed 127, scale 21) or its hash is under 0.12 (seed 128). Each is
   * one main flame (a tall `c` only deep inside and fierce) with up to two small licks beside it.
   */
  private siteFlames(): void {
    const { BW, BH } = this;
    const m = this.masks.get('fire') as Uint8Array,
      core = this.coreMask,
      out: FlameSite[] = [];
    const add = (x: number, y: number, sheet: FlameSite['sheet']) => {
      if (x < 0 || y < 0 || x >= BW || y >= BH || !m[y * BW + x]) return;
      out.push({
        x,
        y,
        phase: Math.floor(hash2(x, y, 117) * 997),
        sheet,
        cell: `${Math.floor(x / CS)},${Math.floor(y / CS)}`,
      });
    };
    for (let gy = 6; gy < BH; gy += 17)
      for (let gx = 6 + (Math.floor(gy / 17) % 2 ? 10 : 0); gx < BW; gx += 20) {
        const x = gx + Math.round((hash2(gx, gy, 118) - 0.5) * 16),
          y = gy + Math.round((hash2(gx, gy, 119) - 0.5) * 12);
        if (x < 0 || y < 0 || x >= BW || y >= BH || !m[y * BW + x]) continue;
        const fierce = vnoise(x, y, 125, 34),
          hole = vnoise(x, y, 127, 21);
        if (fierce < -0.35 || hole < -0.28 || hash2(x, y, 128) < 0.12) continue;
        const inner = core[y * BW + x],
          r = hash2(x, y, 120);
        add(
          x,
          y,
          r < 0.2 && inner && fierce > 0.05
            ? 'fire_ground_c'
            : r < 0.75
              ? 'fire_ground_a'
              : 'fire_ground_b',
        );
        const extra = Math.floor(hash2(x, y, 122) * 3);
        for (let e = 0; e < extra; e++)
          add(
            x + Math.round((hash2(x, y, 123 + e) - 0.5) * 22),
            y + Math.round((hash2(x, y, 126 + e) - 0.5) * 12),
            'fire_ground_b',
          );
      }
    this.flameSites = out;
  }

  /** Steam's puff sites: every 9 px on the narrow mask (seed 161, edge 0.42), each on its own phase. */
  private siteSteam(): void {
    const { BW, BH } = this;
    const on = this.cells.get('steam') ?? new Set<number>();
    const m = narrowMask(this.board, on, 161, 0.42);
    const out: SteamSite[] = [];
    for (let y = 0; y < BH; y += 9)
      for (let x = 0; x < BW; x += 9)
        if (m[y * BW + x]) out.push({ x, y, phase: Math.floor(hash2(x, y, 163) * 4000) });
    this.steamSites = out;
  }
}

/** The world px under a steam puff at `time` (ms): drifting up and right, swelling and fading. */
export function steamPuff(
  site: SteamSite,
  time: number,
): { x: number; y: number; r: number; alpha: number } {
  const t = ((time + site.phase) % 4000) / 4000;
  return {
    x: site.x + Math.round(t * 10),
    y: site.y - Math.round(t * 16),
    r: 6 + Math.round(Math.sin(t * Math.PI) * 4),
    alpha: Math.sin(t * Math.PI) * 0.34,
  };
}

/** The fire glow's strength at `time`: 0.12–0.20 (`drawSurfaces`); still, its middle. */
export function glowAlpha(time: number | null): number {
  if (time === null) return 0.16;
  return 0.12 + 0.05 * Math.sin(time / 90) + 0.03 * Math.sin(time / 37);
}

/** Which flame cel a site shows at `time` (85 ms a cel, its own phase); still, its phase's cel. */
export function flameCel(site: FlameSite, time: number | null, frames: number): number {
  const t = time ?? 0;
  return Math.floor((t + site.phase * 13) / 85) % frames;
}

export type { Vec2 };
