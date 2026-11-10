/**
 * The static grounding every board bakes (ADR 0103, ADR 0104 §3): the owner's `hardShadowMask`
 * (`src/render/shadow/`) per object, with the options its kind takes, the grass kit's contact on
 * soft ground, the floor reaction on paving, and the fringe seated in its shadow. A board's baker
 * calls {@link groundObject} for each standing object and draws its own special pieces (a house's
 * apron, a bridge) around it.
 */
import {
  alphaOf,
  floorReaction,
  groundKit,
  hardShadowMask,
  paintMask,
  type HardShadowOptions,
  type RgbaImage,
  type ShadowMask,
} from '../../../../src/render/shadow/hardShadowMask';
import { at, blank, draw, SHADOW_RGB, trim } from './raster';
import { CLASS, FRINGE_MARGIN as M, type Placed, type ShadowRecord, type Upright } from './board';

/**
 * Seats an object's fringe (the kit's tufts, pebbles and clods, a house's skirt) in its shadow: a
 * fringe pixel that lies on the ground below the sprite (under a column's lowest pixel, or beside
 * the sprite) takes the shadow the mask lays there, as the ground under it does, so no lit blade or
 * stone shows between a footing and its shadow. In the seam's two rows under a column only grass
 * blades stay, at the seam's strength; a stone or a clod there would read as a lit gap, so it goes.
 */
export function seatFringe(
  f: RgbaImage,
  p: Placed,
  m: ShadowMask,
  classes: Uint8Array,
  scale: number,
  plate: { readonly width: number; readonly height: number },
): void {
  const A = alphaOf(p.img),
    low = new Int32Array(p.w).fill(-1);
  for (let x = 0; x < p.w; x++)
    for (let y = p.h - 1; y >= 0; y--)
      if (at(A, y * p.w + x)) {
        low[x] = y;
        break;
      }
  const d = f.data;
  for (let fy = 0; fy < f.height; fy++)
    for (let fx = 0; fx < f.width; fx++) {
      const j = (fy * f.width + fx) * 4;
      if (!at(d, j + 3)) continue;
      const sx = fx - M,
        sy = fy - M,
        ly = sx >= 0 && sx < p.w ? at(low, sx) : -1;
      if (ly >= 0 && sy <= ly) continue;
      const mx = sx + m.pad,
        v =
          mx >= 0 && sy >= 0 && mx < m.width && sy < m.height ? at(m.alpha, sy * m.width + mx) : 0;
      if (!v) continue;
      const r = at(d, j),
        g = at(d, j + 1),
        b = at(d, j + 2);
      const seam = ly >= 0 && sy - ly <= 2;
      if (seam && !(g > r + 10 && g > b + 4)) {
        d[j + 3] = 0;
        continue;
      }
      const X = p.x + sx,
        Y = p.y + sy,
        paved =
          X >= 0 &&
          Y >= 0 &&
          X < plate.width &&
          Y < plate.height &&
          classes[Y * plate.width + X] === CLASS.C;
      // a blade in the seam takes the seam at paving's strength (a lit blade top shaded at soft
      // ground's 175 still read as an olive fleck), so it reads as grass growing out of the shadow
      const a = Math.min(1, (seam ? Math.max(v, 175) * 1.3 : v * (paved ? 1.3 : scale)) / 255);
      for (let c = 0; c < 3; c++) d[j + c] = at(d, j + c) * (1 - a) + at(SHADOW_RGB, c) * a;
    }
}

/**
 * The owner's `floorReaction` (grout darkening and a little brown grit under a heavy base on
 * paving), kept off the seam itself: the reaction reaches 2-5 rows under each column's seam and
 * three columns aside, so under a stepped foot its grit landed on a higher neighbour's seam, a lit
 * brown fleck between the footing and its shadow. The seam's pixels keep what they were.
 */
export function reactBesideSeam(
  g: RgbaImage,
  m: ShadowMask,
  dx: number,
  dy: number,
  seed: number,
): void {
  const keep: [number, number, number, number][] = [];
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++) {
      const X = dx + x,
        Y = dy + y;
      if (at(m.alpha, y * m.width + x) < 150 || X < 0 || Y < 0 || X >= g.width || Y >= g.height)
        continue;
      const j = (Y * g.width + X) * 4;
      keep.push([j, at(g.data, j), at(g.data, j + 1), at(g.data, j + 2)]);
    }
  floorReaction(g, m, dx, dy, seed);
  for (const [j, r, gg, b] of keep) {
    g.data[j] = r;
    g.data[j + 1] = gg;
    g.data[j + 2] = b;
  }
}

/**
 * `paintMask` for an object on soft ground whose cast runs on to the paving beside it: the pixels
 * on paving take the paving's stronger scale (1.3, as an object standing on paving does), so a
 * lamp at a lane's edge shows its cast on the cobbles as clearly as on the grass.
 */
export function paintByGround(
  g: RgbaImage,
  m: ShadowMask,
  dx: number,
  dy: number,
  classes: Uint8Array,
  softScale = 1,
): void {
  const d = g.data;
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++) {
      const X = dx + x,
        Y = dy + y,
        v = at(m.alpha, y * m.width + x);
      if (!v || X < 0 || Y < 0 || X >= g.width || Y >= g.height) continue;
      const a = (v * (classes[Y * g.width + X] === CLASS.C ? 1.3 : softScale)) / 255,
        j = (Y * g.width + X) * 4;
      for (let c = 0; c < 3; c++) d[j + c] = at(d, j + c) * (1 - a) + at(SHADOW_RGB, c) * a;
    }
}

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

