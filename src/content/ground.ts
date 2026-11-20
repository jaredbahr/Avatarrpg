/**
 * Ground as data (ADR 0120): one shape for every top-down board's ground, and one classifier for it. A board
 * declares its ground classes (each with the tileset it is drawn from and what the rules read it as), which class
 * each row character lies on, the made shapes the rows build exactly (a dug canal, a raised terrace, a house's
 * plinth), its named tracks (desire lines as polylines, with a width and a wear), its aprons (ground changed by what
 * stands there), where weeds grow, and its rim mouths. The ground packer's shared baker
 * (`scripts/art/topdown/boards/ground.ts`) paints them; the content validation reads the same data through
 * `classify`, and the placement checks (`groundChecks.ts`) keep objects off the tracks. The shipped runtime never
 * imports this module.
 *
 * Generalised from RG-02's classifier (`rg02.topdown.terrain.ts`, which keeps its own until a later migration):
 * every natural class is blended per pixel between 32 px vertices that sample the 40 px cells and broken by two
 * octaves of value noise, so no natural edge follows the cell grid; a bump round each cell's centre keeps the cell's
 * own class where a figure stands (the rules win), and anything a figure cannot stand on (water, rock, a face, the
 * void) is held off that core. A made shape is drawn exactly from the rows over the blend: made edges are clean.
 *
 * Pure and seeded: nothing here calls `Math.random`, reads the DOM or holds a canvas.
 */
import type { MapEdgeSide, Vec2 } from '../core/types';
import {
  hash2,
  vnoise,
  type GroundClass,
  type PointClass,
  type RimMouth,
  type Terrain,
} from './scenes/baDan.topdown.terrain';

export { hash2, vnoise };

/** A `chars` entry for a made character that lies on whatever its neighbours lie on. */
export const INHERIT = 'inherit';
const INHERITED = 255;

/** The Wang vertex pitch and the cell, in world px (one art px a world px). */
export const GROUND_TILE = 32;
export const GROUND_CELL = 40;

/** Where a class's pixels come from: one plain tile of a set under `prototypes/topdown/assets/tiles/`. */
export interface GroundTileRef {
  readonly set: string;
  /** The file's corner key: `c0000` for a `c<bits>.png` set, `UUUU` for a `NN_<key>.png` set. */
  readonly key: string;
}

/** One class of ground. Its index in `GroundSpec.classes` is its number in the baked class map. */
export interface GroundClassDef {
  readonly id: string;
  readonly tile: GroundTileRef;
  /** What the content validation reads it as: `ground` is walkable soil or paving. */
  readonly reads: GroundClass;
  /** The game's terrain key: G grass and soil, C paving, D dirt and dust, W water, V void. */
  readonly terrain: Terrain;
  /** How much of its own contrast it keeps round its mean (1 keeps it all): calm ground (core G2). */
  readonly calm?: number;
  /** Per-channel factors on its mean, so a tile can be warmed or paled toward the region's ground. */
  readonly grade?: readonly [number, number, number];
  /**
   * How wear shows on it: `packs` (loose ground pressed darker and smoother, the loose stuff left at the fringes),
   * `bares` (grass trodden to bare earth) or `lifts` (paving polished a step lighter). By its terrain when unset:
   * dirt packs, grass bares, paving lifts.
   */
  readonly wears?: 'packs' | 'bares' | 'lifts';
  /** Loose ground that the wind and feet heap at its edges and against walls, paler than the rest. */
  readonly drifts?: boolean;
}

/**
 * A shape the rows build exactly, drawn over the blended ground in its class, its edge on the cell lines (a made
 * edge is clean, core G8):
 * - `cell`: the whole cell, less `inset` px each side;
 * - `link`: a centre square `width` px across, with an arm of the same width to each four-neighbour whose character
 *   is in `links` (a wall or a fence runs on);
 * - `block`: a square `width` px across in the cell's middle.
 */
export type MadeShape =
  | { readonly shape: 'cell'; readonly inset?: number }
  | { readonly shape: 'link'; readonly width: number; readonly links: string }
  | { readonly shape: 'block'; readonly width: number };

