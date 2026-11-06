/**
 * The owner's hard grounding shadow, ported as pure functions.
 *
 * This is a verbatim port of `prototypes/topdown/src/v13/shadow.js`, which is
 * itself the owner's own Imagination grounding code (`hardShadowMask`,
 * `closeHoles`, `crownShadowMask`, `feetBlob`, `groundKit`). The maths, the
 * constants and the iteration order are the original's; do not "improve" them,
 * the art is tuned to this exact output (ADR 0104, section 2).
 *
 * One shadow colour, a hard edge, light from the upper left: an occlusion seam
 * where a base meets the floor, a contact band on the lower and right sides,
 * and a short cast to the lower right.
 *
 * Everything works on typed arrays. Nothing here touches a canvas, the DOM or
 * module state, and nothing is random: the two small generators in
 * `floorReaction` and `groundKit` are the original's seeded linear
 * congruential ones, ported exactly.
 *
 * Deviations from the original, all forced by purity:
 * - the original read `window.AREA.mode === 'home'` for its dusk scale; it is
 *   now the `dusk` option (and `floorReaction`/`groundKit` never used it);
 * - canvas drawing (`getImageData`, `putImageData`, `fillRect`) is replaced by
 *   arithmetic on RGBA buffers, see {@link RgbaImage};
 * - `feetBlob` no longer keeps a module-level cache.
 */

/** The one shadow colour, as the original wrote it. */
export const SHADOW = '#322125';
/** The shadow colour as red, green and blue bytes. */
export const SHADOW_RGB: readonly [number, number, number] = [0x32, 0x21, 0x25];

/** An RGBA image: four bytes per pixel, straight (not premultiplied) alpha. */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/**
 * A shadow as an alpha mask. `pad` is how far left of the object's own column
 * zero the mask starts (draw it at `x - pad`); `base` is the object's lowest
 * pixel row; `alpha` holds 0 (none), 175 (seam), 150 and 140 (contact band) or
 * 125 (cast).
 */
export interface ShadowMask {
  width: number;
  height: number;
  alpha: Uint8ClampedArray;
  pad: number;
  base: number;
  reach: number | undefined;
  color: string;
}

/** The options `hardShadowMask` understands; every one is optional. */
export interface HardShadowOptions {
  /** A towed thing seen from the front stands on its wheels: px above the image base where the drawbar starts. */
  hitch?: number | undefined;
  /** Height of the foot region in px (default a tenth of the image height, at least 6). */
  foot?: number;
  /** Contact band length in px, clamped 3 to 6. */
  band?: number;
  /** Longest cast in px, clamped 12 to 24 (scaled by the dusk factor). */
  reach?: number;
  /** Force the image's base row instead of finding the lowest opaque pixel. */
  base?: number;
  /** Sun direction: floor pixels moved per pixel of height (x > 0 falls right, y > 0 toward the viewer). */
  dir?: { x: number; y: number };
  /** With `dir`, 0 to 1: also shade the floor between a pixel's cast point and a point that much nearer the foot. */
  sweep?: number;
  /** How far above the run's lowest foot a column may stand on its own foot (default 8). */
  overhang?: number;
  /** Skip the fallback that casts columns with nothing near the floor from the image base. */
  groundedOnly?: boolean;
  /** Also shade the floor under an overhang, from a column's lowest pixel down to its foot (needs `dir`). */
  under?: boolean;
  /** Something lying on the floor: keep the seam and contact band, no cast. */
  flat?: boolean;
  /** The low dusk sun throws every cast about 1.7 times as far (the original read this from `window.AREA`). */
  dusk?: boolean;
}

/** The options `crownShadowMask` understands. */
export interface CrownShadowOptions {
  dir: { x: number; y: number };
  /** Rows above this one are the crown; rows from it down are the trunk. */
  crownBottom: number;
  /** The trunk's ground row. */
  ground: number;
  /** How far along `dir` the crown's top lands (default 48). */
  reach?: number;
  /** The crown's lowest edge lands this far along `dir`. */
  lead?: number;
  overhang?: number;
  dusk?: boolean;
}

