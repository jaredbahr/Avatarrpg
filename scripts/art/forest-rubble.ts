/**
 * Pack the forest road's two rubble heaps.
 *
 *   node --import tsx scripts/art/forest-rubble.ts
 *
 * `rubble.webp` had no packer at all: it was committed straight out of the
 * generation pass that dressed the forest road (`bd70d2d`), and it kept that
 * pass's cold grey slabs over desert ochre grit. Once W2 re-keyed the route and
 * its verges to the village's hand, the two cells this plate is drawn into —
 * (7,3) and (8,9) — were the coldest thing on the board.
 *
 * The plate is a heap of broken stone, not a floor: a pile of separate chunks,
 * the higher ones further back, each in the DL-2 §3 **quarry spoil / rubble**
 * key — a lit top facet in `#c7a87d` with the `#d8cbb0` chip highlight along
 * its upper edge, a front facet in the `#8e7049` shadow — and each outlined in
 * the bible's `#1b1410` ink. Between the chunks lies packed earth in shade,
 * and under the heap's foot its contact shadow in §3's cart-rut `#7a5f3e`.
 *
 * **The heap sits in the grass.** It used to lie on a hole: the route and grass
 * plates left both rubble cells clear, so the bare terrain showed round the
 * heap as a flat diamond with ruled edges. Now the heap's ground is laid in the
 * ground plates themselves (`forest-route-ground.ts`, `forest-grass-regions.ts`
 * ask `spillAt`): the spill of grit and chips the heap has shed, in the §3
 * spoil key through the lawn's structure (the forest's `spill` tone, the same
 * material as the quarry's spoil terrace). It covers the cell the live rubble
 * wash lies on and carries on past the cell's edges, and over a wide band it
 * breaks up into the verge in clumps and round the lawn's own painted tufts,
 * the way the pond's dry margin feathers out rather than stopping on a line —
 * never along the cell's diamond. The plate keeps only what stands on that
 * ground: the pile and its contact shadow (`looseStones` may add a stone or two
 * at its front, but none has room there today). Only those objects carry the
 * bible's ink; the ground does not.
 *
 * The plate keeps its shipped 384x128 size and everything on it stays inside
 * the cell's diamond, so the two `FOREST_RUBBLE_CELLS` placements in
 * `forestRoad.ts` are untouched and the scene's resolved-URL count against
 * `SCENE_IMAGE_CAP` does not move.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { FOREST_RUBBLE_CELLS } from '../../src/content/scenes/forestRoad';
import type { Vec2 } from '../../src/core/types';
import { tileNoise } from '../../src/render/painters/shapes';
import { newImage, parseHex, setPixel } from './lib/image';
import type { Image } from './lib/image';
import { encodeWebp } from './lib/webp';
import {
  FOREST_GROUND_QUALITY,
  FOREST_GROUND_TONES,
  FOREST_PIECE_TONES,
  loadForestMaterial,
} from './forest-village-material';
import type { ForestMaterial, Rgb } from './forest-village-material';

/** The shipped plate, and the scene box it is drawn into, from `forestRoad.ts`. */
export const FOREST_RUBBLE_PLATE = { width: 384, height: 128 } as const;
export const FOREST_RUBBLE_BOX = { width: 128, height: 128 / 3 } as const;
/** Plate pixels per world pixel. */
const SCALE = FOREST_RUBBLE_PLATE.width / FOREST_RUBBLE_BOX.width;
/** The heap's outline is the bible's 2 px; a chunk's own outline is a little finer. */
const INK_PX = 2 * SCALE;
const CHUNK_INK_PX = SCALE;
/** The chip highlight, inside a chunk's lit upper edge. */
const CHIP_PX = SCALE;

export const FOREST_RUBBLE_OUTPUT = 'public/art/maps/forest-scene/rubble.webp';

/**
 * The cell's own diamond in plate pixels: the box is the diamond's full width
 * and the middle two thirds of its height, so the diamond's half-height is one
 * and a half times the plate's half-height.
 */
const DIAMOND = {
  x: FOREST_RUBBLE_PLATE.width / 2,
  y: FOREST_RUBBLE_PLATE.height / 2,
  rx: FOREST_RUBBLE_PLATE.width / 2,
  ry: FOREST_RUBBLE_PLATE.height * 0.75,
} as const;

/** Loose stones stay this far inside the cell's diamond, plate pixels. */
const DIAMOND_MARGIN = 2 * SCALE;

