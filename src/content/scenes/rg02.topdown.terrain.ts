/**
 * Saltstep and Emberwatch's top-down terrain (RG-02, ADR 0104 §3): one classifier for the region's boards, as a pure
 * function of each map's authored rows. The ground packer (`scripts/art/topdown/boards/rg02.ts`) bakes its plates
 * from it and the content validation reads it through `classify`; the shipped runtime never imports it.
 *
 * Like the Forest Road's (`forestRoad.topdown.terrain.ts`), every pixel is classed from 32 px vertices that sample the
 * 40 px cells, blended between them and broken by two octaves of value noise, so no edge follows the cell grid. A
 * bump round each cell's centre, gone by the cell's edge, keeps the cell's own class where a figure stands (the rules win). Outside the
 * grid the rows run on: an edge cell's class carries on to the plate's side, and the rim (`T`) is the void the map
 * edge falls into (ADR 0103).
 *
 * The plate runs two cells past the grid either side, three above and two below, as the Act I boards' do.
 */
import type { MapEdgeSide, Vec2 } from '../../core/types';
import { hash2, vnoise, type PointClass, type RimMouth } from './baDan.topdown.terrain';

export { hash2, vnoise };

export const TILE = 32;
export const CELL = 40;
/** The grid's top-left in plate px. */
export const GRID = { x: 80, y: 120 } as const;

/**
 * The classes the bake lays: the harbour, the planks, the quay's sand, packed earth, flagstones, a puddle, the void, and
 * the countryside's grass (the river road). A new class is appended, so the coast's boards bake byte for byte as before.
 */
export const RG = {
  water: 0,
  deck: 1,
  sand: 2,
  earth: 3,
  stone: 4,
  puddle: 5,
  void: 6,
  grass: 7,
} as const;
export type RgClass = (typeof RG)[keyof typeof RG];
const CLASSES: readonly RgClass[] = [0, 1, 2, 3, 4, 5, 6, 7];

/** One RG-02 board's terrain: its map's rows and what each character is drawn as. */
export interface Rg02TerrainConfig {
  readonly mapId: string;
  readonly rows: readonly string[];
  /** The class each row character is drawn as; a character not listed is packed earth. */
  readonly chars: Readonly<Record<string, RgClass>>;
  /** What lies past the grid where the rows do not carry on (the harbour, or the void). */
  readonly beyond: RgClass;
  /** Row characters that carry on only one cell past the grid, not to the plate's edge (a yard's clutter on its rim). */
  readonly ends?: string;
  readonly mouths: readonly RimMouth[];
  /**
   * What packed earth reads as to the checks: soil (`G`, the coast's yards and verges, where trees root) or a dirt road
   * (`D`, the river road's, which its mouth must run out on while the grass is the soil).
   */
  readonly earthTerrain?: 'G' | 'D';
  /**
   * Raised ground (the river road's cliff and lookout rise): the row characters drawn as a rock mass standing above
   * the ground, each with its height in tiers. A mass's stone is its top; its bottom `FACE_TIER` px a tier, in each
   * column, are its cut face, which nothing stands on. A character not listed (a ramp) is flat stone with no face.
   */
  readonly raised?: Readonly<Record<string, number>>;
  /** The raised characters whose top no one climbs (the cliff): their top reads as rock, so their cells are blocked terrain. */
  readonly rock?: string;
}

/** A tier of cut face, in plate px: the quarry's `Q_FACE` (`TOPDOWN_FACE_OVERHANG`), as a terrace's. */
export const FACE_TIER = 13;
/**
 * How far a face's foot hangs past its raised cell's south edge, on average: inside `TOPDOWN_FACE_OVERHANG`'s reach over
 * the top of the cell below, and clear of the samples where a figure stands there (12 px either side of the centre).
 */
const FACE_OVERHANG_FOOT = 12;

/** Where the raised masses are: the plate box they and their faces lie in, and per pixel of it the mass and its face. */
interface Masses {
  readonly x0: number;
  readonly y0: number;
  readonly w: number;
  readonly h: number;
  /** The tiers of the mass this pixel's stone belongs to, or 0. */
  readonly tiers: Uint8Array;
  /** 0, or the row of the cut face this pixel is (1 its lit lip, `faceH` its foot). */
  readonly face: Uint8Array;
  readonly faceH: Uint8Array;
  /** 1 where the mass's top is rock (a cliff). */
  readonly rock: Uint8Array;
}