/** Options for the seeded ground kit. */
export interface GroundKitOptions {
  /** Rows above the image bottom searched for each column's base. */
  zone?: number;
  /** Tuft height in px. */
  tall?: number;
  /** Tuft density, 1 is normal. */
  density?: number;
}

/** The ground kit: the layer under the object and the grass that grows over its bottom edge. */
export interface GroundKit {
  /** Occlusion band and soil stain, drawn under the object. */
  contact: RgbaImage;
  /** Tufts, pebbles and clods, drawn over the object's bottom edge. */
  fringe: RgbaImage;
  /** Margin in px: draw both images at `(x - m, y - m)`. */
  m: number;
}

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** Reads a typed array, treating a missing index as 0 (the original read `undefined`, which is falsy). */
const at = (a: ArrayLike<number>, i: number): number => a[i] ?? 0;

/** The original's `gput`: write a pixel into a mask, keeping the larger alpha, ignoring anything outside. */
function gput(
  mask: { width: number; height: number; alpha: Uint8ClampedArray },
  x: number,
  y: number,
  a: number,
): void {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return;
  const i = y * mask.width + x;
  if (a > at(mask.alpha, i)) mask.alpha[i] = a;
}

/**
 * Fills single-pixel holes in a mask with `v`: a hole between two set pixels
 * (left/right or up/down), or one with five or more set neighbours. Works in
 * place on the interior (the one-pixel border is never touched).
 */
export function closeHoles(A: Uint8ClampedArray, W2: number, H2: number, v: number): void {
  const set = (i: number): boolean => at(A, i) > 0;
  const fill: number[] = [];
  for (let y = 1; y < H2 - 1; y++)
    for (let x = 1; x < W2 - 1; x++) {
      const i = y * W2 + x;
      if (A[i]) continue;
      const l = set(i - 1),
        r = set(i + 1),
        u = set(i - W2),
        d = set(i + W2);
      if (
        (l && r) ||
        (u && d) ||
        [l, r, u, d, set(i - W2 - 1), set(i - W2 + 1), set(i + W2 - 1), set(i + W2 + 1)].filter(
          Boolean,
        ).length >= 5
      )
        fill.push(i);
    }
  for (const i of fill) A[i] = v;
}

/**
 * Builds the hard shadow of an object from its alpha mask (opaque pixels
 * non-zero, `width * height` bytes, row by row). Returns a larger mask holding
 * the occlusion seam (175 then 150) under every column that reaches the floor,
 * a contact band (140) on its right, and a squashed cast (125) to the lower
 * right. Without `dir` this is the original short lower-right run; with `dir`
 * the cast follows a sun direction.
 */
