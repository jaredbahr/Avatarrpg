/**
 * The quarry's ground material, re-derived from the village's accepted art.
 *
 * DL-2 W3. The Driller floor and the quarry gate used to tile a generated
 * six-panel quarry sheet — the third of the three independent atlases §2 of
 * `SUBSYSTEMS/dl2-ground-language-plan.md` blames for the drift. That sheet's
 * key is a neutral cracked grey and a tan with no ink edge, which is why the
 * floor reads as one uniform mid-brown plane with flat grey diamonds on it
 * (design-audit defect 12) and the gate reads as a fourth ground family
 * (defect 32).
 *
 * Nothing is generated here. The structure comes from the same two approved
 * village plates W2 used, through the shared machinery in
 * `forest-village-material.ts`; what is applied is the DL-2 §3 ground table.
 * The village's plaza *is* limestone paving, so its flagstone joints are the
 * correct structure for a quarry's cut floor rather than an approximation of
 * one — the provenance is exact, not merely convenient.
 *
 * Five materials, so no region of the floor can be a single swatch:
 *
 * | material    | where it lands                                  |
 * | ----------- | ----------------------------------------------- |
 * | `limestone` | the cut floor under the oil pools, the gate terrace |
 * | `block`     | the `^`/`A` ledge diamonds — cut stone block face   |
 * | `earth`     | the packed-earth floor and the gate road            |
 * | `wear`      | haul ruts and the mud patch                         |
 * | `spoil`     | rubble, the gate's off-road ground, floor spoil heaps |
 *
 * Nothing here writes to the village. The two plates are opened read-only.
 */
import {
  bindPalette,
  loadVillageCrops,
  type CropName,
  type Rgb,
  type ToneSpec,
  type VillagePalette,
} from './forest-village-material';
import { tileNoise } from '../../src/render/painters/shapes';

/**
 * DL-2 §3, the one ground language, for the quarry's half of it. Exactly two
 * flat tones per material plus one thin pale rim; the two cut-stone families
 * also name the darkest slice, which becomes the joint line and the tool mark.
 */
export const QUARRY_GROUND_TONES = {
  limestone: { base: '#d8cbb0', shadow: '#b3a488', rim: '#efe6d2', joint: '#9a8c72' },
  block: { base: '#cfc2a6', shadow: '#a2957c', rim: '#efe6d2', joint: '#8a7d66' },
  earth: { base: '#b39064', shadow: '#8e7049', rim: '#c7a87d' },
  wear: { base: '#a6845a', shadow: '#7a5f3e', rim: '#c7a87d' },
  /** §3's cart-rut `#7a5f3e`, as the thin trodden core of a haul track. */
  rut: { base: '#8e7049', shadow: '#7a5f3e', rim: '#c7a87d' },
  spoil: { base: '#a89880', shadow: '#857762', rim: '#c2b49c' },
} as const satisfies Record<string, ToneSpec>;
export type QuarryTone = keyof typeof QUARRY_GROUND_TONES;

/**
 * Which accepted crop supplies each material's structure. The four dressed or
 * trodden materials take the western approach's broad paving, whose flagstone
 * rhythm is the incident a cut floor and a cart road both want; spoil takes the
 * courtyard lawn, whose looser, tuftier marks read as chipped stone once the
 * green is replaced by the spoil tones.
 */
const CROP_OF: Record<QuarryTone, CropName> = {
  limestone: 'paving',
  block: 'paving',
  earth: 'paving',
  wear: 'paving',
  rut: 'paving',
  spoil: 'lawn',
};
/** Distinct tiling hashes, so two materials sharing a crop still draw unlike incident. */
const SALT_OF: Record<QuarryTone, number> = {
  limestone: 11,
  block: 43,
  earth: 17,
  wear: 59,
  rut: 83,
  spoil: 71,
};

/**
 * WebP quality for the re-keyed quarry plates. As in the forest, there is no
 * photographic texture left to preserve — a handful of flat tones and an ink
 * line survive a lower setting intact — and the map family sits against its
 * 4 MiB budget (`scripts/check-asset-budget.mjs`).
 */
export const QUARRY_GROUND_QUALITY = 34;

/**
 * Smooth value noise on a unit lattice, for incident that has to span more than
 * one cell: a spoil heap is a shape on the floor, not a property of a tile, so
 * it cannot come from `tileNoise` alone without reading as a checker.
 */
export function fieldNoise(x: number, y: number, salt: number): number {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy);
  const a = tileNoise(ix, iy, salt),
    b = tileNoise(ix + 1, iy, salt);
  const c = tileNoise(ix, iy + 1, salt),
    d = tileNoise(ix + 1, iy + 1, salt);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

/**
 * Signed distance, in tiles, from the nearest spoil heap: negative inside.
 *
 * Thresholding a smooth field made long snaking blobs, because near its level a
 * smooth field's contour wanders. A quarry's spoil is *piles* — discrete, about
 * a tile across, scattered where carts turned. So a heap is anchored to a cell
 * chosen by `tileNoise`, offset and sized from the same hash, and its rim is
 * wobbled by angle so no two read as the same drawn oval. Because the anchor is
 * a cell, the distance only has to be searched over the 3x3 neighbourhood.
 */
export const HEAP_SHARE = 0.9;

/**
 * The heap nearest a point: its signed distance, its centre, and how far from
 * that centre any of its paint — body, ink and chip rim — can reach. A packer
 * uses the reach to keep a heap off a boundary it would otherwise be cut by.
 */
