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
import { ORIGIN } from '../../../src/content/scenes/baDan.topdown.terrain';

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

/**
 * The light earth of a baked mound or stump plate (v12's bush stood on a tan root plate): opaque,
 * warm (red over blue by more than 40, red over green) pixels lighter than {@link PLATE_LUM} in the
 * lowest third of a plant. The trees' lit bark stays under 125; the plate's tan runs 130 to 205.
 */
export const PLATE_LUM = 130;
export function moundPixels(img: RgbaImage): number {
  const W = img.width,
    H = img.height,
    p = img.data;
  let n = 0;
  for (let y = Math.floor((H * 2) / 3); y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (at(p, i + 3) < 128) continue;
      const r = at(p, i),
        g = at(p, i + 1),
        b = at(p, i + 2);
      if (r - b > 40 && r > g && lum(p, i / 4) > PLATE_LUM) n++;
    }
  return n;
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

/* ------------------------------------------------------------------ */
/* Seating                                                             */
/* ------------------------------------------------------------------ */

/** The board as the runtime draws it: the plate, then every upright by its depth key. */
export interface Composite {
  readonly image: RgbaImage;
  /** The index in `Baked.placed` of the upright drawn last over each pixel, or -1. */
  readonly owner: Int32Array;
}

export function composite(b: Baked): Composite {
  const { ground } = b,
    PW = ground.width,
    PH = ground.height,
    data = new Uint8ClampedArray(ground.data),
    owner = new Int32Array(PW * PH).fill(-1);
  const index = new Map(b.placed.map((p, i) => [p.o.id, i]));
  const order = [...b.uprights].sort((u, v) => {
    const a = b.placed[index.get(u.id) ?? 0]?.o.depth,
      c = b.placed[index.get(v.id) ?? 0]?.o.depth;
    return (a?.y ?? 0) - (c?.y ?? 0) || (a?.x ?? 0) - (c?.x ?? 0);
  });
  for (const u of order) {
    const k = index.get(u.id) ?? -1,
      ox = u.x - ORIGIN.x,
      oy = u.y - ORIGIN.y,
      { width: W, height: H, data: s } = u.image;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const a = at(s, (y * W + x) * 4 + 3);
        if (a < 128) continue;
        const X = ox + x,
          Y = oy + y;
        if (X < 0 || Y < 0 || X >= PW || Y >= PH) continue;
        const i = Y * PW + X;
        for (let ch = 0; ch < 3; ch++) data[i * 4 + ch] = at(s, (y * W + x) * 4 + ch);
        data[i * 4 + 3] = 255;
        owner[i] = k;
      }
  }
  return { image: { width: PW, height: PH, data }, owner };
}

const SHADOW_C = [0x32, 0x21, 0x25] as const;

/**
 * How far a pixel's colour has gone from the clean ground toward the shadow colour, as one blend
 * (0 the clean ground, 1 the shadow colour), and how far it sits off that blend. A shadow laid on
 * the ground fits with a small residue at any strength; a tuft, a clod or a stone does not, or
 * fits only weakly.
 */
export function shadowBlend(
  px: ArrayLike<number>,
  clean: ArrayLike<number>,
  i: number,
): { a: number; off: number } {
  let dot = 0,
    nn = 0;
  for (let c = 0; c < 3; c++) {
    const d = at(clean, i * 4 + c) - at(SHADOW_C, c);
    dot += (at(clean, i * 4 + c) - at(px, i * 4 + c)) * d;
    nn += d * d;
  }
  const a = nn > 0 ? dot / nn : 0;
  let off = 0;
  for (let c = 0; c < 3; c++) {
    const want = at(clean, i * 4 + c) + a * (at(SHADOW_C, c) - at(clean, i * 4 + c));
    off += (at(px, i * 4 + c) - want) ** 2;
  }
  return { a, off: Math.sqrt(off) };
}