export function hardShadowMask(
  alpha: ArrayLike<number>,
  width: number,
  height: number,
  o: HardShadowOptions = {},
): ShadowMask {
  const DUSK_K = o.dusk ? 1.7 : 1;
  if (Number.isFinite(o.hitch) && (o.hitch as number) > 0) {
    let low = -1;
    for (let i = 0; i < alpha.length; i++) if (alpha[i]) low = Math.floor(i / width);
    const cut = low - Math.round(o.hitch as number);
    if (cut > 0) {
      const up = new Uint8ClampedArray(alpha.length);
      for (let i = 0; i < alpha.length; i++)
        up[i] = Math.floor(i / width) <= cut ? at(alpha, i) : 0;
      const m = hardShadowMask(up, width, height, { ...o, hitch: undefined, base: cut });
      const W = m.width,
        H = Math.max(m.height, height + 3),
        A = new Uint8ClampedArray(W * H);
      A.set(m.alpha);
      for (let y = cut + 1; y < height; y++)
        for (let x = 0; x < width; x++)
          if (alpha[y * width + x]) {
            const i = (y + 2) * W + m.pad + x + 2;
            if (!A[i]) A[i] = 125;
          }
      return { ...m, height: H, alpha: A, base: low };
    }
  }
  const foot = Math.max(6, Math.round(o.foot ?? height * 0.1));
  const band = clamp(Math.round(o.band ?? 3 + Math.min(3, height / 80)), 3, 6);
  const reach = clamp(Math.round(o.reach ?? height * 0.3 * DUSK_K), 12, Math.round(24 * DUSK_K));
  let base = Number.isFinite(o.base) ? clamp(Math.round(o.base as number), 0, height - 1) : -1;
  if (base < 0)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) if (alpha[y * width + x]) base = y;
  const dir = o.dir ? { x: +o.dir.x || 0, y: Math.max(0, +o.dir.y || 0) } : null;
  const sweep = dir && Number.isFinite(o.sweep) ? Math.max(0, Math.min(1, o.sweep as number)) : 0;
  const dirLen = dir ? Math.hypot(dir.x, dir.y) : 0;
  let hTop = base;
  if (dir)
    for (let y = 0; y <= base && hTop === base; y++)
      for (let x = 0; x < width; x++)
        if (alpha[y * width + x]) {
          hTop = y;
          break;
        }
  const hScale =
    dir && o.reach != null && dirLen > 0 && base - hTop > 0
      ? Math.min(1, o.reach / dirLen / (base - hTop))
      : 1;
  const hMax = dir ? Math.max(0, base - hTop) * hScale : 0;
  const padL = dir && dir.x < 0 ? Math.ceil(-dir.x * hMax) + 1 : 0,
    ext = dir ? Math.ceil(Math.abs(dir.x) * hMax) + 2 : 0,
    extY = dir ? Math.ceil(dir.y * hMax) + 4 : 0;
  const pad = band + padL,
    ow = width + pad + 24 + ext,
    oh = Math.max(height, base + 25 + extY);
  const out: ShadowMask = {
    width: ow,
    height: oh,
    alpha: new Uint8ClampedArray(ow * oh),
    pad,
    base,
    reach,
    color: SHADOW,
  };
  if (base < 0) return out;
  const footReach = Math.max(foot, Math.round(height * 0.16));
  const overhang = Number.isFinite(o.overhang) ? Math.max(0, o.overhang as number) : 8;
  const ownCast = Number.isFinite(o.overhang);
  const own = new Int32Array(width).fill(-1),
    colBase = new Int32Array(width).fill(-1),
    castFrom = new Int32Array(width).fill(-1),
    grounded = new Uint8Array(width);
  for (let x = 0; x < width; x++)
    for (let y = base; y >= Math.max(0, base - footReach); y--)
      if (alpha[y * width + x]) {
        own[x] = y;
        break;
      }
  for (let x = 0; x < width;) {
    if (at(own, x) < 0) {
      x++;
      continue;
    }
    let e = x,
      low = at(own, x);
    while (e + 1 < width && at(own, e + 1) >= 0) {
      e++;
      low = Math.max(low, at(own, e));
    }
    for (let i = x; i <= e; i++) {
      grounded[i] = 1;
      colBase[i] = low - at(own, i) <= overhang ? at(own, i) : low;
      castFrom[i] = ownCast ? at(colBase, i) : low;
    }
    x = e + 1;
  }
  if (!o.groundedOnly)
    for (let x = 0; x < width; x++)
      if (at(colBase, x) < 0)
        for (let y = base; y >= 0; y--)
          if (alpha[y * width + x]) {
            colBase[x] = castFrom[x] = base;
            break;
          }
  for (let x = 0; x < width; x++) {
    if (!grounded[x]) continue;
    const lb = at(colBase, x);
    gput(out, pad + x, lb + 1, 175);
    gput(out, pad + x, lb + 2, 150);
    for (let yy = 1; yy <= band; yy++) gput(out, pad + x + 1, lb + yy, 140);
  }
  if (dir) {
    for (let x = 0; x < width; x++) {
      if (at(colBase, x) < 0) continue;
      const lb = grounded[x] ? at(colBase, x) : base,
        snap = grounded[x] && lb >= base - 8 && lb < base;
      for (let y = 0; y < lb; y++) {
        if (!alpha[y * width + x]) continue;
        const f = snap ? lb + (base - lb) * Math.min(1, (lb - y) / footReach) : lb,
          H = (f - y) * hScale;
        for (let t = sweep > 0 ? -H * sweep : -0.5; t <= 0.5; t += 0.25 + (sweep > 0 ? 0.25 : 0)) {
          const Ht = Math.max(0, H + t);
          for (let xo = 0; xo <= 0.5; xo += 0.5)
            gput(out, pad + x + xo + dir.x * Ht, f + 1 + dir.y * Ht, 125);
        }
      }
    }
    if (sweep > 0)
      for (let y = Math.max(0, base - footReach); y <= base; y++) {
        let l = -1,
          r = -1;
        for (let x = 0; x < width; x++)
          if (alpha[y * width + x]) {
            if (l < 0) l = x;
            r = x;
          }
        for (let x = l + 1; x < r; x++) if (!alpha[y * width + x]) gput(out, pad + x, y, 125);
      }
    if (o.under && dir)
      for (let x = 0; x < width; x++) {
        if (!grounded[x] || at(own, x) < 0) continue;
        for (let y = at(own, x) + 1; y <= at(colBase, x); y++)
          if (!alpha[y * width + x]) gput(out, pad + x, y, 125);
      }
    const A = out.alpha,
      W2 = out.width,
      H2 = out.height,
      set = (i: number): boolean => at(A, i) > 0,
      fill: number[] = [];
    for (let y = 1; y < H2 - 1; y++)
      for (let x = 1; x < W2 - 1; x++) {
        const i = y * W2 + x;
        if (A[i]) continue;
        const l = set(i - 1),
          r = set(i + 1),
          u = set(i - W2),
          d = set(i + W2);
        if (
          (l && r) ||
          (u && d) ||
          [l, r, u, d, set(i - W2 - 1), set(i - W2 + 1), set(i + W2 - 1), set(i + W2 + 1)].filter(
            Boolean,
          ).length >= 5
        )
          fill.push(i);
      }
    for (const i of fill) A[i] = 125;
  } else if (!o.flat) {
    let top = base;
    for (let y = 0; y <= base && top === base; y++)
      for (let x = 0; x < width; x++)
        if (alpha[y * width + x]) {
          top = y;
          break;
        }
    const k = reach / Math.max(1, base - top),
      len = new Float32Array(width);
    for (let x = 0; x < width; x++) {
      const lb = at(colBase, x);
      if (lb < 0) continue;
      let n = 0;
      for (let y = 0; y <= lb; y++) if (alpha[y * width + x]) n++;
      len[x] = Math.min(reach, n * k);
    }
    for (let x = 0; x < width; x++) {
      const lb = at(colBase, x);
      if (lb < 0) continue;
      const a3 = at(len, Math.max(0, x - 1)),
        b3 = at(len, x),
        c3 = at(len, Math.min(width - 1, x + 1));
      const L = Math.max(Math.max(Math.min(a3, b3), Math.min(Math.max(a3, b3), c3)), b3 * 0.6);
      for (let h = 0; h <= L; h += 0.5)
        gput(out, pad + x + Math.round(h), at(castFrom, x) + 1 + Math.round(h * 0.35), 125);
    }
    if (ownCast)
      for (let pass = 0; pass < 2; pass++) closeHoles(out.alpha, out.width, out.height, 125);
  }
  const W2 = out.width,
    H2 = out.height,
    A = out.alpha,
    keep = A.slice();
  for (let y = 0; y < H2; y++)
    for (let x = 0; x < W2; x++) {
      if (!A[y * W2 + x]) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const xx = x + dx,
            yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W2 && yy < H2 && A[yy * W2 + xx]) n++;
        }
      if (n < 2) keep[y * W2 + x] = 0;
    }
  out.alpha = keep;
  return out;
}

