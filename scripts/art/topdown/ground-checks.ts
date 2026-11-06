/**
 * The measurable checks on a baked top-down ground (`docs/art-lessons.md`; ADR 0104 §3), ported from
 * the prototype's tutorial pass (`prototypes/topdown/src/b3/world_quarry.js` `shadowTableQ`,
 * `straightQ`, and `tools/t13halo.py`):
 *
 * - **Shadow contrast**: each object's visible shadow (mask pixels at alpha 120 or more that no
 *   sprite covers) against the clean ground 5-6 px beyond it (the plate before any object was
 *   grounded, so a house's dark apron does not pull the reference down). At least 25 % darker, where the ground
 *   allows it: the one shadow colour has a floor, and on dark ground `#322125` cannot reach 25 %.
 * - **Halo**: an upright's outline pixel (next to a clear pixel) in the lowest 35 % of the sprite
 *   that is light and near grey, the trace of a backdrop plate PixelLab baked under an object.
 * - **Straight edges**, measured as the eye sees them: terrain boundaries traced as chains of
 *   per-column (and per-row) crossings; the longest stretch of a chain that stays within 3 px is one
 *   straight edge. Boundaries under a sprite are not seen and not counted.
 */
import type { RgbaImage } from '../../../src/render/shadow/hardShadowMask';
import { CLASS, type Baked } from './pack-ground';

const at = (a: ArrayLike<number>, i: number): number => a[i] ?? 0;
const lum = (d: ArrayLike<number>, i: number): number =>
  0.299 * at(d, i * 4) + 0.587 * at(d, i * 4 + 1) + 0.114 * at(d, i * 4 + 2);

/** The darkest the shadow's cast tier (alpha 125 of 255) can make ground of luminance `g`. */
const SHADOW_LUM = 0.299 * 0x32 + 0.587 * 0x21 + 0.114 * 0x25;
export const CONTRAST = 0.25;
export function reachable(groundLum: number): number {
  return groundLum > 0 ? (125 / 255) * (1 - SHADOW_LUM / groundLum) : 0;
}

export interface ShadowRow {
  readonly id: string;
  readonly visible: number;
  readonly shadow: number;
  readonly ground: number;
  readonly darker: number;
  /** What this ground allows: 25 %, or less where even the cast tier at full strength cannot reach it. */
  readonly needed: number;
}

export function shadowTable(b: Baked): ShadowRow[] {
  const { ground: g, cover } = b;
  const PW = g.width,
    PH = g.height,
    d = g.data,
    c = b.clean.data;
  const shad = new Uint8Array(PW * PH);
  for (const { m, dx, dy } of b.shadows)
    for (let y = 0; y < m.height; y++)
      for (let x = 0; x < m.width; x++)
        if (at(m.alpha, y * m.width + x) >= 120) {
          const X = dx + x,
            Y = dy + y;
          if (X >= 0 && Y >= 0 && X < PW && Y < PH) shad[Y * PW + X] = 1;
        }
  const rows: ShadowRow[] = [];
  for (const { id, m, dx, dy } of b.shadows) {
    let s = 0,
      n = 0,
      rs = 0,
      rn = 0;
    const mine: number[] = [];
    for (let y = 0; y < m.height; y++)
      for (let x = 0; x < m.width; x++)
        if (at(m.alpha, y * m.width + x) >= 120) {
          const X = dx + x,
            Y = dy + y;
          if (X < 0 || Y < 0 || X >= PW || Y >= PH) continue;
          const i = Y * PW + X;
          mine.push(i);
          if (!cover[i]) {
            s += lum(d, i);
            n++;
          }
        }
    for (const i of mine) {
      const X = i % PW,
        Y = Math.floor(i / PW);
      for (const [ex, ey] of [
        [6, 0],
        [-6, 0],
        [0, 6],
        [0, -6],
        [5, 5],
        [-5, 5],
      ] as const) {
        const X2 = X + ex,
          Y2 = Y + ey;
        if (X2 < 0 || Y2 < 0 || X2 >= PW || Y2 >= PH) continue;
        const j = Y2 * PW + X2;
        if (!cover[j] && !shad[j]) {
          rs += lum(c, j);
          rn++;
        }
      }
    }
    const sl = n ? s / n : 0,
      rl = rn ? rs / rn : 0;
    rows.push({
      id,
      visible: n,
      shadow: +sl.toFixed(1),
      ground: +rl.toFixed(1),
      darker: rl ? +(1 - sl / rl).toFixed(3) : 0,
      needed: +Math.min(CONTRAST, reachable(rl)).toFixed(3),
    });
  }
  return rows;
}