export class Rg02Terrain {
  readonly gw: number;
  readonly gh: number;
  readonly plateW: number;
  readonly plateH: number;
  /** The plate's top-left in game world px. */
  readonly origin: Vec2;
  private readonly vw: number;
  private readonly weights: Float32Array;
  private masses: Masses | null | undefined;

  constructor(readonly config: Rg02TerrainConfig) {
    this.gh = config.rows.length;
    this.gw = config.rows[0]?.length ?? 0;
    this.plateW = GRID.x * 2 + this.gw * CELL;
    this.plateH = GRID.y + this.gh * CELL + 2 * CELL;
    this.origin = { x: -GRID.x, y: -GRID.y };
    this.vw = Math.ceil(this.plateW / TILE) + 1;
    const vh = Math.ceil(this.plateH / TILE) + 1;
    this.weights = new Float32Array(this.vw * vh * CLASSES.length);
    for (let vy = 0; vy < vh; vy++)
      for (let vx = 0; vx < this.vw; vx++)
        this.weights[(vy * this.vw + vx) * CLASSES.length + this.charClass(vx * TILE, vy * TILE)] =
          1;
  }

  /** The class the rows give plate px (x, y): an edge cell's class carries on past the grid. */
  charClass(px: number, py: number): RgClass {
    const cx = Math.floor((px - GRID.x) / CELL),
      cy = Math.floor((py - GRID.y) / CELL);
    const x = Math.max(0, Math.min(this.gw - 1, cx)),
      y = Math.max(0, Math.min(this.gh - 1, cy));
    const c = this.config.rows[y]?.[x] ?? '';
    const k = this.config.chars[c] ?? RG.earth;
    // the rows carry on past the grid only where they lead somewhere: the rim and the void end there
    if ((cx !== x || cy !== y) && k === RG.void) return this.config.beyond;
    if (Math.max(Math.abs(cx - x), Math.abs(cy - y)) > 1 && this.config.ends?.includes(c))
      return this.config.beyond;
    return k;
  }

  /** The class at cell (x, y) of the rows, or undefined off the grid. */
  cellClass(x: number, y: number): RgClass | undefined {
    if (x < 0 || y < 0 || x >= this.gw || y >= this.gh) return undefined;
    return this.config.chars[this.config.rows[y]?.[x] ?? ''] ?? RG.earth;
  }

  /** The class the bake lays at plate px (x, y), inside the plate. */
  classAt(px: number, py: number): RgClass {
    const tx = Math.floor(px / TILE),
      ty = Math.floor(py / TILE),
      u = (px - tx * TILE + 0.5) / TILE,
      v = (py - ty * TILE + 0.5) / TILE;
    const n = CLASSES.length;
    const i0 = (ty * this.vw + tx) * n,
      i1 = i0 + n,
      i2 = ((ty + 1) * this.vw + tx) * n,
      i3 = i2 + n;
    const cx = Math.floor((px - GRID.x) / CELL),
      cy = Math.floor((py - GRID.y) / CELL);
    const own = this.cellClass(cx, cy);
    const dx = px - (GRID.x + cx * CELL + CELL / 2),
      dy = py - (GRID.y + cy * CELL + CELL / 2);
    // a soft bump keeps each cell's own class round its centre; on ground, water and the void are also held off a
    // flat core out past a figure's half width (12 px), so a narrow deck between two arms of the harbour still carries
    // its figure. Both let go by the cell's edge, where anything left over would snap the boundary to the grid line.
    const d = Math.hypot(dx, dy * 1.1);
    const bump = own === undefined ? 0 : 0.9 * Math.max(0, 1 - d / 20);
    const dry = own !== undefined && own !== RG.water && own !== RG.void;
    const hold = dry ? 1.4 * Math.max(0, Math.min(1, (20 - d) / 7)) : 0;
    let best: RgClass = RG.earth,
      score = -1e9;
    for (const k of CLASSES) {
      const w =
        (this.weights[i0 + k] ?? 0) * (1 - u) * (1 - v) +
        (this.weights[i1 + k] ?? 0) * u * (1 - v) +
        (this.weights[i2 + k] ?? 0) * (1 - u) * v +
        (this.weights[i3 + k] ?? 0) * u * v;
      if (w <= 0 && k !== own) continue;
      const s =
        w +
        vnoise(px, py, 21 + k * 7, 11) * 0.3 +
        vnoise(px, py, 23 + k * 7, 4) * 0.16 +
        (k === own ? bump : 0) -
        (k === RG.water || k === RG.void ? hold : 0);
      if (s > score) {
        score = s;
        best = k;
      }
    }
    return best;
  }