/** The seam tier's blend (175 of 255) less slack: what the first pixel under a foot must reach. */
export const SEAM_BLEND = 0.45;
/** How far off the shadow blend a seam pixel may sit (the paving's grit, a shaded blade's hue). */
export const SEAM_OFF = 28;
/** A pixel at least this far toward the shadow colour is in shade, for the cast's connection. */
export const SHADE_BLEND = 0.2;
/**
 * A column is on the foot when its lowest opaque pixel is within this many rows of the sprite's
 * base (`hardShadowMask`'s default overhang): a root flare, a slanted plinth or a cart's wheels,
 * but not a banner's hem or a lantern hanging from its arm. A box drawn a little oblique whose
 * lower edge stands higher still (a stall's counter) is held by (c): its cast must join its contact.
 */
export const FOOT_ROWS = 8;

export interface SeatRow {
  readonly id: string;
  readonly kind: string;
  /** Foot columns measured (visible below). */
  readonly foot: number;
  /** (a) foot columns whose first pixel below is not shadow (ground, a tuft, a clod). */
  readonly gap: readonly number[];
  /** (b) foot columns whose contact is shadow but less than 25 % darker where the ground allows. */
  readonly weak: readonly number[];
  /** (c) visible, shaded cast pixels that no shaded path joins to the contact band. */
  readonly loose: number;
  /** Where the loose pixels are, as plate indices. */
  readonly looseAt: readonly number[];
  /** (d) clear rows between the sprite's lowest opaque row and its base line. */
  readonly hover: number;
}

/**
 * A pixel this close to the shadow colour (RGB distance), or darker than it, is as dark as the one
 * colour can go (the floor `art-lessons.md` records): shadow, whatever the ground.
 */
export const FLOOR_DIST = 24;
const nearShadow = (px: ArrayLike<number>, i: number): boolean =>
  lum(px, i) <= SHADOW_LUM ||
  Math.hypot(
    at(px, i * 4) - SHADOW_C[0],
    at(px, i * 4 + 1) - SHADOW_C[1],
    at(px, i * 4 + 2) - SHADOW_C[2],
  ) <= FLOOR_DIST;

/** What the seam tier at full strength (175 of 255) can darken ground of luminance `g` by. */
const seamReach = (g: number): number => (g > 0 ? (175 / 255) * (1 - SHADOW_LUM / g) : 0);

/**
 * Seating, measured over the plate and the uprights as the runtime composites them, for every
 * standing object and the bridge, column by column along its foot:
 *
 * - (a) **no gap**: the first pixel below each foot column's lowest opaque pixel is shadow tone,
 *   never ground, a tuft or a clod (the sprite's own darker outline is the sprite's);
 * - (b) **contact**: that pixel is at least 25 % darker than the clean ground, where the ground allows;
 * - (c) **cast**: every visible cast pixel is joined to the contact band through shade;
 * - (d) **no hover**: the sprite's lowest opaque row is at most 1 px above its base line.
 */