/**
 * A big tree's shadow as one piece: the hard contact shadow of
 * `hardShadowMask` under everything that stands on the floor, plus the crown's
 * own silhouette laid on the floor toward the light's far side, squashed and
 * falling to the lower right. Rows above `crownBottom` are projected by their
 * height above the crown's bottom from the trunk's `ground` row.
 */
export function crownShadowMask(
  alpha: ArrayLike<number>,
  width: number,
  height: number,
  o: CrownShadowOptions,
): ShadowMask {
  const dir = { x: +o.dir.x || 0, y: Math.max(0, +o.dir.y || 0) },
    dirLen = Math.hypot(dir.x, dir.y) || 1;
  const cb = Math.round(o.crownBottom),
    ground = Math.round(o.ground);
  let top = cb;
  for (let y = 0; y < cb && top === cb; y++)
    for (let x = 0; x < width; x++)
      if (alpha[y * width + x]) {
        top = y;
        break;
      }
  const k = Math.min(1, (o.reach ?? 48) / dirLen / Math.max(1, cb - top)),
    lead = Math.max(0, o.lead || 0);
  const contact = hardShadowMask(alpha, width, height, {
    ...(o.overhang !== undefined ? { overhang: o.overhang } : {}),
    ...(o.dusk !== undefined ? { dusk: o.dusk } : {}),
    groundedOnly: true,
  });
  const ext = Math.ceil(dir.x * (k * (cb - top) + lead)) + 2,
    pad = contact.pad;
  const ow = contact.width + ext,
    oh = Math.max(contact.height, ground + Math.ceil(dir.y * (k * (cb - top) + lead)) + 4);
  const out: ShadowMask = {
    width: ow,
    height: oh,
    alpha: new Uint8ClampedArray(ow * oh),
    pad,
    base: contact.base,
    reach: o.reach,
    color: SHADOW,
  };
  for (let y = top; y < cb; y++)
    for (let x = 0; x < width; x++) {
      if (!alpha[y * width + x]) continue;
      const H = (cb - y) * k + lead;
      for (let t = -0.5; t <= 0.5; t += 0.25)
        for (let xo = 0; xo <= 0.5; xo += 0.5)
          gput(out, pad + x + xo + dir.x * (H + t), ground + 1 + dir.y * (H + t), 125);
    }
  for (let y = cb; y <= ground; y++)
    for (let x = 0; x < width; x++) {
      if (!alpha[y * width + x]) continue;
      const H = (ground - y) * k;
      for (let t = 0; t <= H + lead; t += 0.5)
        gput(out, pad + x + dir.x * t, ground + 1 + dir.y * t, 125);
    }
  closeHoles(out.alpha, ow, oh, 125);
  closeHoles(out.alpha, ow, oh, 125);
  const A = out.alpha,
    er = new Uint8ClampedArray(A.length);
  for (let y = 1; y < oh - 1; y++)
    for (let x = 1; x < ow - 1; x++) {
      let all = true;
      for (let dy = -1; dy <= 1 && all; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (!A[(y + dy) * ow + x + dx]) {
            all = false;
            break;
          }
      if (all) er[y * ow + x] = 125;
    }
  A.fill(0);
  let left = contact.width;
  for (let y = 0; y < contact.height; y++)
    for (let x = 0; x < left; x++)
      if (contact.alpha[y * contact.width + x]) {
        left = x;
        break;
      }
  for (let y = 1; y < oh - 1; y++)
    for (let x = Math.max(1, left + 1); x < ow - 1; x++)
      if (er[y * ow + x])
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) A[(y + dy) * ow + x + dx] = 125;
  for (let y = 0; y < contact.height; y++)
    for (let x = 0; x < contact.width; x++) {
      const v = at(contact.alpha, y * contact.width + x);
      if (v > at(A, y * ow + x)) A[y * ow + x] = v;
    }
  return out;
}