  /** The row character that owns cell (x, y), clamped onto the grid as the rows carry on past it. */
  private charAt(cx: number, cy: number): string {
    const x = Math.max(0, Math.min(this.gw - 1, cx)),
      y = Math.max(0, Math.min(this.gh - 1, cy));
    return this.config.rows[y]?.[x] ?? '';
  }

  /**
   * The row character a stone pixel belongs to: its own cell's, or for stone bulging out of a stone cell into its
   * neighbour, the nearest stone cell's.
   */
  private stoneOwner(px: number, py: number): string {
    const cx = Math.floor((px - GRID.x) / CELL),
      cy = Math.floor((py - GRID.y) / CELL);
    const own = this.charAt(cx, cy);
    if ((this.config.chars[own] ?? RG.earth) === RG.stone) return own;
    let best = 1e9,
      owner = '';
    for (let oy = -1; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const ch = this.charAt(cx + ox, cy + oy);
        if ((this.config.chars[ch] ?? RG.earth) !== RG.stone) continue;
        const x0 = GRID.x + (cx + ox) * CELL,
          y0 = GRID.y + (cy + oy) * CELL;
        const d = Math.hypot(
          Math.max(x0 - px, 0, px - (x0 + CELL - 1)),
          Math.max(y0 - py, 0, py - (y0 + CELL - 1)),
        );
        if (d < best) {
          best = d;
          owner = ch;
        }
      }
    return owner;
  }

  /** The column's face height for a mass of `tiers`: `FACE_TIER` px a tier, its lip ragged by a couple of px. */
  faceHeight(px: number, tiers: number): number {
    return tiers * FACE_TIER + Math.round(vnoise(px, 0, 141, 9) * 2 + vnoise(px, 0, 142, 3));
  }