/**
 * The shadow options a standing object's kind takes (Ba Dan's, T3): a house's wide overhang and
 * band; a tree's sun-swept joined shadow; a prop's whole silhouette laid down the light, one shape
 * (the column cast of v12 left a stall's posts as separate streaks and a lamp or a pole with next
 * to none), with `under` shading the floor beneath a raised edge (a bench's seat, a table's top)
 * down to its legs' feet, so no lit ground shows between the edge and the cast. `propFoot` adds a
 * board's per-sprite overrides for props.
 */
export function shadowOptions(
  p: Placed,
  propFoot: Readonly<Record<string, HardShadowOptions>> = {},
): HardShadowOptions {
  const { o, img } = p;
  const ow8 = Math.max(8, Math.round(img.width * 0.15));
  return o.kind === 'house'
    ? { overhang: ow8, band: 6 }
    : o.kind === 'tree'
      ? {
          dir: { x: 0.42, y: 0.3 },
          foot: 8,
          sweep: 1,
          reach: Math.min(52, Math.max(12, Math.round(img.height * 0.32))),
        }
      : o.kind === 'prop'
        ? {
            overhang: ow8,
            dir: { x: 0.42, y: 0.3 },
            sweep: 1,
            under: true,
            reach: Math.min(24, Math.max(10, Math.round(img.height * 0.3))),
            ...propFoot[o.sprite],
          }
        : { overhang: ow8 };
}

/** What a board may ask of {@link groundObject} beyond the defaults (Ba Dan's). */
export interface GroundExtra {
  /** The mask's strength on soft ground (1); paving's stays 1.3. */
  readonly softScale?: number;
  /** Keep the grass kit's tufts, pebbles and clods off water (a tree on a creek's bank). */
  readonly dryKit?: boolean;
}

/** Clears the pixels of `img`, laid at (dx, dy) on the plate, that land on water. */
function offWater(
  img: RgbaImage,
  dx: number,
  dy: number,
  classes: Uint8Array,
  plateW: number,
): void {
  const plateH = classes.length / plateW;
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++) {
      const X = dx + x,
        Y = dy + y;
      if (X < 0 || Y < 0 || X >= plateW || Y >= plateH) continue;
      if (classes[Y * plateW + X] === CLASS.W) img.data[(y * img.width + x) * 4 + 3] = 0;
    }
}

/**
 * Grounds one standing object on the plate `g`: its `hardShadowMask` (a prop's closed into one
 * shape with a seam under every foot column); on soft ground the grass kit's contact drawn and the
 * mask laid by ground ({@link paintByGround}), on paving the mask at paving's strength and the
 * floor reaction beside the seam. Returns the mask's record and the kit's fringe, which the caller
 * seats with {@link seatFringe} once it has added anything of its own (a house's skirt).
 */
export function groundObject(
  g: RgbaImage,
  p: Placed,
  classes: Uint8Array,
  soft: boolean,
  opts: HardShadowOptions,
  extra: GroundExtra = {},
): { record: ShadowRecord; fringe: RgbaImage | undefined } {
  const { softScale = 1, dryKit = false } = extra;
  const { o, img } = p;
  const m = hardShadowMask(alphaOf(img), img.width, img.height, opts);
  if (o.kind === 'prop') {
    seamUnderFoot(m, img);
    coherentCast(m);
  }
  const record: ShadowRecord = { id: o.id, m, dx: p.x - m.pad, dy: p.y };
  let fringe: RgbaImage | undefined;
  if (soft) {
    const kit = groundKit(img, p.x * 7 + p.base, {
      tall: o.kind === 'tree' ? 7 : 5,
      density: o.kind === 'house' ? 0.6 : 1,
    });
    if (kit) {
      if (dryKit) {
        offWater(kit.contact, p.x - kit.m, p.y - kit.m, classes, g.width);
        offWater(kit.fringe, p.x - kit.m, p.y - kit.m, classes, g.width);
      }
      draw(g, kit.contact, p.x - kit.m, p.y - kit.m);
      fringe = kit.fringe;
    }
    paintByGround(g, m, p.x - m.pad, p.y, classes, softScale);
  } else {
    paintMask(g, m, p.x - m.pad, p.y, 1.3);
    reactBesideSeam(g, m, p.x - m.pad, p.y, p.x * 31 + p.base);
  }
  return { record, fringe };
}

/** Kinds baked into the plates rather than standing in the upright atlas. */
export const FLAT_KINDS: ReadonlySet<string> = new Set(['flat', 'bridge', 'walkway', 'steps']);

/**
 * The plate pixels any object's sprite covers, and each standing object with its fringe over its
 * foot, trimmed, placed in game world px (`origin` is the plate's top-left in world px).
 */
export function standingUprights(
  placed: readonly Placed[],
  fringes: ReadonlyMap<Placed, RgbaImage>,
  plate: { readonly width: number; readonly height: number },
  origin: { readonly x: number; readonly y: number },
): { cover: Uint8Array; uprights: Upright[] } {
  const PW = plate.width,
    PH = plate.height;
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
    if (FLAT_KINDS.has(p.o.kind)) continue;
    const full = blank(p.w + 2 * M, p.h + 2 * M);
    draw(full, p.img, M, M);
    const f = fringes.get(p);
    if (f) draw(full, f, 0, 0);
    const t = trim(full);
    uprights.push({
      id: p.o.id,
      image: t.image,
      x: p.x + origin.x - M + t.x,
      y: p.y + origin.y - M + t.y,
    });
  }
  return { cover, uprights };
}