export interface MadeDef {
  readonly class: string;
  readonly made: MadeShape;
  /**
   * What it is drawn as: `plinth` a flat slab with a lit and a shaded edge and a hard cast (a placeholder until its
   * set piece stands there); `water` a dug channel with a clean kerb `kerb` px wide on its banks; `terrace` raised
   * paving with a cut face `face` px high where it drops; `steps` the treads down from a terrace; `deck` built
   * paving carried over water, flat in its class.
   */
  readonly draw: 'plinth' | 'water' | 'terrace' | 'steps' | 'deck';
  readonly kerb?: number;
  readonly face?: number;
}

/** A track's line: a polyline, a disk worn all over, or a ring worn round a post. Cell coordinates (centres at +0.5). */
export type TrackShape =
  | {
      readonly line: readonly (readonly [number, number])[];
      readonly width: number;
      /** A width per point, so a track can narrow (a road through a gate); `width` is its widest. */
      readonly widths?: readonly number[];
    }
  | { readonly disk: readonly [number, number]; readonly r: number }
  | { readonly ring: readonly [number, number]; readonly r: number };

/**
 * A named desire line (core G3): where people walk, worn by `wear` (3 bare and most worn, 2 worn, 1 a light trail).
 * The baker wears it into the ground; the placement checks keep objects off it, and nothing grows on it.
 */
export type GroundTrack = TrackShape & {
  readonly id: string;
  readonly wear: 1 | 2 | 3;
  /** Wheels as well as feet: two ruts along it. */
  readonly ruts?: boolean;
};

/**
 * What an apron does to the ground (core G4):
 * - `packed`: trodden, packed earth at a door or where people stand;
 * - `wet`: a dark damp ring, with hoofprints where carts water their animals;
 * - `damp`: a damp kerb, darker stone at the water;
 * - `mud`: a wet mud fringe where a road goes under water;
 * - `chips`: pale stone chips and dust where stone is cut;
 * - `tilled`: soil in east-west strips, one per household, their edges marked;
 * - `sward`: grass surviving on loose ground in a corner nobody walks;
 * - `treads`: stone steps cut down a dug bank into the water (drawn over the water's top rows; it stays water).
 */
export type ApronKind = 'packed' | 'wet' | 'damp' | 'mud' | 'chips' | 'tilled' | 'sward' | 'treads';

/** Ground changed by what stands there: a disk (centre and radius) or a rectangle of cells, in cell coordinates. */
export type GroundApron = (
  | { readonly at: readonly [number, number]; readonly r: number }
  | { readonly rect: readonly [number, number, number, number] }
) & {
  readonly id: string;
  readonly kind: ApronKind;
  /** The world anchor or place it belongs to, for the `aprons` report. */
  readonly anchor?: string;
};

/** Where neglect lets weeds grow (core G6): along a line, round a point, or along every edge `edgeOf` names. */
export type GroundGrowth = (
  | { readonly line: readonly (readonly [number, number])[]; readonly width: number }
  | { readonly ring: readonly [number, number]; readonly r: number }
) & { readonly id: string; readonly density: number };

/** A rectangle of cells left calm on purpose (inclusive): no apron, growth or detail is drawn there. */
export type CellBox = readonly [number, number, number, number];