/**
 * The spill round a heap's foot, in logical cells about the rubble cell's
 * centre: the ground the heap has shed its grit and chips onto. About the
 * cell's own size, so it covers the cell the live rubble wash lies on, and
 * wobbled by whole-number harmonics of the angle so its outline is no drawn
 * shape; across `feather` either side of that outline the spill breaks up into
 * the grass (`spillAt`).
 */
export const SPILL = { radius: 0.66, wobble: 0.08, feather: 0.26 } as const;
/**
 * Across the feather, where the spill starts to win: past `SPILL_FROM` of the
 * band at the soonest, later in a clump of lawn the `SPILL_CLUMP` noise holds
 * together, and later again on one of the lawn's own painted tufts — tufts are
 * the lawn's incident, so they are what survives longest as the grass gives way
 * to the spill. One clump is about an eighth of a cell across.
 */
const SPILL_FROM = 0.1;
const SPILL_CLUMP = 0.6;
const TUFT_HOLD = 0.22;
const CLUMPS_PER_CELL = 8;

/**
 * The share of chunks that are the road's own slabs, broken, rather than
 * quarry spoil: a heap beside a paved road is largely what the road was made of.
 */
export const SLAB_SHARE = 0.5;
/** How far below a chunk its contact shadow falls on the ground, in plate pixels. */
const SHADOW_PX = 2 * SCALE;
/** A loose stone's contact shadow is half that. */
const STONE_SHADOW_PX = SCALE;

/** One chunk of broken stone. Plate pixels. */
export interface Chunk {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
  /**
   * Broken, so an irregular polygon: each corner's angle round the chunk and
   * its distance out, in units of the chunk's radii.
   */
  readonly corners: readonly { readonly angle: number; readonly reach: number }[];
  /** How far down the chunk its lit top facet reaches, -1..1 of its height. */
  readonly split: number;
  /** Broken road slab rather than quarry spoil. */
  readonly slab: boolean;
}

/**
 * The pile, back to front. Five courses, each narrower and higher than the
 * one in front of it, so the heap rises to a crown instead of lying flat; a
 * chunk's place and size wander by a seeded hash so the courses do not read as
 * rows. The foot is a rounded mound well inside the cell: courses that ran out
 * to the cell's own edges gave the pile the cell's diamond for a silhouette,
 * which is what made it read as a tile pasted on the grass.
 */
export function rubbleChunks(): Chunk[] {
  const courses = [
    { y: 26, half: 14, count: 2, size: 0.8 },
    { y: 42, half: 50, count: 3, size: 0.85 },
    { y: 58, half: 78, count: 4, size: 0.95 },
    { y: 74, half: 92, count: 5, size: 0.95 },
    { y: 90, half: 58, count: 4, size: 0.85 },
  ];
  const chunks: Chunk[] = [];
  courses.forEach((course, row) => {
    for (let i = 0; i < course.count; i++) {
      const n = (salt: number): number => tileNoise(row, i, salt);
      const across = course.count === 1 ? 0 : (i / (course.count - 1)) * 2 - 1;
      chunks.push({
        x: RUBBLE_MOUND.x + across * course.half + (n(1) - 0.5) * 18,
        y: course.y + (n(2) - 0.5) * 8,
        rx: (30 + 12 * n(3)) * course.size,
        ry: (15 + 5 * n(4)) * course.size,
        corners: chunkCorners(row * 8 + i),
        split: 0.05 + 0.3 * n(7),
        slab: n(8) < SLAB_SHARE,
      });
    }
  });
  return chunks;
}

/**
 * Loose stones that have rolled off the pile: small chunks of the same two
 * kinds on the ground at the front of its foot. Candidate spots are drawn by a
 * seeded hash across the band in front of the pile, and a stone is kept only
 * where it lies clear of the pile and of the stones already kept, wholly inside
 * the cell's diamond, and well away from the diamond's side corners — a stone
 * in a corner reads as a rivet marking the cell's outline, which is exactly the
 * diamond the spill is there to hide. If none fits, there are none.
 */