  /** The raised masses and their faces, worked out once over the box round the raised cells (null with none). */
  private massMap(): Masses | null {
    if (this.masses !== undefined) return this.masses;
    const raised = this.config.raised ?? {};
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    this.config.rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (!raised[ch]) return;
        // a mass on the grid's edge carries on to the plate's side, as the rows do
        minX = Math.min(minX, x === 0 ? -99 : x - 1);
        maxX = Math.max(maxX, x === this.gw - 1 ? 999 : x + 1);
        minY = Math.min(minY, y === 0 ? -99 : y - 1);
        maxY = Math.max(maxY, y === this.gh - 1 ? 999 : y + 2);
      }),
    );
    if (minX === Infinity) return (this.masses = null);
    const x0 = Math.max(0, GRID.x + minX * CELL),
      y0 = Math.max(0, GRID.y + minY * CELL);
    const x1 = Math.min(this.plateW, GRID.x + (maxX + 1) * CELL),
      y1 = Math.min(this.plateH, GRID.y + (maxY + 1) * CELL);
    const w = x1 - x0,
      h = y1 - y0;
    const tiers = new Uint8Array(w * h),
      face = new Uint8Array(w * h),
      faceH = new Uint8Array(w * h),
      rock = new Uint8Array(w * h);
    const rockChars = this.config.rock ?? '';
    // the raw mass: the stone that belongs to a raised cell
    const raw = new Uint8Array(w * h),
      rawRock = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const px = x0 + x,
          py = y0 + y;
        if (this.classAt(px, py) !== RG.stone) continue;
        const owner = this.stoneOwner(px, py);
        const t = raised[owner] ?? 0;
        raw[y * w + x] = t;
        if (t && owner && rockChars.includes(owner)) rawRock[y * w + x] = 1;
      }
    // its outline smoothed: the ground's noise leaves spikes and notches a few px across, which on a standing mass
    // read as slivers of face down its sides, so the mass is the raw one blurred over a 9 px box and cut at half
    const R = 4;
    const sum = new Int32Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        sum[(y + 1) * (w + 1) + x + 1] =
          ((raw[y * w + x] ?? 0) > 0 ? 1 : 0) +
          (sum[y * (w + 1) + x + 1] ?? 0) +
          (sum[(y + 1) * (w + 1) + x] ?? 0) -
          (sum[y * (w + 1) + x] ?? 0);
    const boxed = (x: number, y: number): number => {
      const ax = Math.max(0, x - R),
        ay = Math.max(0, y - R),
        bx = Math.min(w, x + R + 1),
        by = Math.min(h, y + R + 1);
      const n = (bx - ax) * (by - ay);
      return (
        ((sum[by * (w + 1) + bx] ?? 0) -
          (sum[ay * (w + 1) + bx] ?? 0) -
          (sum[by * (w + 1) + ax] ?? 0) +
          (sum[ay * (w + 1) + ax] ?? 0)) /
        n
      );
    };
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (boxed(x, y) < 0.5) continue;
        // a pixel the smoothing adds takes the tiers of the raw mass nearest it
        let t = raw[y * w + x] ?? 0,
          r = rawRock[y * w + x] ?? 0;
        for (let d = 1; !t && d <= R; d++)
          for (const [ox, oy] of [
            [d, 0],
            [-d, 0],
            [0, d],
            [0, -d],
          ] as const) {
            const X = x + ox,
              Y = y + oy;
            if (X < 0 || Y < 0 || X >= w || Y >= h || !(raw[Y * w + X] ?? 0)) continue;
            t = raw[Y * w + X] ?? 0;
            r = rawRock[Y * w + X] ?? 0;
            break;
          }
        tiers[y * w + x] = t;
        rock[y * w + x] = r;
      }
    // the cut faces, the quarry's way (`TOPDOWN_FACE_OVERHANG`): along the south edge of every raised cell whose
    // neighbour below is lower ground, the face hangs over the top of the cell below, its foot wandering a few px
    // either side of `FACE_OVERHANG_FOOT` so it never rules a straight line nor reaches where a figure stands there; a
    // face taller than its overhang rises the rest of the way into the raised cell. A column joins the face where the
    // mass comes down to the edge; above it the mass is filled to the lip, and below the foot it ends.
    const charRaised = (cx: number, cy: number): number => raised[this.charAt(cx, cy)] ?? 0;
    const isStoneChar = (cx: number, cy: number): boolean =>
      (this.config.chars[this.charAt(cx, cy)] ?? RG.earth) === RG.stone;
    for (let x = 0; x < w; x++) {
      const px = x0 + x;
      const cx = Math.floor((px - GRID.x) / CELL);
      const cyLo = Math.floor((y0 - GRID.y) / CELL) - 1,
        cyHi = Math.floor((y0 + h - GRID.y) / CELL);
      for (let cy = cyLo; cy <= cyHi; cy++) {
        // the raised cell this column's face belongs to: its own, or beside a ramp-free gap the nearest raised one
        let owner = -1;
        if (charRaised(cx, cy)) owner = cx;
        else if (!isStoneChar(cx, cy)) {
          // a mass's side bulges a few px into its neighbour, never further
          const lx = px - (GRID.x + cx * CELL);
          const n = lx < 10 ? cx - 1 : lx >= CELL - 10 ? cx + 1 : null;
          if (n !== null && charRaised(n, cy)) owner = n;
        }
        if (owner < 0 || charRaised(owner, cy + 1) || isStoneChar(owner, cy + 1)) continue;
        // the clamped rows carry on past the grid: a face only where the lower ground is on the plate
        const t = charRaised(owner, cy);
        const E = GRID.y + (cy + 1) * CELL - y0;
        if (E < 0 || E >= h) continue;
        // beside a ramp (a flat stone cell level with the top) the face falls away to nothing over half a cell
        const ox = px - (GRID.x + owner * CELL);
        const toRamp = Math.min(
          isStoneChar(owner - 1, cy) && !charRaised(owner - 1, cy) ? ox : Infinity,
          isStoneChar(owner + 1, cy) && !charRaised(owner + 1, cy) ? CELL - 1 - ox : Infinity,
        );
        const H = Math.round(this.faceHeight(px, t) * Math.min(1, (toRamp + 1) / 20));
        if (H < 2) continue;
        const foot =
          E +
          FACE_OVERHANG_FOOT +
          Math.round(vnoise(px, 0, 143, 17) * 4 + vnoise(px, 0, 144, 5) * 1.5);
        const lip = Math.max(0, foot - H);
        // the mass must come down to the edge in this column (a notch in its side leaves no face)
        let reach = -1;
        for (let y = E - 12; y <= E + 4; y++)
          if (y >= 0 && y < h && (tiers[y * w + x] ?? 0) > 0) reach = y;
        if (reach < 0) continue;
        let top = reach;
        while (top > 0 && (tiers[(top - 1) * w + x] ?? 0) > 0) top--;
        if (top > lip - 2) continue;
        const r = rock[top * w + x] ?? 0;
        for (let y = Math.max(0, top); y < Math.min(h, foot + 1); y++) {
          tiers[y * w + x] = t;
          rock[y * w + x] = r;
          if (y >= lip) {
            face[y * w + x] = y - lip + 1;
            faceH[y * w + x] = foot - lip + 1;
          }
        }
        for (let y = foot + 1; y < Math.min(h, foot + CELL / 2); y++) {
          tiers[y * w + x] = 0;
          rock[y * w + x] = 0;
        }
      }
    }
    return (this.masses = { x0, y0, w, h, tiers, face, faceH, rock });
  }

  /** The plate box the raised masses lie in, or null with none. */
  massBox(): { x0: number; y0: number; x1: number; y1: number } | null {
    const m = this.massMap();
    return m ? { x0: m.x0, y0: m.y0, x1: m.x0 + m.w, y1: m.y0 + m.h } : null;
  }

  /**
   * The raised mass at plate px (x, y): its tiers (0 off any mass), how far into its cut face the pixel is (0 on the
   * top, 1 at the lit lip, `faceH` at the foot), and whether its top is rock.
   */
  massAt(px: number, py: number): { tiers: number; face: number; faceH: number; rock: boolean } {
    const m = this.massMap();
    const x = px - (m?.x0 ?? 0),
      y = py - (m?.y0 ?? 0);
    if (!m || x < 0 || y < 0 || x >= m.w || y >= m.h)
      return { tiers: 0, face: 0, faceH: 0, rock: false };
    const i = y * m.w + x;
    return {
      tiers: m.tiers[i] ?? 0,
      face: m.face[i] ?? 0,
      faceH: m.faceH[i] ?? 0,
      rock: (m.rock[i] ?? 0) === 1,
    };
  }

  /** The ground at game world px (x, y), as the bake lays it (`validateTopDownLayout`). */
  classify = (x: number, y: number): PointClass => {
    const px = Math.floor(x - this.origin.x),
      py = Math.floor(y - this.origin.y);
    if (px < 0 || py < 0 || px >= this.plateW || py >= this.plateH)
      return { ground: 'void', terrain: 'V' };
    if (this.config.raised) {
      const m = this.massAt(px, py);
      if (m.face) return { ground: 'face', terrain: 'C' };
      if (m.rock) return { ground: 'rock', terrain: 'C' };
      if (m.tiers) return { ground: 'ground', terrain: 'C' };
    }
    const c = this.classAt(px, py);
    if (c === RG.water) return { ground: 'water', terrain: 'W' };
    if (c === RG.void) return { ground: 'void', terrain: 'V' };
    if (c === RG.stone) return { ground: 'ground', terrain: 'C' };
    if (c === RG.grass) return { ground: 'ground', terrain: 'G' };
    if (c === RG.earth) return { ground: 'ground', terrain: this.config.earthTerrain ?? 'G' };
    return { ground: 'ground', terrain: 'D' };
  };
}

/** A road mouth: the walkable cells of an exit's cross-section at the map edge. */
export const mouth = (id: string, side: MapEdgeSide, cells: readonly Vec2[]): RimMouth => ({
  id,
  side,
  cells,
});
/** From an edge cell's centre to the plate's side: two and a half cells. */
export const MOUTH_REACH = 3;