export interface GroundSpec {
  readonly mapId: string;
  readonly rows: readonly string[];
  readonly classes: readonly GroundClassDef[];
  /**
   * The natural class each row character lies on; a character not listed lies on `fallback`, and one listed as
   * `INHERIT` (a made shape) lies on what its neighbours lie on.
   */
  readonly chars: Readonly<Record<string, string>>;
  readonly fallback: string;
  /** Characters the rows build exactly (see `MadeDef`). Their natural class is `chars`' as for any other. */
  readonly made?: Readonly<Record<string, MadeDef>>;
  /**
   * Built pieces of ground the rows cannot tell from their neighbours (a causeway over the canal is road cells
   * either side of water), drawn exactly on their box of cells.
   */
  readonly structures?: readonly {
    readonly id: string;
    readonly box: CellBox;
    readonly made: MadeDef;
    /** The natural class its cells blend as, so nothing of it spills past its box. */
    readonly under: string;
  }[];
  /** What lies past the grid where the rows do not carry on (the void the map edge falls into). */
  readonly beyond: string;
  /** Row characters that carry on only one cell past the grid (the rim's tree line), then `beyond`. */
  readonly ends?: string;
  /** Cells of plate past the grid on each side. */
  readonly margin: {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
  };
  /**
   * A class whose south edge is a cut face rising out of the ground below (a hillside), `height` px tall; above the
   * face it is scree with sparse dry grass and, `outcrops` to a hundred cells, pale outcrops of its stone.
   */
  readonly hill?: { readonly class: string; readonly height: number; readonly outcrops?: number };
  readonly tracks: readonly GroundTrack[];
  readonly aprons: readonly GroundApron[];
  readonly growth: readonly GroundGrowth[];
  /** Ground kept empty on purpose (a crowd's room): no apron, growth or detail. */
  readonly quiet?: readonly CellBox[];
  readonly mouths: readonly RimMouth[];
  readonly mouthReach: number;
  /** The region palette the bake is locked to last (`scripts/art/topdown/palettes/`), by name. */
  readonly palette?: string;
  /** Seeds the board's own noise, so two boards built alike do not look alike. */
  readonly seed: number;
}

/* ------------------------------------------------------------------ */
/* Track and apron geometry, in cell units                             */
/* ------------------------------------------------------------------ */

const segD = (x: number, y: number, a: readonly number[], b: readonly number[]): number => {
  const ax = a[0] ?? 0,
    ay = a[1] ?? 0,
    vx = (b[0] ?? 0) - ax,
    vy = (b[1] ?? 0) - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(x - ax - vx * t, y - ay - vy * t);
};

/** Distance from a point to a polyline, in its own units. */
export function polylineDistance(
  x: number,
  y: number,
  pts: readonly (readonly [number, number])[],
): number {
  if (pts.length === 1) {
    const p = pts[0] ?? [0, 0];
    return Math.hypot(x - p[0], y - p[1]);
  }
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i];
    if (a && b) d = Math.min(d, segD(x, y, a, b));
  }
  return d;
}

/** The nearest point of a polyline: its distance, and how far along the whole line it lies (0 to 1). */
export function polylineNearest(
  x: number,
  y: number,
  pts: readonly (readonly [number, number])[],
): { d: number; seg: number; t: number; along: number } {
  let best = { d: Infinity, seg: 0, t: 0, along: 0 };
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i];
    if (!a || !b) continue;
    const vx = b[0] - a[0],
      vy = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / (vx * vx + vy * vy || 1)),
    );
    const d = Math.hypot(x - a[0] - vx * t, y - a[1] - vy * t);
    if (d < best.d) best = { d, seg: i - 1, t, along: (i - 1 + t) / Math.max(1, pts.length - 1) };
  }
  return best;
}

/** A line track's width where its nearest point to (x, y) lies. */
export function widthAt(t: Extract<TrackShape, { line: unknown }>, x: number, y: number): number {
  if (!t.widths) return t.width;
  const n = polylineNearest(x, y, t.line);
  const a = t.widths[n.seg] ?? t.width,
    b = t.widths[n.seg + 1] ?? a;
  return a + (b - a) * n.t;
}

/**
 * How far a point (cell units) is inside a track's worn band, as a signed distance from its edge: positive inside,
 * negative outside. A line's band is its half width; a disk's its radius; a ring's a band a cell wide round its radius.
 */
export function trackDepth(t: TrackShape, x: number, y: number): number {
  if ('line' in t) return widthAt(t, x, y) / 2 - polylineDistance(x, y, t.line);
  if ('disk' in t) return t.r - Math.hypot(x - t.disk[0], y - t.disk[1]);
  return 0.5 - Math.abs(Math.hypot(x - t.ring[0], y - t.ring[1]) - t.r);
}

/** The half width of a track's band, in cells (a ring is a cell wide). */
export const trackHalf = (t: TrackShape): number =>
  'line' in t ? t.width / 2 : 'disk' in t ? t.r : 0.5;

