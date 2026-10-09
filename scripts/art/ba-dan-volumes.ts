/**
 * Light volumes of the village's set dressing and boundary wall, read off the guide geometry
 * (`scripts/art/ba-dan-guides/dressing.py`): each post, roof, table top, cart bed, wheel rim and
 * rail is its own solid with the height range it has in the guide, so a baked shadow has the shape
 * of the object, with the gaps between its parts, instead of a block the size of its footprint.
 * Coordinates are tiles from the piece's footprint origin (the guide's own), heights are world
 * pixels, the same the guides use. A round part (a barrel, a well curb) is two overlapping
 * rectangles, an octagon's worth; a wheel is a ring of two arcs and a spoke, as the painted wheel
 * is open between its spokes.
 */

/** An axis-aligned rectangle on the ground in logical tiles. */
export interface Rect {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

/** A solid whose horizontal section at screen height `h` is a logical rectangle. */
export interface Volume {
  readonly id: string;
  readonly kind: 'house' | 'roof' | 'stall' | 'planter' | 'bridge' | 'wall' | 'prop';
  readonly hMin: number;
  readonly hMax: number;
  readonly section: (h: number) => Rect | null;
  /** The darkest this solid's shadow gets, 0..1 (default 1): a thin panel high above the ground lets sky through. */
  readonly density?: number;
}

export const box = (
  id: string,
  kind: Volume['kind'],
  rect: Rect,
  h0: number,
  h1: number,
): Volume => ({
  id,
  kind,
  hMin: h0,
  hMax: h1,
  section: (h) => (h >= h0 && h <= h1 ? rect : null),
});

/** [x0, x1, y0, y1, z0, z1] in the piece's own tiles. */
type Part = readonly [number, number, number, number, number, number];

/** Pixels of height per tile of ground for a vertical circle: the guides' `S`. */
const S = 78.4;

/** A round part as the cross of two rectangles (an octagon): centre, radius, heights. */
const round = (cx: number, cy: number, r: number, z0: number, z1: number): Part[] => [
  [cx - r, cx + r, cy - r * 0.7, cy + r * 0.7, z0, z1],
  [cx - r * 0.7, cx + r * 0.7, cy - r, cy + r, z0, z1],
];

const post = (cx: number, cy: number, w: number, z0: number, z1: number): Part => [
  cx - w / 2,
  cx + w / 2,
  cy - w / 2,
  cy + w / 2,
  z0,
  z1,
];

/** A pitched solid: the section's half-widths shrink linearly from `base` at `zb` to `top` at `zt`. */
function pitched(
  id: string,
  ox: number,
  oy: number,
  [cx, cy, bx, by, tx, ty]: readonly number[],
  zb: number,
  zt: number,
): Volume {
  return {
    id,
    kind: 'prop',
    hMin: zb,
    hMax: zt,
    section: (h) => {
      if (h < zb || h > zt) return null;
      const k = (h - zb) / (zt - zb);
      const hx = bx! + (tx! - bx!) * k;
      const hy = by! + (ty! - by!) * k;
      return { x0: ox + cx! - hx, x1: ox + cx! + hx, y0: oy + cy! - hy, y1: oy + cy! + hy };
    },
  };
}

/**
 * A wheel standing in the plane y = `y` (thickness `t`), centre (`cx`, height `R`), radius `R`
 * (world px), rim `rim` px thick: two arcs at either side where the felloe is, the whole chord
 * across the rim's top and bottom, a spoke along the horizontal and one along the vertical.
 */
function wheel(
  id: string,
  ox: number,
  oy: number,
  cx: number,
  y: number,
  R: number,
  t: number,
  rim: number,
): Volume[] {
  const half = (r: number, dz: number): number => Math.sqrt(Math.max(0, r * r - dz * dz)) / S;
  const section =
    (pick: 'left' | 'right' | 'spokes') =>
    (h: number): Rect | null => {
      const dz = h - R;
      if (Math.abs(dz) > R) return null;
      const outer = half(R, dz);
      const inner = Math.abs(dz) < R - rim ? half(R - rim, dz) : 0;
      const base = { y0: oy + y, y1: oy + y + t };
      if (pick === 'spokes') {
        if (Math.abs(dz) <= 2)
          return { x0: ox + cx - half(R - rim, 0), x1: ox + cx + half(R - rim, 0), ...base };
        return Math.abs(dz) < R - rim
          ? { x0: ox + cx - 0.012, x1: ox + cx + 0.012, ...base }
          : null;
      }
      if (inner === 0)
        return pick === 'left' ? { x0: ox + cx - outer, x1: ox + cx + outer, ...base } : null;
      return pick === 'left'
        ? { x0: ox + cx - outer, x1: ox + cx - inner, ...base }
        : { x0: ox + cx + inner, x1: ox + cx + outer, ...base };
    };
  const mk = (part: 'left' | 'right' | 'spokes'): Volume => ({
    id: `${id}-${part}`,
    kind: 'prop',
    hMin: 1,
    hMax: 2 * R,
    section: section(part),
  });
  return [
    mk('left'),
    mk('right'),
    mk('spokes'),
    // the tread's contact with the ground
    box(
      `${id}-foot`,
      'prop',
      { x0: ox + cx - 0.03, x1: ox + cx + 0.03, y0: oy + y, y1: oy + y + t },
      0,
      3,
    ),
  ];
}

/** A sloped beam: from (xa, za) to (xb, zb) at y, a square `w` across. */
function slope(
  id: string,
  ox: number,
  oy: number,
  [xa, za, xb, zb]: readonly [number, number, number, number],
  y: number,
  w: number,
): Volume {
  const lo = Math.min(za, zb);
  const hi = Math.max(za, zb);
  return {
    id,
    kind: 'prop',
    hMin: lo,
    hMax: hi,
    section: (h) => {
      if (h < lo || h > hi) return null;
      const x = xa + ((xb - xa) * (h - za)) / (zb - za);
      return { x0: ox + x - w, x1: ox + x + w, y0: oy + y - w / 2, y1: oy + y + w / 2 };
    },
  };
}

function fenceParts(
  along: 'x' | 'y',
  from: number,
  to: number,
  at: number,
  posts: number,
  w: number,
  z: number,
  rails: readonly (readonly [number, number])[],
  rw: number,
): Part[] {
  const n = Math.max(1, Math.round((to - from) / posts));
  const out: Part[] = [];
  const t = (u0: number, u1: number, v0: number, v1: number, z0: number, z1: number): Part =>
    along === 'x' ? [u0, u1, v0, v1, z0, z1] : [v0, v1, u0, u1, z0, z1];
  for (let i = 0; i <= n; i++) {
    const u = from + ((to - from) * i) / n;
    out.push(t(u - w / 2, u + w / 2, at - w / 2, at + w / 2, 0, z));
    if (i < n) {
      const u1 = from + ((to - from) * (i + 1)) / n;
      for (const [z0, z1] of rails) out.push(t(u, u1, at - rw, at + rw, z0, z1));
    }
  }
  return out;
}

const PARTS: Readonly<Record<string, readonly Part[]>> = {
  'village-well': [
    ...round(0.5, 0.5, 0.38, 0, 22),
    post(0.5, 0.17, 0.07, 22, 90),
    post(0.5, 0.83, 0.07, 22, 90),
    [0.445, 0.555, 0.17, 0.83, 60, 72],
    ...round(0.54, 0.5, 0.08, 30, 46),
  ],
  'banner-pole': [
    [0.36, 0.64, 0.36, 0.64, 0, 8],
    post(0.5, 0.5, 0.06, 8, 126),
    [0.455, 0.545, 0.15, 0.85, 118, 124],
    [0.445, 0.555, 0.12, 0.18, 116, 128],
    [0.445, 0.555, 0.82, 0.88, 116, 128],
    [0.575, 0.615, 0.26, 0.74, 58, 117],
    [0.575, 0.615, 0.26, 0.42, 44, 58],
    [0.575, 0.615, 0.58, 0.74, 44, 58],
  ],
  'lantern-post': [
    [0.4, 0.6, 0.4, 0.6, 0, 10],
    post(0.5, 0.5, 0.06, 10, 108),
    [0.46, 0.54, 0.46, 0.54, 108, 112],
    [0.5, 0.78, 0.485, 0.515, 101, 106],
    [0.68, 0.8, 0.44, 0.56, 90, 94],
    [0.69, 0.79, 0.45, 0.55, 94, 101],
    [0.7, 0.78, 0.46, 0.54, 66, 90],
    [0.68, 0.8, 0.44, 0.56, 62, 66],
  ],
  'shop-stack': [
    [0.08, 0.54, 0.1, 0.48, 0, 17],
    [0.12, 0.48, 0.13, 0.43, 17, 32],
    [0.54, 0.9, 0.08, 0.4, 0, 15],
    ...round(0.24, 0.74, 0.13, 0, 12),
    ...round(0.66, 0.66, 0.14, 0, 34),
    ...round(0.42, 0.52, 0.12, 0, 21),
  ],
  baskets: [
    [0.06, 0.94, 0.08, 0.92, 0, 4],
    ...round(0.3, 0.3, 0.15, 4, 19),
    ...round(0.7, 0.28, 0.14, 4, 18),
    ...round(0.46, 0.68, 0.17, 4, 21),
    ...round(0.8, 0.74, 0.1, 4, 19),
  ],
  'laundry-line': [
    post(0.2, 0.5, 0.07, 0, 100),
    post(1.8, 0.5, 0.07, 0, 100),
    [0.155, 0.245, 0.4, 0.6, 94, 99],
    [1.755, 1.845, 0.4, 0.6, 94, 99],
    [0.2, 1.8, 0.49, 0.51, 84, 94],
    [0.23, 0.53, 0.485, 0.515, 58, 93],
    [0.67, 0.93, 0.485, 0.515, 60, 91],
    [1.0, 1.3, 0.485, 0.515, 62, 89],
    [1.42, 1.62, 0.485, 0.515, 56, 91],
    ...round(1.45, 0.8, 0.15, 0, 16),
  ],
  'notice-board': [
    [0.44, 0.56, 0.1, 0.2, 0, 5],
    [0.44, 0.56, 0.8, 0.9, 0, 5],
    post(0.5, 0.15, 0.07, 5, 104),
    post(0.5, 0.85, 0.07, 5, 104),
    [0.5, 0.56, 0.12, 0.88, 40, 94],
    [0.38, 0.66, 0.02, 0.98, 94, 104],
  ],
  'bench-2x1': [
    post(0.18, 0.325, 0.08, 22, 60),
    post(1.82, 0.325, 0.08, 22, 60),
    [0.12, 1.88, 0.31, 0.345, 30, 36],
    [0.12, 1.88, 0.31, 0.345, 39, 45],
    [0.12, 1.88, 0.31, 0.345, 48, 54],
    [0.15, 0.25, 0.36, 0.66, 0, 21],
    [1.75, 1.85, 0.36, 0.66, 0, 21],
    [0.06, 1.94, 0.36, 0.68, 21, 26],
  ],
  'garden-plot-3x2': [
    ...[1.4, 0.86, 0.32].map((y): Part => [0.14, 2.76, y - 0.12, y + 0.12, 0, 5]),
    ...[0.3, 0.74, 1.18, 1.62, 2.06, 2.5].map((x): Part => [x - 0.1, x + 0.1, 0.76, 0.96, 5, 14]),
    ...fenceParts(
      'y',
      0.05,
      1.95,
      2.96,
      0.75,
      0.065,
      30,
      [
        [9, 13],
        [20, 24],
      ],
      0.015,
    ),
    ...fenceParts(
      'x',
      0.05,
      2.96,
      1.96,
      0.75,
      0.065,
      30,
      [
        [9, 13],
        [20, 24],
      ],
      0.015,
    ),
  ],
  'stone-lantern': [
    [0.3, 0.7, 0.3, 0.7, 0, 6],
    [0.42, 0.58, 0.42, 0.58, 6, 30],
    [0.34, 0.66, 0.34, 0.66, 30, 35],
    [0.38, 0.62, 0.38, 0.62, 35, 57],
    [0.3, 0.7, 0.3, 0.7, 57, 61],
    [0.455, 0.545, 0.455, 0.545, 74, 82],
  ],
  'trough-hay': [
    post(0.14, 0.2, 0.06, 0, 56),
    post(0.14, 0.5, 0.06, 0, 56),
    post(0.84, 0.2, 0.06, 0, 56),
    post(0.84, 0.5, 0.06, 0, 56),
    [0.14, 0.84, 0.24, 0.36, 20, 36],
    [0.1, 0.88, 0.17, 0.22, 52, 56],
    [0.1, 0.88, 0.5, 0.55, 18, 22],
    [1.0, 1.9, 0.28, 0.72, 0, 20],
  ],
  'fence-2x1': [
    ...[0.06, 1.0, 1.94].map((u): Part => post(u, 0.5, 0.07, 0, 32)),
    [0.02, 1.98, 0.485, 0.515, 8, 12],
    [0.02, 1.98, 0.485, 0.515, 20, 24],
  ],
  handcart: [
    [1.28, 1.32, 0.3, 0.7, 35, 52],
    [1.3, 2.5, 0.26, 0.74, 31, 35],
    [1.3, 2.5, 0.26, 0.3, 35, 49],
    [2.46, 2.5, 0.3, 0.7, 35, 43],
    [1.3, 2.5, 0.7, 0.74, 35, 49],
    [1.95, 2.25, 0.36, 0.64, 35, 49],
    ...round(1.65, 0.5, 0.13, 35, 56),
    [1.828, 1.872, 0.15, 0.86, 24, 28],
    [0.28, 0.32, 0.31, 0.69, 3, 7],
  ],
};

const BOARD_PANEL_DENSITY = 0.7;

/** The volumes of one placed piece of dressing: `id` is the scenery id, `image` the sprite name. */
export function dressingVolumes(id: string, image: string, x: number, y: number): Volume[] {
  const out = (PARTS[image] ?? []).map(([x0, x1, y0, y1, z0, z1], i): Volume =>
    box(`${id}-${i}`, 'prop', { x0: x + x0, x1: x + x1, y0: y + y0, y1: y + y1 }, z0, z1),
  );
  // The board's panel and little roof are thin, high and open on both faces: their shadow is the true
  // shape, but lighter than the legs' solid wood.
  if (image === 'notice-board')
    return out.map((v, i) => (i >= 4 ? { ...v, density: BOARD_PANEL_DENSITY } : v));
  if (image === 'village-well')
    out.push(pitched(`${id}-roof`, x, y, [0.5, 0.5, 0.38, 0.46, 0.0, 0.46], 90, 112));
  if (image === 'handcart') {
    out.push(...wheel(`${id}-w0`, x, y, 1.85, 0.1, 26, 0.05, 5));
    out.push(...wheel(`${id}-w1`, x, y, 1.85, 0.86, 26, 0.05, 5));
    out.push(slope(`${id}-s0`, x, y, [0.3, 3, 2.3, 31], 0.36, 0.03));
    out.push(slope(`${id}-s1`, x, y, [0.3, 3, 2.3, 31], 0.64, 0.03));
  }
  if (image === 'stone-lantern')
    out.push(pitched(`${id}-roof`, x, y, [0.5, 0.5, 0.24, 0.24, 0.0, 0.0], 61, 74));
  return out;
}

// ---------------------------------------------------------------------------
// The boundary wall
// ---------------------------------------------------------------------------

/** The module's plan (`dressing.py`): wall slab across [WB0, WB1] at the base, [WT0, WT1] at the top. */
const WALL_H = 66;
const COPING = 6;
const WB0 = 0.5;
const WB1 = 0.96;
const WT0 = 0.56;
const WT1 = 0.9;

/**
 * The wall as the modules make it: a battered slab along each run, a buttress at the middle of
 * every buttress module, a pier at each end (the inside corner, the end piers, the gate piers).
 * `along` x: the north wall, tile row -2; along y: the west wall, tile column -2.
 */
export function wallVolumes(): Volume[] {
  const out: Volume[] = [];
  const at = (along: 'x' | 'y', u0: number, u1: number, v0: number, v1: number): Rect =>
    along === 'x'
      ? { x0: u0, x1: u1, y0: -2 + v0, y1: -2 + v1 }
      : { x0: -2 + v0, x1: -2 + v1, y0: u0, y1: u1 };
  const slab = (id: string, along: 'x' | 'y', u0: number, u1: number): void => {
    out.push({
      id,
      kind: 'wall',
      hMin: 0,
      hMax: WALL_H + COPING,
      section: (h) => {
        if (h > WALL_H + COPING) return null;
        if (h > WALL_H) return at(along, u0, u1, WT0 - 0.03, WT1 + 0.03);
        const k = h / WALL_H;
        return at(along, u0, u1, WB0 + (WT0 - WB0) * k, WB1 + (WT1 - WB1) * k);
      },
    });
  };
  const pier = (
    id: string,
    along: 'x' | 'y',
    [u0, u1]: readonly [number, number],
    [v0, v1]: readonly [number, number],
    top: number,
    cap: number,
    finial = false,
  ): void => {
    out.push(box(`${id}-shaft`, 'wall', at(along, u0, u1, v0, v1), 0, top));
    out.push(
      box(
        `${id}-cap`,
        'wall',
        at(along, u0 - 0.045, u1 + 0.045, v0 - 0.045, v1 + 0.045),
        top,
        top + cap,
      ),
    );
    if (finial) {
      const cu = (u0 + u1) / 2;
      const cv = (v0 + v1) / 2;
      out.push(
        box(
          `${id}-finial`,
          'wall',
          at(along, cu - 0.06, cu + 0.06, cv - 0.06, cv + 0.06),
          top + cap,
          top + cap + 13,
        ),
      );
    }
  };
  const buttress = (id: string, along: 'x' | 'y', c: number): void => {
    out.push(
      box(
        `${id}-shaft`,
        'wall',
        at(along, c - 0.22, c + 0.22, WB1 - 0.06, WB1 + 0.16),
        0,
        WALL_H + 10,
      ),
    );
    out.push(
      box(
        `${id}-cap`,
        'wall',
        at(along, c - 0.25, c + 0.25, WB1 - 0.12, WB1 + 0.12),
        WALL_H + 10,
        WALL_H + 15,
      ),
    );
  };
  // north wall: corner pier, 12 two-tile modules from x -1, end pier at x 23
  slab('north-wall', 'x', -0.98, 23.5);
  for (let i = 0; i < 12; i++) if (i % 2) buttress(`north-wall-b${i}`, 'x', -1 + 2 * i + 1);
  pier('wall-corner', 'x', [-1.56, -0.98], [0.44, 1.02], WALL_H + 12, 7);
  pier('wall-end-x', 'x', [23.5, 23.96], [0.46, 1.03], WALL_H + 10, 6);
  // west wall: three modules to the gate pier at row 5, then rows 9 to 15
  slab('west-wall-n', 'y', -0.98, 5.5);
  buttress('west-wall-b1', 'y', 2);
  pier('wall-gate-n', 'y', [5.5, 5.96], [0.46, 1.03], WALL_H + 16, 6, true);
  slab('west-wall-s', 'y', 9.38, 15.5);
  buttress('west-wall-b2', 'y', 11);
  pier('wall-gate-s', 'y', [9.04, 9.5], [0.46, 1.03], WALL_H + 16, 6, true);
  pier('wall-end-y', 'y', [15.5, 15.96], [0.46, 1.03], WALL_H + 10, 6);
  return out;
}