/**
 * The original's `alphaOf`: the alpha channel of an RGBA image, with anything
 * under 128 dropped to 0 (a hard edge). Feed the result to `hardShadowMask`.
 */
export function alphaOf(img: RgbaImage): Uint8ClampedArray {
  const out = new Uint8ClampedArray(img.width * img.height);
  for (let i = 0; i < out.length; i++) {
    const a = at(img.data, i * 4 + 3);
    out[i] = a >= 128 ? a : 0;
  }
  return out;
}

/** A rectangle of pixels copied out of an image; pixels outside the image read as transparent black. */
function getRegion(
  img: RgbaImage,
  dx: number,
  dy: number,
  w: number,
  h: number,
): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = dx + x,
        sy = dy + y;
      if (sx < 0 || sy < 0 || sx >= img.width || sy >= img.height) continue;
      const s = (sy * img.width + sx) * 4,
        j = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) d[j + c] = at(img.data, s + c);
    }
  return d;
}

/** Writes a region back; pixels falling outside the image are clipped. */
function putRegion(
  img: RgbaImage,
  d: Uint8ClampedArray,
  dx: number,
  dy: number,
  w: number,
  h: number,
): void {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = dx + x,
        sy = dy + y;
      if (sx < 0 || sy < 0 || sx >= img.width || sy >= img.height) continue;
      const s = (sy * img.width + sx) * 4,
        j = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) img.data[s + c] = at(d, j + c);
    }
}