/** Every cell whose centre lies on a track's band: the cells the placement checks keep clear. */
export function trackCells(t: TrackShape, width: number, height: number): Vec2[] {
  const out: Vec2[] = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) if (trackDepth(t, x + 0.5, y + 0.5) >= 0) out.push({ x, y });
  return out;
}

/** How far a point (cell units) is inside an apron: positive inside, in cells. */
export function apronDepth(a: GroundApron, x: number, y: number): number {
  if ('at' in a) return a.r - Math.hypot(x - a.at[0], y - a.at[1]);
  const [x0, y0, x1, y1] = a.rect;
  return Math.min(x - x0, x1 + 1 - x, y - y0, y1 + 1 - y);
}

export const inBox = (b: CellBox, x: number, y: number): boolean =>
  x >= b[0] && x < b[2] + 1 && y >= b[1] && y < b[3] + 1;

/* ------------------------------------------------------------------ */
/* The classifier                                                       */
/* ------------------------------------------------------------------ */

/** A made pixel: the class it is drawn in, and which part of its shape it is. */
export interface MadePixel {
  readonly k: number;
  readonly def: MadeDef;
  /** The made character's cell. */
  readonly cx: number;
  readonly cy: number;
}

export class GroundTerrain {
  readonly gw: number;
  readonly gh: number;
  readonly plateW: number;
  readonly plateH: number;
  /** The grid's top-left in plate px. */
  readonly grid: Vec2;
  /** The plate's top-left in game world px. */
  readonly origin: Vec2;
  readonly classIndex: ReadonlyMap<string, number>;
  private readonly vw: number;
  private readonly weights: Float32Array;
  private readonly natural: Uint8Array;
  private readonly hardClass: Uint8Array;
  private readonly beyondK: number;

  constructor(readonly spec: GroundSpec) {
    this.gh = spec.rows.length;
    this.gw = spec.rows[0]?.length ?? 0;
    const m = spec.margin;
    this.grid = { x: m.left * GROUND_CELL, y: m.top * GROUND_CELL };
    this.plateW = (m.left + this.gw + m.right) * GROUND_CELL;
    this.plateH = (m.top + this.gh + m.bottom) * GROUND_CELL;
    this.origin = { x: -this.grid.x, y: -this.grid.y };
    this.classIndex = new Map(spec.classes.map((c, i) => [c.id, i]));
    const idx = (id: string): number => {
      const k = this.classIndex.get(id);
      if (k === undefined) throw new Error(`ground "${spec.mapId}" has no class "${id}"`);
      return k;
    };
    this.beyondK = idx(spec.beyond);
    if (spec.hill) idx(spec.hill.class);
    // which classes are never stood on: held off a walkable cell's core
    this.hardClass = new Uint8Array(spec.classes.length);
    spec.classes.forEach((c, i) => (this.hardClass[i] = c.reads === 'ground' ? 0 : 1));
    this.natural = new Uint8Array(256);
    this.natural.fill(idx(spec.fallback));
    for (const [ch, id] of Object.entries(spec.chars))
      this.natural[ch.charCodeAt(0)] = id === INHERIT ? INHERITED : idx(id);
    for (const d of Object.values(spec.made ?? {})) idx(d.class);
    const n = spec.classes.length;
    this.vw = Math.ceil(this.plateW / GROUND_TILE) + 1;
    const vh = Math.ceil(this.plateH / GROUND_TILE) + 1;
    this.weights = new Float32Array(this.vw * vh * n);
    for (let vy = 0; vy < vh; vy++)
      for (let vx = 0; vx < this.vw; vx++)
        this.weights[(vy * this.vw + vx) * n + this.naturalAt(vx * GROUND_TILE, vy * GROUND_TILE)] =
          1;
  }

