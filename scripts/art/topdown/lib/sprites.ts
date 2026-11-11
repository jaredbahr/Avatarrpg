/**
 * Sprite cleanup before a bake (ADR 0104 §3): every PixelLab object loses what it brought of its
 * own ground (a dark disc, a light mound, a pale backdrop trace on its outline) and stands on its
 * lowest opaque row, because the bake grounds every object itself.
 */
import type { RgbaImage } from '../../../../src/render/shadow/hardShadowMask';
import { at, crop, lum } from './raster';

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

/**
 * The sprite cut at its lowest opaque row, so it stands on its base line: a sprite with clear rows
 * under its foot (the banner pole once its baked disc is stripped) hovers that far above its shadow.
 */
export function standOnBase(img: RgbaImage): RgbaImage {
  let bottom = -1;
  for (let i = 3; i < img.data.length; i += 4)
    if (at(img.data, i)) bottom = Math.floor((i - 3) / 4 / img.width);
  return bottom < 0 || bottom === img.height - 1 ? img : crop(img, 0, 0, img.width, bottom + 1);
}

/**
 * A light earth mound baked under a plant (v12's bush stands on a tan root plate): in the lowest
 * third, the first row whose opaque span runs past the stem's by 2 px or more on both sides and 6 in
 * all, with at least a third of the pixels outside the stem below it light earth. Returns that row and the stem's span above it, or
 * null. The bake grounds every object itself, so a sprite must not bring its own patch of ground,
 * and a light one reads as lit soil between the trunk and its shadow.
 */
export function bakedMound(img: RgbaImage): { top: number; lo: number; hi: number } | null {
  const W = img.width,
    H = img.height,
    d = img.data;
  const op = (x: number, y: number): boolean => at(d, (y * W + x) * 4 + 3) >= 128;
  const earth = (x: number, y: number): boolean => {
    const i = (y * W + x) * 4,
      r = at(d, i),
      g = at(d, i + 1),
      b = at(d, i + 2);
    return r - b > 40 && r > g && 0.299 * r + 0.587 * g + 0.114 * b > 110;
  };
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
  for (let y = Math.max(1, Math.floor(H * 0.66)); y < H; y++) {
    const [l, r] = span(y),
      [la, ra] = span(y - 1);
    if (r < 0 || ra < 0 || l > la - 2 || r < ra + 2 || la - l + r - ra < 6) continue;
    let out = 0,
      light = 0;
    for (let yy = y; yy < H; yy++)
      for (let x = 0; x < W; x++)
        if ((x < la - 1 || x > ra + 1) && op(x, yy)) {
          out++;
          if (earth(x, yy)) light++;
        }
    if (out && light * 3 >= out) return { top: y, lo: la, hi: ra };
  }
  return null;
}

/** How many rows of trunk run on below a stripped mound's top: the trunk's own foot. */
export const MOUND_FOOT = 2;

/**
 * The sprite without its baked mound (`bakedMound`). The trunk's span is its narrowest opaque run in
 * the eight rows above the mound's top (the stem, not the root flare that spreads into the mound),
 * and the mound starts at the first row below it that spreads past the trunk; below that only those columns stay, for {@link MOUND_FOOT} rows, and every pixel of light earth
 * among them takes the trunk's darkest tone. Everything else of the mound goes: its outline and its
 * dark underside too, which the first strip kept inside the flare's columns and left a brown plate
 * under the bush (owner, 2026-11-07).
 */
export function stripMound(img: RgbaImage): RgbaImage {
  const mound = bakedMound(img);
  if (!mound) return img;
  const W = img.width,
    p = new Uint8ClampedArray(img.data);
  const span = (y: number): [number, number] => {
    let l = W,
      r = -1;
    for (let x = 0; x < W; x++)
      if (at(p, (y * W + x) * 4 + 3) >= 128) {
        l = Math.min(l, x);
        r = Math.max(r, x);
      }
    return [l, r];
  };
  // the trunk: the narrowest run in the eight rows above the mound's top
  let lo = mound.lo,
    hi = mound.hi,
    stem = mound.top - 1;
  for (let y = Math.max(0, mound.top - 8); y < mound.top; y++) {
    const [l, r] = span(y);
    if (r - l >= 1 && r - l < hi - lo) {
      lo = l;
      hi = r;
      stem = y;
    }
  }
  // the mound starts where the run first spreads past the trunk below it: its outline and the
  // flare into it are the mound's
  let top = mound.top;
  for (let y = stem + 1; y < mound.top; y++) {
    const [l, r] = span(y);
    if (l < lo - 1 || r > hi + 1) {
      top = y;
      break;
    }
  }
  let dark: [number, number, number] = [0, 0, 0],
    best = 1e9;
  for (let x = lo; x <= hi; x++) {
    const i = ((top - 1) * W + x) * 4;
    if (at(p, i + 3) < 128) continue;
    const l = lum(p, i);
    if (l < best) {
      best = l;
      dark = [at(p, i), at(p, i + 1), at(p, i + 2)];
    }
  }
  for (let y = top; y < img.height; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (at(p, i + 3) === 0) continue;
      if (x < lo || x > hi || y >= top + MOUND_FOOT) {
        p[i + 3] = 0;
        continue;
      }
      if (isEarth(p, i)) p.set(dark, i);
    }
  return { width: W, height: img.height, data: p };
}

/** Light earth: the tan of a baked mound or stump plate (warm, lit, red over blue by 40 or more). */
export function isEarth(d: ArrayLike<number>, i: number): boolean {
  const r = at(d, i),
    g = at(d, i + 1),
    b = at(d, i + 2);
  return r - b > 40 && r > g && 0.299 * r + 0.587 * g + 0.114 * b > 110;
}

/** The sprite without its baked ground disc (`bakedDisc`). */
export function stripDisc(img: RgbaImage): RgbaImage {
  const p = new Uint8ClampedArray(img.data);
  for (const i of bakedDisc(img)) p[i * 4 + 3] = 0;
  return { width: img.width, height: img.height, data: p };
}

/** The whole cleanup, in the order every board applies it. */
export function cleanSprite(img: RgbaImage): RgbaImage {
  return standOnBase(dehalo(stripMound(stripDisc(img))));
}