export function seatingTable(b: Baked, comp: Composite = composite(b)): SeatRow[] {
  const PW = b.ground.width,
    PH = b.ground.height,
    px = comp.image.data,
    clean = b.bare.data;
  const rows: SeatRow[] = [];
  b.placed.forEach((p, self) => {
    const { o, img } = p;
    if (o.kind === 'flat' || o.kind === 'walkway' || o.kind === 'steps') return;
    const W = img.width,
      H = img.height,
      opaque = (x: number, y: number): boolean => at(img.data, (y * W + x) * 4 + 3) >= 128;
    const low = new Int32Array(W).fill(-1);
    let bl = -1;
    for (let x = 0; x < W; x++)
      for (let y = H - 1; y >= 0; y--)
        if (opaque(x, y)) {
          low[x] = y;
          bl = Math.max(bl, y);
          break;
        }
    const gap: number[] = [],
      weak: number[] = [],
      starts: number[] = [];
    let foot = 0;
    for (let x = 0; x < W; x++) {
      const ly = at(low, x);
      if (ly < 0 || ly < bl - FOOT_ROWS) continue;
      const X = p.x + x,
        Y = p.y + ly + 1;
      if (X < 0 || Y < 0 || X >= PW || Y >= PH) continue;
      const i = Y * PW + X,
        who = at(comp.owner, i);
      if (who >= 0 && who !== self) {
        // hidden behind a piece in front: no gap is seen, and the shade may run on under it
        starts.push(i);
        continue;
      }
      foot++;
      const { a, off } = shadowBlend(px, clean, i);
      // the object's own fringe (a tuft, a clod) over its seam is held to the same tone as ground;
      // on ground already near the shadow colour (the cobble's dark stones) no blend can show, and a
      // pixel that is itself within `FLOOR_DIST` of the shadow colour is shadow
      const floor = nearShadow(px, i);
      if (!floor && (a < SEAM_BLEND || off > SEAM_OFF)) {
        gap.push(x);
        continue;
      }
      starts.push(i);
      const g = lum(clean, i),
        darker = g > 0 ? 1 - lum(px, i) / g : 0;
      if (!floor && darker < Math.min(CONTRAST, seamReach(g))) weak.push(x);
    }
    // (c): flood the shade from the contact band, then count the cast pixels it never reached
    const masks =
      o.kind === 'bridge'
        ? b.bridgeShadows.filter((r) => r.id === o.id)
        : b.shadows.filter((r) => r.id === o.id);
    let x0 = PW,
      y0 = PH,
      x1 = -1,
      y1 = -1;
    for (const { m, dx, dy } of masks) {
      x0 = Math.min(x0, dx - 1);
      y0 = Math.min(y0, dy - 1);
      x1 = Math.max(x1, dx + m.width);
      y1 = Math.max(y1, dy + m.height);
    }
    x0 = Math.max(0, x0);
    y0 = Math.max(0, y0);
    x1 = Math.min(PW - 1, x1);
    y1 = Math.min(PH - 1, y1);
    const seen = new Uint8Array(PW * PH),
      stack = [...starts];
    const shade = (i: number): boolean => {
      const who = at(comp.owner, i);
      if (who >= 0 && who !== self) return true;
      const X = i % PW,
        Y = (i - X) / PW;
      if (X >= p.x && Y >= p.y && X < p.x + W && Y < p.y + H && opaque(X - p.x, Y - p.y))
        return true;
      return shadowBlend(px, clean, i).a >= SHADE_BLEND;
    };
    for (const i of starts) seen[i] = 1;
    while (stack.length) {
      const i = stack.pop() ?? 0,
        X = i % PW,
        Y = (i - X) / PW;
      for (const [ex, ey] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const X2 = X + ex,
          Y2 = Y + ey;
        if (X2 < x0 || Y2 < y0 || X2 > x1 || Y2 > y1) continue;
        const j = Y2 * PW + X2;
        if (seen[j] || !shade(j)) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    const looseAt: number[] = [];
    for (const { m, dx, dy } of masks)
      for (let y = 0; y < m.height; y++)
        for (let x = 0; x < m.width; x++) {
          if (!at(m.alpha, y * m.width + x)) continue;
          const X = dx + x,
            Y = dy + y;
          if (X < 0 || Y < 0 || X >= PW || Y >= PH) continue;
          const i = Y * PW + X;
          // a shaded cast pixel the flood never reached is a piece of cast cut off by lit ground;
          // a mask pixel that shows no shade (the floor's grit, a flat piece drawn over it) is not cast
          if (at(comp.owner, i) >= 0 || seen[i] || shadowBlend(px, clean, i).a < SHADE_BLEND)
            continue;
          looseAt.push(i);
        }
    rows.push({
      id: o.id,
      kind: o.kind,
      foot,
      gap,
      weak,
      loose: looseAt.length,
      looseAt,
      hover: bl < 0 ? H : H - 1 - bl,
    });
  });
  return rows;
}