  /** The row character of cell (cx, cy), carried on past the grid where the rows lead somewhere, else ''. */
  charAt(cx: number, cy: number): string {
    const x = Math.max(0, Math.min(this.gw - 1, cx)),
      y = Math.max(0, Math.min(this.gh - 1, cy));
    const c = this.spec.rows[y]?.[x] ?? '';
    if (cx === x && cy === y) return c;
    if (this.natural[c.charCodeAt(0)] === this.beyondK) return '';
    if (Math.max(Math.abs(cx - x), Math.abs(cy - y)) > 1 && this.spec.ends?.includes(c)) return '';
    return c;
  }

  /** The natural class the rows give plate px (x, y). */
  naturalAt(px: number, py: number): number {
    const cx = Math.floor((px - this.grid.x) / GROUND_CELL),
      cy = Math.floor((py - this.grid.y) / GROUND_CELL);
    for (const st of this.spec.structures ?? [])
      if (inBox(st.box, cx, cy)) return this.classIndex.get(st.under) ?? this.beyondK;
    return this.cellNatural(cx, cy);
  }

  private readonly naturals = new Map<number, number>();
  /**
   * The natural class of any cell, past the grid too. A character that inherits (a made shape: the canal, a plinth)
   * lies on what its neighbours lie on, the most common class of the eight round it, so nothing of its own spills
   * past its edge.
   */
  cellNatural(cx: number, cy: number): number {
    const key = (cy + 1000) * 4000 + cx + 1000;
    const hit = this.naturals.get(key);
    if (hit !== undefined) return hit;
    const raw = (x: number, y: number): number => {
      const c = this.charAt(x, y);
      return c === '' ? this.beyondK : (this.natural[c.charCodeAt(0)] ?? this.beyondK);
    };
    let k = raw(cx, cy);
    if (k === INHERITED) {
      const count = new Map<number, number>();
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const) {
        const o = raw(cx + dx, cy + dy);
        if (o !== INHERITED && o !== this.beyondK) count.set(o, (count.get(o) ?? 0) + 1);
      }
      k = this.classIndex.get(this.spec.fallback) ?? 0;
      let most = 0;
      for (const [o, n] of count)
        if (n > most) {
          most = n;
          k = o;
        }
    }
    this.naturals.set(key, k);
    return k;
  }

  /** The natural class of cell (x, y) of the rows, or undefined off the grid. */
  cellClass(x: number, y: number): number | undefined {
    if (x < 0 || y < 0 || x >= this.gw || y >= this.gh) return undefined;
    for (const st of this.spec.structures ?? [])
      if (inBox(st.box, x, y)) return this.classIndex.get(st.under);
    return this.cellNatural(x, y);
  }

  /** The made shape covering plate px (x, y), if any. */
  madeAt(px: number, py: number): MadePixel | undefined {
    const cx = Math.floor((px - this.grid.x) / GROUND_CELL),
      cy = Math.floor((py - this.grid.y) / GROUND_CELL);
    for (const st of this.spec.structures ?? [])
      if (inBox(st.box, cx, cy))
        return { k: this.classIndex.get(st.made.class) ?? 0, def: st.made, cx, cy };
    const made = this.spec.made;
    if (!made) return undefined;
    const ch = this.charAt(cx, cy);
    const def = made[ch];
    if (!def) return undefined;
    const lx = px - this.grid.x - cx * GROUND_CELL,
      ly = py - this.grid.y - cy * GROUND_CELL;
    const k = this.classIndex.get(def.class) ?? 0;
    const m = def.made;
    const hit = (): boolean => {
      if (m.shape === 'cell') {
        // inset only where the shape ends, so a run of cells is one slab
        const i = m.inset ?? 0;
        const end = (dx: number, dy: number): number =>
          this.charAt(cx + dx, cy + dy) === ch ? 0 : i;
        return (
          lx >= end(-1, 0) &&
          ly >= end(0, -1) &&
          lx < GROUND_CELL - end(1, 0) &&
          ly < GROUND_CELL - end(0, 1)
        );
      }
      const lo = (GROUND_CELL - m.width) / 2,
        hi = lo + m.width;
      const inX = lx >= lo && lx < hi,
        inY = ly >= lo && ly < hi;
      if (inX && inY) return true;
      if (m.shape === 'block') return false;
      const link = (dx: number, dy: number): boolean =>
        m.links.includes(this.charAt(cx + dx, cy + dy));
      return (
        (inY && lx < lo && link(-1, 0)) ||
        (inY && lx >= hi && link(1, 0)) ||
        (inX && ly < lo && link(0, -1)) ||
        (inX && ly >= hi && link(0, 1))
      );
    };
    return hit() ? { k, def, cx, cy } : undefined;
  }

  /** The natural class the bake blends at plate px (x, y), before any made shape. */
  blendAt(px: number, py: number): number {
    const T = GROUND_TILE;
    const tx = Math.floor(px / T),
      ty = Math.floor(py / T),
      u = (px - tx * T + 0.5) / T,
      v = (py - ty * T + 0.5) / T;
    const n = this.spec.classes.length;
    const i0 = (ty * this.vw + tx) * n,
      i1 = i0 + n,
      i2 = ((ty + 1) * this.vw + tx) * n,
      i3 = i2 + n;
    const cx = Math.floor((px - this.grid.x) / GROUND_CELL),
      cy = Math.floor((py - this.grid.y) / GROUND_CELL);
    const own = this.cellClass(cx, cy);
    const dx = px - (this.grid.x + cx * GROUND_CELL + GROUND_CELL / 2),
      dy = py - (this.grid.y + cy * GROUND_CELL + GROUND_CELL / 2);
    // a soft bump keeps each cell's own class round its centre, and on a cell a figure stands on, what cannot be stood
    // on is held off a flat core out past a figure's half width (12 px); both let go by the cell's edge
    const d = Math.hypot(dx, dy * 1.1);
    const bump = own === undefined ? 0 : 0.9 * Math.max(0, 1 - d / 20);
    const dry = own !== undefined && this.hardClass[own] === 0;
    const hold = dry ? 1.4 * Math.max(0, Math.min(1, (20 - d) / 7)) : 0;
    const s0 = this.spec.seed;
    let best = this.beyondK,
      score = -1e9;
    for (let k = 0; k < n; k++) {
      const w =
        (this.weights[i0 + k] ?? 0) * (1 - u) * (1 - v) +
        (this.weights[i1 + k] ?? 0) * u * (1 - v) +
        (this.weights[i2 + k] ?? 0) * (1 - u) * v +
        (this.weights[i3 + k] ?? 0) * u * v;
      if (w <= 0 && k !== own) continue;
      const s =
        w +
        vnoise(px, py, s0 + 25 + k * 7, 29) * 0.24 +
        vnoise(px, py, s0 + 21 + k * 7, 11) * 0.3 +
        vnoise(px, py, s0 + 23 + k * 7, 4) * 0.16 +
        (k === own ? bump : 0) -
        (this.hardClass[k] ? hold : 0);
      if (s > score) {
        score = s;
        best = k;
      }
    }
    return best;
  }

  /** The class the bake lays at plate px (x, y): a made shape where the rows build one, else the blend. */
  classAt(px: number, py: number): number {
    return this.madeAt(px, py)?.k ?? this.blendAt(px, py);
  }

  /** Whether plate px (x, y) is on a dug channel's kerb (ground within its kerb of made water). */
  kerbAt(px: number, py: number): boolean {
    const here = this.madeAt(px, py);
    if (here && here.def.draw !== 'deck') return false;
    const made = this.spec.made ?? {};
    for (const d of Object.values(made)) {
      if (d.draw !== 'water' || !d.kerb) continue;
      const r = d.kerb;
      for (const [ox, oy] of [
        [r, 0],
        [-r, 0],
        [0, r],
        [0, -r],
        [r, r],
        [-r, r],
        [r, -r],
        [-r, -r],
      ] as const) {
        const o = this.madeAt(px + ox, py + oy);
        if (o && o.def === d) return true;
      }
    }
    return false;
  }

  /**
   * How far into a terrace's cut face plate px (x, y) is (1 at its lit lip), or 0: the bottom `face` px of a terrace
   * cell whose south neighbour is neither terrace nor its steps.
   */
  terraceFace(px: number, py: number, made: MadePixel | undefined = this.madeAt(px, py)): number {
    const f = made?.def.draw === 'terrace' ? (made.def.face ?? 0) : 0;
    if (!made || !f) return 0;
    const ly = py - this.grid.y - made.cy * GROUND_CELL;
    if (ly < GROUND_CELL - f) return 0;
    const below = this.spec.made?.[this.charAt(made.cx, made.cy + 1)];
    if (below && (below.draw === 'terrace' || below.draw === 'steps')) return 0;
    return ly - (GROUND_CELL - f) + 1;
  }

  /** The ground at game world px (x, y), as the bake lays it (`validateTopDownLayout`). */
  classify = (x: number, y: number): PointClass => {
    const px = Math.floor(x - this.origin.x),
      py = Math.floor(y - this.origin.y);
    if (px < 0 || py < 0 || px >= this.plateW || py >= this.plateH)
      return { ground: 'void', terrain: 'V' };
    const made = this.madeAt(px, py);
    const k = made?.k ?? this.blendAt(px, py);
    const def = this.spec.classes[k];
    if (!def) return { ground: 'void', terrain: 'V' };
    if (made && this.terraceFace(px, py, made)) return { ground: 'face', terrain: def.terrain };
    if (def.reads === 'ground' && this.kerbAt(px, py))
      return { ground: 'ground', terrain: def.terrain, kerb: true };
    return { ground: def.reads, terrain: def.terrain };
  };

  /** The terrain as `TopDownLayout.terrain` takes it. */
  layer(): {
    kind: 'classified';
    classify: (x: number, y: number) => PointClass;
    mouths: readonly RimMouth[];
    mouthReach: number;
  } {
    return {
      kind: 'classified',
      classify: this.classify,
      mouths: this.spec.mouths,
      mouthReach: this.spec.mouthReach,
    };
  }
}

