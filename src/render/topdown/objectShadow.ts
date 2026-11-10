/**
 * Runtime object shadows on top-down boards (ADR 0104 section 2, "things that change"; #459).
 *
 * A breakable prop is not in the baked ground, so its shadow cannot be either. Each prop image is run
 * through the owner's `hardShadowMask` once (the prototype's quarry options, `world_quarry.js`
 * `groundObjects`), the mask is cached in a bounded LRU keyed by the image, and every live prop's
 * mask is laid into one shadow layer on the world-pixel grid: the shadow colour at the mask's alpha,
 * the strongest of overlapping masks winning (ADR 0071: shadows never add up), so the layer drawn
 * source-over is exactly `paintMask` on the ground. Paving takes the prototype's stronger 1.3 scale.
 * The layer is rebuilt from the props in the view, so a prop that breaks or leaves takes its shadow
 * with it. Pure: typed arrays only; the backends turn the layer into a canvas or a texture.
 */
import {
  alphaOf,
  hardShadowMask,
  SHADOW_RGB,
  type RgbaImage,
  type ShadowMask,
} from '../shadow/hardShadowMask';
import { BoundedLru } from './lru';

/** Masks kept at once: one per distinct prop drawing, with room for the Earth Wall and rubble. */
export const OBJECT_SHADOW_CAP = 16;

/** The prototype's scale for a shadow laid on paving or hard ground (`paintMask(..., 1.3)`). */
export const PAVED_SHADOW_SCALE = 1.3;

/**
 * The shadow for one object drawing: `world_quarry.js` `groundObjects`, a non-tree object (an
 * overhang of 15 % of its width, at least 8, and the long contact band on a tall one), with the two
 * steps Ba Dan's baked props take so the seating rule holds at a foot's outer columns.
 */
export function objectShadowMask(img: RgbaImage): ShadowMask {
  const overhang = Math.max(8, Math.round(img.width * 0.15));
  const mask = hardShadowMask(alphaOf(img), img.width, img.height, {
    overhang,
    ...(img.height > 50 ? { band: 6 } : {}),
  });
  // As Ba Dan's baked props (`pack-ground.ts`): a seam under every foot column, the cast one shape.
  seamUnderFoot(mask, img);
  coherentCast(mask);
  return mask;
}

const at = (a: ArrayLike<number>, i: number): number => a[i] ?? 0;

/**
 * The occlusion seam (175, then 150) under every column of a prop's foot, at that column's own
 * lowest pixel: a seat or a table top (overhang 0, standing on its legs' line) gets the seam under
 * its edge as well as under its feet, where `under` alone lays only the cast's tone.
 */
export function seamUnderFoot(m: ShadowMask, img: RgbaImage, rows = 8): void {
  const A = alphaOf(img),
    W = img.width,
    H = img.height,
    low = new Int32Array(W).fill(-1);
  let bl = -1;
  for (let x = 0; x < W; x++)
    for (let y = H - 1; y >= 0; y--)
      if (at(A, y * W + x)) {
        low[x] = y;
        bl = Math.max(bl, y);
        break;
      }
  for (let x = 0; x < W; x++) {
    const ly = at(low, x);
    if (ly < 0 || ly < bl - rows) continue;
    for (const [k, v] of [
      [1, 175],
      [2, 150],
    ] as const) {
      const y = ly + k;
      if (y >= m.height) continue;
      const i = y * m.width + x + m.pad;
      if (at(m.alpha, i) < v) m.alpha[i] = v;
    }
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

/** A bounded cache of masks by image key (its url); a miss reads the image's pixels once. */
export class ObjectShadowCache {
  private readonly masks: BoundedLru<string, ShadowMask>;

  constructor(cap = OBJECT_SHADOW_CAP) {
    this.masks = new BoundedLru(cap);
  }

  get size(): number {
    return this.masks.size;
  }

  /** The mask for `key`, computed from `pixels()` on a miss; null while the pixels are unavailable. */
  get(key: string, pixels: () => RgbaImage | null): ShadowMask | null {
    const hit = this.masks.get(key);
    if (hit) return hit;
    const img = pixels();
    if (!img || img.width <= 0 || img.height <= 0) return null;
    const mask = objectShadowMask(img);
    this.masks.set(key, mask);
    return mask;
  }

  clear(): void {
    this.masks.clear();
  }
}

/** One object to shadow: its drawing's top-left in world px, and its mask. */
export interface ShadowCaster {
  readonly x: number;
  readonly y: number;
  readonly mask: ShadowMask;
}

/** The shadow layer: straight-alpha RGBA in the shadow colour, its top-left at world px (x, y). */
export interface ShadowLayer {
  readonly x: number;
  readonly y: number;
  readonly image: RgbaImage;
}

/**
 * Every caster's mask in one layer: the shadow colour at `alpha * scale`, the strongest mask winning
 * where they overlap. `scaleAt(wx, wy)` gives the scale of the ground under a world pixel (1 on soft
 * ground, {@link PAVED_SHADOW_SCALE} on paving). Null when nothing casts.
 */
export function shadowLayer(
  casters: readonly ShadowCaster[],
  scaleAt: (wx: number, wy: number) => number = () => 1,
): ShadowLayer | null {
  if (casters.length === 0) return null;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const { x, y, mask } of casters) {
    x0 = Math.min(x0, x - mask.pad);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x - mask.pad + mask.width);
    y1 = Math.max(y1, y + mask.height);
  }
  const W = x1 - x0,
    H = y1 - y0;
  if (W <= 0 || H <= 0) return null;
  const alpha = new Float32Array(W * H);
  for (const { x, y, mask } of casters) {
    const ox = x - mask.pad - x0,
      oy = y - y0;
    for (let my = 0; my < mask.height; my++)
      for (let mx = 0; mx < mask.width; mx++) {
        const v = mask.alpha[my * mask.width + mx] ?? 0;
        if (!v) continue;
        const X = ox + mx,
          Y = oy + my,
          a = Math.min(255, v * scaleAt(x0 + X, y0 + Y)),
          i = Y * W + X;
        if (a > (alpha[i] ?? 0)) alpha[i] = a;
      }
  }
  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < alpha.length; i++) {
    const a = alpha[i] ?? 0;
    if (!a) continue;
    data[i * 4] = SHADOW_RGB[0];
    data[i * 4 + 1] = SHADOW_RGB[1];
    data[i * 4 + 2] = SHADOW_RGB[2];
    data[i * 4 + 3] = Math.round(a);
  }
  return { x: x0, y: y0, image: { width: W, height: H, data } };
}
