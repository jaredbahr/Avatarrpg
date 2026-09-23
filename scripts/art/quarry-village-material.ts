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
 * Five ground materials, so no region of the floor can be a single swatch,
 * and the forest pond's two water keys for the Cutting's pool:
 *
 * | material    | where it lands                                             |
 * | ----------- | ---------------------------------------------------------- |
 * | `limestone` | the cut floor under the oil pools, the gate's paving       |
 * | `block`     | the `^`/`A` ledge diamonds — cut stone block face          |
 * | `earth`     | the packed-earth floor and the lanes                       |
 * | `wear`      | haul ruts and the mud patch                                |
 * | `spoil`     | the gate terrace, the Cutting's shoulders, cover spill and |
 * |             | the small decorative mounds                                |
 * | `margin`    | the Cutting pool's damp margin and wet bank                |
 * | `bed`       | the Cutting pool's bed and waterline                       |
 *
 * Nothing here writes to the village. The two plates are opened read-only.
 */
import {
  bindPalette,
  FOREST_PIECE_TONES,
  loadVillageCrops,
  SPOIL_TONES,
  type CropName,
  type Rgb,
  type ToneSpec,
  type VillagePalette,
} from './forest-village-material';
import { parseHex } from './lib/image';
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
  /** The route's one spoil row (`SPOIL_TONES`), shared with the forest's heaps. */
  spoil: SPOIL_TONES,
  /**
   * The Cutting's pool, in the forest pond's own keys so the route has one
   * water language: §3's damp margin and bed, read from the table the forest
   * shoreline paints with rather than restated here.
   */
  margin: FOREST_PIECE_TONES.margin,
  bed: FOREST_PIECE_TONES.bed,
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
  margin: 'lawn',
  bed: 'lawn',
};
/** Distinct tiling hashes, so two materials sharing a crop still draw unlike incident. */
const SALT_OF: Record<QuarryTone, number> = {
  limestone: 11,
  block: 43,
  earth: 17,
  wear: 59,
  rut: 83,
  spoil: 71,
  // The forest pond's own salts, so the Cutting's bank and bed draw the same
  // incident the forest's do (`forest-village-material.ts`).
  margin: 47,
  bed: 59,
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
 * smooth field's contour wanders. A quarry's spoil is *piles* — discrete,
 * scattered where carts turned. So a heap is anchored to a cell chosen by
 * `tileNoise`, offset and sized from the same hash, and its rim is wobbled by
 * angle so no two read as the same drawn oval. Because the anchor is a cell,
 * the distance only has to be searched over the 3x3 neighbourhood.
 */
export const HEAP_SHARE = 0.9;

/**
 * These heaps are decoration: ground texture, not objects. The DL-2 W5 gate
 * found the board reading backwards — whole inked limestone heaps, bigger and
 * brighter than anything else, on ground where the real cover (legend `r`, which
 * grants cover and costs movement) showed only as a faint diamond. So a
 * decorative heap is now about half its W3/W4 size, carries no ink, and is
 * painted in the spoil row alone: a flat body with the chip highlight along its
 * lit upper edge and the spoil shadow along its front. It reads as a low mound
 * of grit in the ground; the inked heap standing on every `r` cell
 * (`forest-rubble.ts`'s plate) is what reads as a pile.
 */
export const HEAP_SCALE = 0.55;
/** Chip-highlight rim along a heap's lit upper edge, in tiles. */
export const HEAP_RIM = 0.035;
/** Shaded front of a heap: how far in from its edge the spoil shadow reaches, in tiles. */
export const HEAP_SHADE = 0.06;
/**
 * Clear ground a heap keeps from any cell it does not fit on, in tiles: the
 * packers' soft join between two floor materials feathers up to 0.19 of a tile
 * into each, and the ink and pale rim at a hard edge are about 0.06, so a mound
 * nearer than this would be speckled or cut by that edge.
 */
export const HEAP_CLEARANCE = 0.2;

/**
 * The heap nearest a point: its signed distance, its centre, its base radius
 * and how far from that centre any of its paint can reach. A packer uses the
 * reach to keep a heap off a boundary it would otherwise be cut by.
 */
export interface NearestHeap {
  readonly distance: number;
  readonly hx: number;
  readonly hy: number;
  readonly radius: number;
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
      const base = HEAP_SCALE * (0.22 + 0.2 * tileNoise(cx, cy, 44));
      const radius =
        base * (1 + 0.22 * Math.sin(Math.atan2(dy, dx) * 3 + 9 * tileNoise(cx, cy, 45)));
      const distance = Math.hypot(dx, dy) - radius;
      if (!found || distance < found.distance)
        found = { distance, hx, hy, radius: base, reach: base * 1.22 + HEAP_CLEARANCE };
    }
  return found;
}

/**
 * Whether the heap nearest a point lies wholly on ground that can carry it:
 * every cell its paint can reach must pass `carries`. A packer passes "plain
 * spoil" or "plain floor" in its own reading of the map. A heap near a lane
 * edge, a ledge, a wall base or a cover cell would otherwise be cut by that
 * boundary into a sliver; one that does not fit is left out whole rather than
 * clipped. The Cutting, the Driller floor and the gate share this rule so they
 * cannot drift.
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

/**
 * Which of the spoil row's three flat tones a point of a decorative heap takes,
 * or null off every heap. Up-screen is decreasing `x + y`, so the lit edge is
 * the half of the outline with `x + y` below the heap's centre.
 */
export function heapClass(x: number, y: number): 'base' | 'shadow' | 'rim' | null {
  const heap = nearestHeap(x, y);
  if (!heap || heap.distance >= 0) return null;
  const front = x - heap.hx + (y - heap.hy);
  if (front < 0 && heap.distance > -HEAP_RIM) return 'rim';
  if (front > 0 && heap.distance > -HEAP_SHADE * Math.min(1, front / heap.radius + 0.3))
    return 'shadow';
  return 'base';
}

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
  /** A decorative spoil heap's flat tone at a point, or null off every heap. */
  readonly heapMark: (x: number, y: number) => Rgb | null;
  /**
   * A cover heap's spill where it lies on spoil: the spoil row the other way
   * up, so the fresh grit round the heap's foot shows on a spoil shoulder.
   */
  readonly spillMark: (x: number, y: number) => Rgb;
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
  // Read from the table, never restated: a change to §3's spoil row is one edit.
  const spoil = QUARRY_GROUND_TONES.spoil;
  const heapTones = {
    base: parseHex(spoil.base),
    shadow: parseHex(spoil.shadow),
    rim: parseHex(spoil.rim),
  } as const;
  return {
    ...palette,
    heapMark(x: number, y: number): Rgb | null {
      const cls = heapClass(x, y);
      return cls ? heapTones[cls] : null;
    },
    spillMark(x: number, y: number): Rgb {
      const cls = palette.classOf('spoil', x, y);
      return cls === 'rim' ? heapTones.rim : cls === 'shadow' ? heapTones.base : heapTones.shadow;
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