/**
 * Growth along every edge between a cell of `from` and its neighbour of `toward` on `sides` (the foot of a house's
 * back wall, the inside of the rim's tree line), as runs of whole edges: each a line `offset` cells off the edge
 * toward the `toward` cell, `width` cells across. Read from the rows, so the growth moves when the blockout does.
 */
export function edgeGrowth(
  id: string,
  rows: readonly string[],
  from: string,
  toward: string,
  sides: readonly MapEdgeSide[],
  offset: number,
  width: number,
  density: number,
): GroundGrowth[] {
  const at = (x: number, y: number): string => rows[y]?.[x] ?? '';
  const out: GroundGrowth[] = [];
  const step: Record<MapEdgeSide, readonly [number, number]> = {
    north: [0, -1],
    south: [0, 1],
    west: [-1, 0],
    east: [1, 0],
  };
  for (const side of sides) {
    const [dx, dy] = step[side];
    const horizontal = dy !== 0;
    const H = rows.length,
      W = rows[0]?.length ?? 0;
    for (let a = 0; a < (horizontal ? H : W); a++) {
      let run = -1;
      const flush = (end: number): void => {
        if (run < 0) return;
        const e = horizontal
          ? a + (dy > 0 ? 1 : 0) + dy * offset
          : a + (dx > 0 ? 1 : 0) + dx * offset;
        out.push({
          id: `${id}.${side}.${a}.${run}`,
          line: horizontal
            ? [
                [run, e],
                [end, e],
              ]
            : [
                [e, run],
                [e, end],
              ],
          width,
          density,
        });
        run = -1;
      };
      for (let b = 0; b <= (horizontal ? W : H); b++) {
        const x = horizontal ? b : a,
          y = horizontal ? a : b;
        const edge =
          from.includes(at(x, y)) &&
          at(x, y) !== '' &&
          toward.includes(at(x + dx, y + dy)) &&
          at(x + dx, y + dy) !== '';
        if (edge && run < 0) run = b;
        if (!edge) flush(b);
      }
    }
  }
  return out;
}

/** A road mouth: the walkable cells of an exit's cross-section at the map edge. */
export const groundMouth = (id: string, side: MapEdgeSide, cells: readonly Vec2[]): RimMouth => ({
  id,
  side,
  cells,
});