/**
 * Lays a mask in the shadow colour onto an RGBA image at `(dx, dy)`, whole
 * pixels, hard edge. Each pixel's colour blends toward the shadow colour by
 * `alpha * scale / 255`: `c = c * (1 - a) + shadow * a`, rounded to nearest
 * (ties to even) by the clamped byte store, exactly as the original's
 * `ImageData` write did. The target's own alpha channel is left alone. The
 * mask may hang off the image; the overhang is clipped.
 */
export function paintMask(
  target: RgbaImage,
  m: ShadowMask,
  dx: number,
  dy: number,
  scale = 1,
): void {
  const d = getRegion(target, dx, dy, m.width, m.height);
  for (let i = 0; i < m.alpha.length; i++) {
    const a = (at(m.alpha, i) * scale) / 255;
    if (!a) continue;
    const j = i * 4;
    d[j] = at(d, j) * (1 - a) + SHADOW_RGB[0] * a;
    d[j + 1] = at(d, j + 1) * (1 - a) + SHADOW_RGB[1] * a;
    d[j + 2] = at(d, j + 2) * (1 - a) + SHADOW_RGB[2] * a;
  }
  putRegion(target, d, dx, dy, m.width, m.height);
}

/**
 * The floor reacting under a heavy base on paving: 3 to 6 px under the seam
 * row (alpha 175) the grout darkens toward the shadow colour, and a little
 * brown grit shows. Seeded and deterministic: the same `seed` gives the same
 * grit. Uses the original's linear congruential generator.
 */
export function floorReaction(
  target: RgbaImage,
  m: ShadowMask,
  dx: number,
  dy: number,
  seed: number,
): void {
  const d = getRegion(target, dx, dy, m.width, m.height);
  let s = seed;
  const r = (): number => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296;
  for (let x = 0; x < m.width; x++) {
    let lb = -1;
    for (let y = 0; y < m.height; y++)
      if (m.alpha[y * m.width + x] === 175) {
        lb = y;
        break;
      }
    if (lb < 0) continue;
    for (let k = 2; k <= 5; k++)
      for (const xx of [x - 2, x, x + 3]) {
        const py = lb + k;
        if (xx < 0 || py >= m.height || xx >= m.width) continue;
        const j = (py * m.width + xx) * 4,
          lum = (at(d, j) + at(d, j + 1) + at(d, j + 2)) / 3;
        if (lum < 92 && r() < 0.8) {
          const a = 0.32;
          d[j] = at(d, j) * (1 - a) + SHADOW_RGB[0] * a;
          d[j + 1] = at(d, j + 1) * (1 - a) + SHADOW_RGB[1] * a;
          d[j + 2] = at(d, j + 2) * (1 - a) + SHADOW_RGB[2] * a;
        } else if (r() < 0.05) {
          d[j] = 90;
          d[j + 1] = 61;
          d[j + 2] = 43;
        }
      }
  }
  putRegion(target, d, dx, dy, m.width, m.height);
}

/**
 * A figure's feet blob (Imagination `feetBlobMask`): an ellipse 65% of the
 * width it is given and a third as tall, in the shadow colour at `alpha`
 * (default 153), hard edge. Returns a straight-alpha RGBA image. The original
 * cached these in a module map; this does not.
 */