export interface NearestHeap {
  readonly distance: number;
  readonly hx: number;
  readonly hy: number;
  readonly reach: number;
}

export function nearestHeap(x: number, y: number): NearestHeap | null {
  let found: NearestHeap | null = null;
  const ix = Math.floor(x),
    iy = Math.floor(y);
  for (let cy = iy - 1; cy <= iy + 1; cy++)
    for (let cx = ix - 1; cx <= ix + 1; cx++) {
      if (tileNoise(cx, cy, 41) <= HEAP_SHARE) continue;
      const hx = cx + 0.2 + 0.6 * tileNoise(cx, cy, 42);
      const hy = cy + 0.2 + 0.6 * tileNoise(cx, cy, 43);
      const dx = x - hx,
        dy = y - hy;
      const base = 0.22 + 0.2 * tileNoise(cx, cy, 44);
      const radius =
        base * (1 + 0.22 * Math.sin(Math.atan2(dy, dx) * 3 + 9 * tileNoise(cx, cy, 45)));
      const distance = Math.hypot(dx, dy) - radius;
      if (!found || distance < found.distance)
        found = { distance, hx, hy, reach: base * 1.22 + HEAP_INK + HEAP_RIM };
    }
  return found;
}

/**
 * Whether the heap nearest a point lies wholly on ground that can carry it:
 * every cell its paint can reach must pass `carries`. A packer passes "plain
 * spoil" in its own reading of the map. A heap near a lane edge, a ledge, a
 * wall base or a cover cell would otherwise be cut by that boundary into a
 * sliver, or into ink specks through a feathered join; one that does not fit
 * is left out whole rather than clipped. The Cutting and the gate share this
 * rule so the two cannot drift.
 */
export function heapFits(
  x: number,
  y: number,
  carries: (cellX: number, cellY: number) => boolean,
): boolean {
  const heap = nearestHeap(x, y);
  if (!heap) return false;
  for (let cy = Math.floor(heap.hy - heap.reach); cy <= Math.floor(heap.hy + heap.reach); cy++)
    for (let cx = Math.floor(heap.hx - heap.reach); cx <= Math.floor(heap.hx + heap.reach); cx++)
      if (!carries(cx, cy)) return false;
  return true;
}

function heapDistance(x: number, y: number): number {
  return nearestHeap(x, y)?.distance ?? Infinity;
}

/** Ink half-width and chip-rim width around a heap, in tiles. */
export const HEAP_INK = 0.022;
export const HEAP_RIM = 0.05;

/**
 * The haul tracks: a thin trodden core in §3's cart-rut tone with a wider
 * scuffed shoulder either side, so the pair draws a track rather than merely
 * tinting the plane the way W2's forest ruts did.
 */
export const RUT_CORE = 0.075;
export const RUT_HALF = 0.28;

/**
 * The painted incident inside an otherwise plain region. This is what keeps the
 * Driller's 60%-of-frame earth plane and the gate's terrace from being one
 * swatch each, and it is decoration on the page only — no map row, cell key or
 * collision moves.
 */
export interface QuarryMaterial extends VillagePalette<QuarryTone> {
  /** Where a spoil heap lies: its interior, its ink edge, its chip rim. */
  readonly heapMark: (x: number, y: number) => 'inside' | 'ink' | 'rim' | null;
  /** Where a haul track runs: its trodden core and its scuffed shoulder. */
  readonly trackMark: (x: number, y: number) => 'rut' | 'wear' | null;
}

/**
 * The haul tracks. Carts leave the Driller's rear loading stub at the north-east
 * and the gate's road runs east-west, so a single pair of wandering lines along
 * x, the way W2 laid the forest's ruts, reads correctly in both.
 */
function rutDistance(x: number, y: number, track: Track): number {
  const wander = 0.34 * Math.sin(x * 0.61) + 0.17 * Math.sin(x * 1.9 + 1.4);
  return Math.min(
    Math.abs(y - (track.centre - track.offset) - wander),
    Math.abs(y - (track.centre + track.offset) + wander),
  );
}

/**
 * Where the pair of haul tracks runs. The Driller's carts cross the open floor,
 * so its pair straddles the board's centre a tile either side; the gate's road
 * is two rows wide, so its pair runs inside those rows.
 */
export interface Track {
  readonly centre: number;
  readonly offset: number;
}

export async function loadQuarryMaterial(track: Track): Promise<QuarryMaterial> {
  const palette = bindPalette(await loadVillageCrops(), QUARRY_GROUND_TONES, CROP_OF, SALT_OF);
  return {
    ...palette,
    heapMark(x: number, y: number): 'inside' | 'ink' | 'rim' | null {
      const heap = heapDistance(x, y);
      if (heap < -HEAP_INK) return 'inside';
      // The heap carries the bible's edge in its own right: the acceptance asks
      // for no region wider than a quarter of the frame without painted
      // incident, and an unoutlined patch of near-tone would not be incident.
      if (heap < HEAP_INK) return 'ink';
      return heap < HEAP_INK + HEAP_RIM ? 'rim' : null;
    },
    trackMark(x: number, y: number): 'rut' | 'wear' | null {
      const rut = rutDistance(x, y, track);
      if (rut < RUT_CORE) return 'rut';
      if (rut < RUT_HALF) return 'wear';
      // Occasional scuffed cells away from the tracks, as in the forest.
      return tileNoise(Math.floor(x), Math.floor(y), 29) > 0.9 ? 'wear' : null;
    },
  };
}

export type { Rgb };