/** Light, near-grey outline pixels in the lowest 35 % of a sprite. */
export function haloPixels(img: RgbaImage): number {
  const W = img.width,
    H = img.height,
    p = img.data;
  const clear = (x: number, y: number): boolean =>
    x < 0 || y < 0 || x >= W || y >= H || at(p, (y * W + x) * 4 + 3) === 0;
  let n = 0;
  for (let y = Math.ceil(H * 0.65); y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (!at(p, i + 3)) continue;
      if (!(clear(x + 1, y) || clear(x - 1, y) || clear(x, y + 1) || clear(x, y - 1))) continue;
      const r = at(p, i),
        g = at(p, i + 1),
        b = at(p, i + 2);
      if (0.299 * r + 0.587 * g + 0.114 * b > 150 && Math.max(r, g, b) - Math.min(r, g, b) < 30)
        n++;
    }
  return n;
}

export interface StraightEdge {
  readonly px: number;
  readonly tiles: number;
  readonly at: readonly [number, number];
  readonly horizontal: boolean;
}

/**
 * The longest straight-looking terrain boundary in px, between classes in `classes` (pixels that
 * `hidden` marks are not seen, so no boundary there counts). `tile` scales the result to tiles.
 */
export function straightEdge(
  classes: Uint8Array,
  hidden: Uint8Array,
  PW: number,
  PH: number,
  tile = 32,
  counts: (a: number, b: number) => boolean = () => true,
): StraightEdge {
  let best: StraightEdge = { px: 0, tiles: 0, at: [0, 0], horizontal: true };
  const consider = (h: readonly number[], from: number, horiz: boolean): void => {
    for (let i = 0; i < h.length; i++) {
      let lo = at(h, i),
        hi = at(h, i),
        j = i;
      while (j + 1 < h.length && Math.max(hi, at(h, j + 1)) - Math.min(lo, at(h, j + 1)) <= 3) {
        j++;
        lo = Math.min(lo, at(h, j));
        hi = Math.max(hi, at(h, j));
      }
      if (j - i + 1 > best.px)
        best = {
          px: j - i + 1,
          tiles: +((j - i + 1) / tile).toFixed(2),
          at: horiz ? [from + i, at(h, i)] : [at(h, i), from + i],
          horizontal: horiz,
        };
    }
  };
  for (const horiz of [true, false]) {
    const A = horiz ? PW : PH,
      B = horiz ? PH : PW;
    const idx = (a: number, b: number): number => (horiz ? b * PW + a : a * PW + b);
    interface Chain {
      b: number;
      from: number;
      hist: number[];
      used: boolean;
    }
    let chains: Chain[] = [];
    for (let a = 0; a < A; a++) {
      const cross: number[] = [];
      for (let b = 1; b < B - 1; b++) {
        const i = idx(a, b),
          j = idx(a, b + 1);
        if (hidden[i] || hidden[j]) continue;
        const ci = at(classes, i),
          cj = at(classes, j);
        if (ci !== cj && counts(ci, cj)) cross.push(b);
      }
      const next: Chain[] = [];
      for (const b of cross) {
        const ch = chains.find((c) => !c.used && Math.abs(c.b - b) <= 2);
        if (ch) {
          ch.used = true;
          ch.b = b;
          ch.hist.push(b);
          next.push(ch);
        } else next.push({ b, from: a, hist: [b], used: true });
      }
      for (const c of chains) if (!c.used) consider(c.hist, c.from, horiz);
      for (const c of next) c.used = false;
      chains = next;
    }
    for (const c of chains) consider(c.hist, c.from, horiz);
  }
  return best;
}

/**
 * The longest straight edge between grass, cobble and dirt. The canal's water is left out on
 * purpose: it is a built stone channel, ruled straight between its kerbs as the owner approved it
 * (v12, v13), and its edges are kerb against water, not ground against ground.
 */
const SOFT: ReadonlySet<number> = new Set([CLASS.G, CLASS.C, CLASS.D]);
export const terrainEdge = (b: Baked): StraightEdge =>
  straightEdge(
    b.classes,
    b.cover,
    b.ground.width,
    b.ground.height,
    32,
    (x, y) => SOFT.has(x) && SOFT.has(y),
  );

/**
 * The longest straight edge of the rim: where dry ground meets the cliff face or the void. Water is
 * left out: the canal is a built channel and pours over the lip where the scene draws its fall.
 */
const DRY: ReadonlySet<number> = new Set([CLASS.G, CLASS.C, CLASS.D]);
const RIM: ReadonlySet<number> = new Set([CLASS.face, CLASS.void]);
export const rimEdge = (b: Baked): StraightEdge =>
  straightEdge(
    b.classes,
    b.cover,
    b.ground.width,
    b.ground.height,
    32,
    (x, y) => (DRY.has(x) && RIM.has(y)) || (DRY.has(y) && RIM.has(x)),
  );