export function feetBlob(w: number, alpha = 153): RgbaImage {
  const width = Math.max(4, Math.round(Math.round(w) * 0.65)),
    height = Math.max(2, Math.round(width / 3));
  const data = new Uint8ClampedArray(width * height * 4);
  const rx = width / 2,
    ry = height / 2;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (((x + 0.5 - rx) / rx) ** 2 + ((y + 0.5 - ry) / ry) ** 2 <= 1) {
        const j = (y * width + x) * 4;
        data[j] = 0x32;
        data[j + 1] = 0x21;
        data[j + 2] = 0x25;
        data[j + 3] = alpha;
      }
  return { width, height, data };
}

const GR = ['#243d33', '#35593f', '#4f7d4a', '#7aa05a', '#a9c46f', '#c9d98a'] as const;
const DIRT = ['#3a2e2c', '#5a3d2b', '#7d5434'] as const;
const STONE = ['#5d5b63', '#85807f', '#aea89c'] as const;

/** An image held the way a canvas holds it: premultiplied 8-bit RGBA. */
interface Canvas8 {
  width: number;
  height: number;
  p: Uint8Array;
}

/** A fill colour: red, green, blue bytes and an alpha from 0 to 1. */
type Ink = readonly [number, number, number, number];

const hexInk = (hex: string): Ink => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
  1,
];

/**
 * Canvas `fillRect` with source-over, done arithmetically. The canvas stores
 * premultiplied bytes; the source alpha is first quantised to a byte, then
 * `out = src * sa + dst * (1 - sa)` is computed per premultiplied channel and
 * rounded. Measured against Chromium's canvas this matches a lone dot and a
 * dot over an opaque colour exactly; a translucent dot over another
 * translucent dot can differ by 1 in a channel (Skia's internal rounding).
 */
function fillRect(c: Canvas8, x: number, y: number, w: number, h: number, ink: Ink): void {
  const sa8 = Math.round(ink[3] * 255),
    sa = sa8 / 255;
  const sr = ink[0] * sa,
    sg = ink[1] * sa,
    sb = ink[2] * sa;
  for (let yy = Math.max(0, y); yy < Math.min(c.height, y + h); yy++)
    for (let xx = Math.max(0, x); xx < Math.min(c.width, x + w); xx++) {
      const j = (yy * c.width + xx) * 4;
      c.p[j] = Math.round(sr + at(c.p, j) * (1 - sa));
      c.p[j + 1] = Math.round(sg + at(c.p, j + 1) * (1 - sa));
      c.p[j + 2] = Math.round(sb + at(c.p, j + 2) * (1 - sa));
      c.p[j + 3] = Math.round(sa8 + at(c.p, j + 3) * (1 - sa));
    }
}

/** Reads a premultiplied canvas back as straight RGBA, as `getImageData` does. */
function toStraight(c: Canvas8): RgbaImage {
  const data = new Uint8ClampedArray(c.width * c.height * 4);
  for (let i = 0; i < c.width * c.height; i++) {
    const a = at(c.p, i * 4 + 3);
    if (!a) continue;
    for (let k = 0; k < 3; k++) data[i * 4 + k] = Math.round((at(c.p, i * 4 + k) * 255) / a);
    data[i * 4 + 3] = a;
  }
  return { width: c.width, height: c.height, data };
}

/**
 * The grass kit that sinks an object's base into the ground (Imagination
 * `ground.js` `groundKit`): an occlusion band hugging the base plus a soil
 * stain (`contact`, drawn under the object), and tufts, pebbles and clods that
 * grow up over the bottom edge (`fringe`, drawn over it). Fully seeded: the
 * same image and `seed` always give the same kit. Returns `null` when the
 * image has nothing opaque near its bottom. Colours are blended onto
 * transparent canvases as described at {@link fillRect}.
 */