export const LOOSE_STONES = { candidates: 400, keep: 6 } as const;
export function looseStones(): Chunk[] {
  const pile = rubbleChunks();
  const stones: Chunk[] = [];
  for (let i = 0; i < LOOSE_STONES.candidates && stones.length < LOOSE_STONES.keep; i++) {
    const n = (salt: number): number => tileNoise(i, 7, salt);
    const size = 1 + 0.45 * n(3);
    const stone: Chunk = {
      x: DIAMOND.x + (n(1) - 0.5) * DIAMOND.rx * 2,
      y: RUBBLE_MOUND.y + n(2) * (FOREST_RUBBLE_PLATE.height - RUBBLE_MOUND.y),
      rx: 9 * size,
      ry: 5 * size,
      corners: chunkCorners(100 + i),
      split: 0.1 + 0.2 * n(4),
      slab: n(5) < SLAB_SHARE,
    };
    if (stoneFits(stone, pile, stones)) stones.push(stone);
  }
  return stones;
}

/** How far out from the cell's centre a loose stone may reach, as a share of the half-width. */
export const STONE_REACH = 0.55;

function stoneFits(stone: Chunk, pile: readonly Chunk[], kept: readonly Chunk[]): boolean {
  if (Math.abs(stone.x - DIAMOND.x) + stone.rx > DIAMOND.rx * STONE_REACH) return false;
  const pad = INK_PX + 2;
  // Room for the stone's ink and contact shadow, and a stone's width from any
  // other, so two never read as one blot.
  for (let step = 0; step < 16; step++) {
    const turn = (step / 16) * 2 * Math.PI;
    const ex = stone.x + Math.cos(turn) * stone.rx * 1.12,
      ey = stone.y + Math.sin(turn) * (stone.ry * 1.12 + STONE_SHADOW_PX);
    if (diamondDepth(ex, ey) < DIAMOND_MARGIN || ey < 1 || ey >= FOREST_RUBBLE_PLATE.height - 1)
      return false;
    const px = ex + Math.cos(turn) * pad,
      py = ey + Math.sin(turn) * pad;
    if (rubbleMound(px, py) > -pad && py <= RUBBLE_MOUND.y) return false;
    if (pile.some((chunk) => chunkDepth(chunk, px, py).depth > -pad)) return false;
    if (kept.some((other) => chunkDepth(other, px, py).depth > -stone.rx)) return false;
  }
  return true;
}

/**
 * Five to seven corners, spaced evenly round the chunk and then pushed a little
 * off that spacing and in or out, so no two chunks are the same stone.
 */
function chunkCorners(seed: number): { angle: number; reach: number }[] {
  const sides = 5 + Math.floor(tileNoise(seed, 0, 91) * 3);
  const sector = (2 * Math.PI) / sides;
  const turn = tileNoise(seed, 0, 92) * sector;
  return Array.from({ length: sides }, (_, i) => ({
    angle: turn + (i + (tileNoise(seed, i, 93) - 0.5) * 0.4) * sector,
    reach: 0.86 + 0.24 * tileNoise(seed, i, 94),
  }));
}

/**
 * How far inside a chunk a plate pixel is, in plate pixels (negative outside),
 * and where it sits on the chunk's height. A chunk is a stretched polygon, so
 * it has the flat faces and corners of broken stone rather than a pebble's
 * curve, and because its outline is a closed chain of straight sides there is
 * no seam where the angle wraps.
 */