export function groundKit(
  img: RgbaImage,
  seed: number,
  o: GroundKitOptions = {},
): GroundKit | null {
  const W = img.width,
    H = img.height,
    A = alphaOf(img),
    op = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < W && y < H && at(A, y * W + x) > 0,
    M = 10;
  let s = seed * 977 + W * 13 + H;
  const r = (): number => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296;
  const h2 = (x: number, y: number, k: number): number => {
    let t = (x * 374761393 + y * 668265263 + k * 2147483647) >>> 0;
    t = ((t ^ (t >>> 13)) * 1274126177) >>> 0;
    return (t & 0xffff) / 65536;
  };
  const zone = o.zone ?? Math.max(10, Math.min(40, H * 0.3)),
    base: number[] = new Array<number>(W).fill(-1);
  for (let x = 0; x < W; x++)
    for (let y = H - 1; y >= 0; y--)
      if (op(x, y)) {
        if (y >= H - 1 - zone) base[x] = y;
        break;
      }
  const cols = base.map((y, x) => (y >= 0 ? x : -1)).filter((x) => x >= 0);
  if (!cols.length) return null;
  const x0 = cols[0] ?? 0,
    x1 = cols[cols.length - 1] ?? 0;
  const mk = (): Canvas8 => ({
    width: W + 2 * M,
    height: H + 2 * M,
    p: new Uint8Array((W + 2 * M) * (H + 2 * M) * 4),
  });
  const cc = mk(),
    fc = mk();
  const dot = (g: Canvas8, x: number, y: number, ink: Ink): void =>
    fillRect(g, x + M, y + M, 1, 1, ink);
  for (let x = x0 - 3; x <= x1 + 3; x++) {
    const bx = Math.min(Math.max(x, x0), x1),
      by = at(base, bx) >= 0 ? at(base, bx) : H - 1,
      edge = x < x0 || x > x1;
    for (let k = -1; k <= 3; k++) {
      const a = edge ? (k <= 0 ? 0.32 : 0) : k <= 1 ? 0.6 : 0.32;
      if (a && (k < 2 || h2(x, k, seed) < 0.6)) dot(cc, x, by + k, [12, 36, 24, a]);
    }
    if (!edge && h2(x >> 1, 3, seed) < 0.35) dot(cc, x, by + 3, [90, 61, 43, 0.65]);
  }
  const tuft = (cx: number, by: number, h: number): void => {
    const n = 3 + Math.floor(r() * 3);
    for (let b = 0; b < n; b++) {
      const lean = (b - (n - 1) / 2) * 0.55 + (r() - 0.5) * 0.5,
        len = Math.max(3, Math.round(h * (0.6 + r() * 0.5)));
      for (let k = 0; k < len; k++) {
        const x = Math.round(cx + lean * k * 0.6),
          y = by + 2 - k;
        dot(fc, x, y, hexInk(k >= len - 2 ? GR[4] : k < 2 ? GR[1] : GR[3]));
        if (k < len - 2) dot(fc, x + 1, y, hexInk(GR[0]));
      }
    }
  };
  const density = o.density ?? 1;
  for (let x = x0 - 2; x <= x1 + 2;) {
    const bx = Math.min(Math.max(x, x0), x1),
      by = at(base, bx) >= 0 ? at(base, bx) : H - 1,
      roll = r();
    if (roll < 0.55 * density) tuft(x, by, o.tall ?? 6);
    else if (roll < 0.7) {
      const sz = r() < 0.5 ? 2 : 1;
      fillRect(fc, x + M, by + 1 + M, sz + 1, sz, hexInk(STONE[1]));
      dot(fc, x, by + 1, hexInk(STONE[2]));
    } else if (roll < 0.8) {
      fillRect(fc, x + M, by + 2 + M, 2, 1, hexInk(DIRT[1]));
      dot(fc, x + 2, by + 2, hexInk(DIRT[2]));
    } else if (roll < 0.86) {
      tuft(x, by, 5);
      dot(fc, x, by - 4, hexInk(r() < 0.5 ? '#c9473a' : '#f2d47a'));
    }
    x += 3 + Math.floor(r() * (6 / density));
  }
  return { contact: toStraight(cc), fringe: toStraight(fc), m: M };
}