function chunkDepth(chunk: Chunk, px: number, py: number): { depth: number; v: number } {
  const dx = (px - chunk.x) / chunk.rx;
  const dy = (py - chunk.y) / chunk.ry;
  const angle = Math.atan2(dy, dx);
  const corners = chunk.corners;
  const first = corners[0]?.angle ?? 0;
  const turn = (((angle - first) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  let side = corners.length - 1;
  for (let i = 1; i < corners.length; i++)
    if ((corners[i]?.angle ?? 0) - first > turn) {
      side = i - 1;
      break;
    }
  // Where the ray from the centre at this angle leaves the chunk: across the
  // straight side between the two corners either side of it.
  const a = corners[side] ?? { angle: 0, reach: 1 };
  const b = corners[(side + 1) % corners.length] ?? a;
  const ax = a.reach * Math.cos(a.angle),
    ay = a.reach * Math.sin(a.angle);
  const ex = b.reach * Math.cos(b.angle) - ax,
    ey = b.reach * Math.sin(b.angle) - ay;
  const cross = Math.cos(angle) * ey - Math.sin(angle) * ex;
  const reach = Math.abs(cross) < 1e-9 ? 1 : (ax * ey - ay * ex) / cross;
  const rho = Math.hypot(dx, dy);
  // Divided by the gradient of `rho`, so the depth is in plate pixels on the
  // chunk's long sides as well as its short ones and its outline is even.
  const slope = Math.hypot(dx / chunk.rx, dy / chunk.ry) / Math.max(rho, 1e-6);
  return { depth: (reach - rho) / Math.max(slope, 1e-6), v: dy / reach };
}

/** Distance inside the cell's diamond, plate pixels: positive inside. */
function diamondDepth(px: number, py: number): number {
  const u = Math.abs(px - DIAMOND.x) / DIAMOND.rx;
  const v = Math.abs(py - DIAMOND.y) / DIAMOND.ry;
  return (1 - u - v) / Math.hypot(1 / DIAMOND.rx, 1 / DIAMOND.ry);
}

/**
 * The body of the pile above its foot, in plate pixels, positive inside: the
 * crown the chunks are stacked into. Wherever no chunk covers it, the camera
 * is looking into the gaps between them, which are in shade.
 */
export const RUBBLE_MOUND = { x: 192, y: 80, rx: 104, ry: 58 } as const;
export function rubbleMound(px: number, py: number): number {
  if (py + 0.5 > RUBBLE_MOUND.y) return -1;
  const dx = (px + 0.5 - RUBBLE_MOUND.x) / RUBBLE_MOUND.rx;
  const dy = (py + 0.5 - RUBBLE_MOUND.y) / RUBBLE_MOUND.ry;
  return (1 - Math.hypot(dx, dy)) * RUBBLE_MOUND.ry;
}

/** Smooth value noise on a unit lattice: clumps, not per-pixel speckle. */
function clumpNoise(x: number, y: number): number {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy);
  const a = tileNoise(ix, iy, 61),
    b = tileNoise(ix + 1, iy, 61);
  const c = tileNoise(ix, iy + 1, 61),
    d = tileNoise(ix + 1, iy + 1, 61);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

/**
 * How far inside the nearest heap's spill a logical point lies, in cells:
 * positive inside its outline. The forest's two heaps by default; the quarry
 * scenes pass their own `r` cells (`quarry-route-ground.ts`), so every heap on
 * the route stands on the same spill.
 */
export function spillDepth(
  x: number,
  y: number,
  cells: readonly Vec2[] = FOREST_RUBBLE_CELLS,
): number {
  let best = -Infinity;
  for (const cell of cells) {
    const dx = x - (cell.x + 0.5),
      dy = y - (cell.y + 0.5);
    const angle = Math.atan2(dy, dx);
    const phase = 2 * Math.PI * tileNoise(cell.x, cell.y, 67);
    const reach =
      SPILL.radius *
      (1 + SPILL.wobble * Math.sin(3 * angle + phase) + 0.6 * SPILL.wobble * Math.sin(5 * angle));
    best = Math.max(best, reach - Math.hypot(dx, dy));
  }
  return best;
}

/**
 * Whether a logical point is heap spill rather than the verge. The route and
 * grass plates ask this wherever they would paint verge, so the spill is laid
 * in the ground itself, at the ground's own pixel grain, and the heap's plate
 * stands on it. Inside the feather the spill wins only where it is deep enough
 * past the lawn at that point: a clump of lawn and a painted tuft both hold out
 * longer than open lawn, so the edge breaks up in the grass's own shapes rather
 * than following a drawn outline — and never along the cell's diamond.
 */
export function spillAt(material: ForestMaterial, x: number, y: number): boolean {
  const depth = spillDepth(x, y);
  return spillWins(depth, x, y, () => material.classOf('verge', x, y) !== 'base');
}

/**
 * The spill's own edge, for any ground: `depth` from `spillDepth`, and `tuft`
 * saying whether the ground being given way has painted incident at the point
 * (the verge's tufts in the forest, the earth floor's flagstone marks in the
 * quarry), which holds out longest.
 */
export function spillWins(depth: number, x: number, y: number, tuft: () => boolean): boolean {
  if (depth >= SPILL.feather) return true;
  if (depth <= -SPILL.feather) return false;
  const across = (depth + SPILL.feather) / (2 * SPILL.feather);
  const hold =
    SPILL_FROM +
    SPILL_CLUMP * clumpNoise(x * CLUMPS_PER_CELL, y * CLUMPS_PER_CELL) +
    (tuft() ? TUFT_HOLD : 0);
  return across > hold;
}

export function packRubble(material: ForestMaterial): Image {
  const { width, height } = FOREST_RUBBLE_PLATE;
  const image = newImage(width, height);
  const chunks = rubbleChunks();
  const stones = looseStones();
  const keys = [FOREST_PIECE_TONES.spoil, FOREST_GROUND_TONES.road].map((tone) => ({
    top: parseHex(tone.base),
    front: parseHex(tone.shadow),
    chip: parseHex(tone.rim),
  }));
  const shade = parseHex(FOREST_PIECE_TONES.margin.shadow);
  const gap = parseHex(FOREST_PIECE_TONES.trodden.shadow);

  // Which chunk, if any, is frontmost at each pixel: the later a chunk comes in
  // `rubbleChunks`, the nearer the camera, which is what piles them. Loose
  // stones lie on the ground clear of the pile, so they follow it.
  const all = [...chunks, ...stones];
  const front = new Int16Array(width * height).fill(-1);
  const depthAt = new Float32Array(width * height);
  const along = new Float32Array(width * height);
  const heap = new Uint8Array(width * height);
  for (let py = 0; py < height; py++)
    for (let px = 0; px < width; px++) {
      const index = py * width + px;
      all.forEach((chunk, n) => {
        const { depth, v } = chunkDepth(chunk, px + 0.5, py + 0.5);
        if (depth > 0) {
          front[index] = n;
          depthAt[index] = depth;
          along[index] = v;
        }
      });
      const n = front[index] ?? -1;
      // The pile proper: its chunks and the shaded body they are stacked into.
      heap[index] = (n >= 0 && n < chunks.length) || rubbleMound(px, py) > 0 ? 1 : 0;
    }

  // The pile's silhouette carries the bible's full ink wherever it meets the
  // ground: an object standing on the ground. The ground itself does not.
  const reach = Math.ceil(INK_PX);
  const heapEdge = (px: number, py: number): boolean => {
    for (let oy = -reach; oy <= reach; oy++)
      for (let ox = -reach; ox <= reach; ox++) {
        if (ox * ox + oy * oy > INK_PX * INK_PX) continue;
        const x = px + ox,
          y = py + oy;
        if (x < 0 || y < 0 || x >= width || y >= height || !heap[y * width + x]) return true;
      }
    return false;
  };

  const restsOn = (px: number, py: number, n: number): boolean => {
    const r = Math.ceil(CHUNK_INK_PX);
    for (let oy = -r; oy <= r; oy++)
      for (let ox = -r; ox <= r; ox++) {
        const x = px + ox,
          y = py + oy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const other = front[y * width + x] ?? -1;
        if (other >= 0 && other !== n) return true;
      }
    return false;
  };

  for (let py = 0; py < height; py++)
    for (let px = 0; px < width; px++) {
      const index = py * width + px;
      const n = front[index] ?? -1;
      const chunk = all[n];
      let rgb: Rgb | null = null;
      if (heap[index] && heapEdge(px, py)) {
        rgb = material.ink;
      } else if (chunk) {
        const key = keys[chunk.slab ? 1 : 0] ?? keys[0]!;
        const depth = depthAt[index] ?? 0;
        const v = along[index] ?? 0;
        if (depth < CHUNK_INK_PX)
          // Against bare ground a chunk carries ink; where it rests on the
          // chunk behind it, the crack between them is in shade.
          rgb = restsOn(px, py, n) ? shade : material.ink;
        else if (v < chunk.split)
          // The lit top facet, with the chip highlight along its upper edge.
          rgb = v < 0 && depth < CHUNK_INK_PX + CHIP_PX ? key.chip : key.top;
        else rgb = key.front;
      } else if (heap[index]) {
        // Up in the pile, between the chunks: the earth's own shade.
        rgb = gap;
      } else {
        // On the ground: directly under a chunk or a loose stone it is in that
        // stone's contact shadow. Everywhere else the plate is clear, and the
        // spill the route and grass plates lay round the heap shows through.
        for (let up = 1; up <= SHADOW_PX && !rgb; up++) {
          const above = py - up >= 0 ? (front[(py - up) * width + px] ?? -1) : -1;
          if (above >= 0 && (above < chunks.length || up <= STONE_SHADOW_PX)) rgb = shade;
        }
      }
      if (rgb) setPixel(image, px, py, [rgb[0], rgb[1], rgb[2], 255]);
    }
  return image;
}

export async function main(): Promise<void> {
  const image = packRubble(await loadForestMaterial());
  mkdirSync('public/art/maps/forest-scene', { recursive: true });
  const bytes = await encodeWebp(image, FOREST_GROUND_QUALITY, true);
  writeFileSync(FOREST_RUBBLE_OUTPUT, bytes);
  console.log({ width: image.width, height: image.height, bytes: bytes.length });
}

if (process.argv[1]?.endsWith('forest-rubble.ts')) await main();
