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
 * key — a lit top facet in `#a89880` with the `#c2b49c` chip highlight along
 * its upper edge, a front facet in the `#857762` shadow — and each outlined in
 * the bible's `#1b1410` ink. Between the chunks and under the heap lies the
 * road's own packed earth in shade, §3's cart-rut `#7a5f3e` with loose
 * `#8e7049` dirt through it, which is the contact shadow that seats the heap on
 * the ground and the warm ground the chunks are piled on.
 *
 * The plate keeps its shipped 384x128 size and the heap stays inside the
 * cell's diamond, so the two `FOREST_RUBBLE_CELLS` placements in
 * `forestRoad.ts` are untouched and the scene's resolved-URL count against
 * `SCENE_IMAGE_CAP` does not move.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { FOREST_RUBBLE_CELLS } from '../../src/content/scenes/forestRoad';
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
 * The ground the pile spreads over: a low skirt of earth and spill round its
 * foot, wide enough to fill most of the plate so the heap owns its cell, and
 * the whole of it inside the cell's own diamond so the heap never reads as
 * spilling onto a neighbour. Plate pixels.
 */
export const RUBBLE_BED = { x: 192, y: 80, rx: 134, ry: 32 } as const;

/**
 * The share of chunks that are the road's own slabs, broken, rather than
 * quarry spoil: a heap beside a paved road is largely what the road was made of.
 */
export const SLAB_SHARE = 0.5;
/** How far below a chunk its contact shadow falls on the ground, in plate pixels. */
const SHADOW_PX = 2 * SCALE;

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
 * rows.
 */
export function rubbleChunks(): Chunk[] {
  const courses = [
    { y: 24, half: 16, count: 2, size: 0.8 },
    { y: 42, half: 64, count: 3, size: 0.9 },
    { y: 60, half: 96, count: 4, size: 1 },
    { y: 78, half: 112, count: 5, size: 1 },
    { y: 97, half: 84, count: 4, size: 0.9 },
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

/** Signed distance from the ground the heap sits on, in plate pixels: positive inside. */
export function rubbleBed(px: number, py: number): number {
  const dx = (px + 0.5 - RUBBLE_BED.x) / RUBBLE_BED.rx;
  const dy = (py + 0.5 - RUBBLE_BED.y) / RUBBLE_BED.ry;
  const angle = Math.atan2(dy, dx);
  // A wobble on whole-number harmonics of the angle, so the outline closes on
  // itself with no step where the angle wraps.
  const reach = 1 + 0.06 * Math.sin(4 * angle + 1.3) + 0.04 * Math.sin(7 * angle + 0.4);
  return (reach - Math.hypot(dx, dy)) * RUBBLE_BED.ry;
}

/**
 * The body of the pile above its bed, in plate pixels, positive inside: the
 * crown the chunks are stacked into. Wherever no chunk covers it, the camera
 * is looking into the gaps between them, which are in shade.
 */
export const RUBBLE_MOUND = { x: 192, y: 84, rx: 128, ry: 62 } as const;
export function rubbleMound(px: number, py: number): number {
  if (py + 0.5 > RUBBLE_MOUND.y) return -1;
  const dx = (px + 0.5 - RUBBLE_MOUND.x) / RUBBLE_MOUND.rx;
  const dy = (py + 0.5 - RUBBLE_MOUND.y) / RUBBLE_MOUND.ry;
  return (1 - Math.hypot(dx, dy)) * RUBBLE_MOUND.ry;
}

export function packRubble(material: ForestMaterial): Image {
  const { width, height } = FOREST_RUBBLE_PLATE;
  const image = newImage(width, height);
  const chunks = rubbleChunks();
  const keys = [FOREST_PIECE_TONES.spoil, FOREST_GROUND_TONES.road].map((tone) => ({
    top: parseHex(tone.base),
    front: parseHex(tone.shadow),
    chip: parseHex(tone.rim),
  }));
  const shade = parseHex(FOREST_PIECE_TONES.margin.shadow);
  const gap = parseHex(FOREST_PIECE_TONES.trodden.shadow);
  // The first rubble cell's own world box, so the bare ground is sampled in the
  // same logical space as the ground beside it and its incident is the same size.
  const cell = FOREST_RUBBLE_CELLS[0] ?? { x: 0, y: 0 };
  const box = {
    x: 768 + (cell.x - cell.y) * 64 - 64,
    y: (cell.x + cell.y + 1) * 32 - FOREST_RUBBLE_BOX.height,
  };

  // Which chunk, if any, is frontmost at each pixel: the later a chunk comes in
  // `rubbleChunks`, the nearer the camera, which is what piles them.
  const front = new Int16Array(width * height).fill(-1);
  const depthAt = new Float32Array(width * height);
  const along = new Float32Array(width * height);
  const covered = new Uint8Array(width * height);
  for (let py = 0; py < height; py++)
    for (let px = 0; px < width; px++) {
      const index = py * width + px;
      chunks.forEach((chunk, n) => {
        const { depth, v } = chunkDepth(chunk, px + 0.5, py + 0.5);
        if (depth > 0) {
          front[index] = n;
          depthAt[index] = depth;
          along[index] = v;
        }
      });
      covered[index] =
        (front[index] ?? -1) >= 0 || rubbleBed(px, py) > 0 || rubbleMound(px, py) > 0 ? 1 : 0;
    }
  const reach = Math.ceil(INK_PX);
  const nearOutside = (px: number, py: number): boolean => {
    for (let oy = -reach; oy <= reach; oy++)
      for (let ox = -reach; ox <= reach; ox++) {
        if (ox * ox + oy * oy > INK_PX * INK_PX) continue;
        const x = px + ox,
          y = py + oy;
        if (x < 0 || y < 0 || x >= width || y >= height || !covered[y * width + x]) return true;
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
      if (!covered[index]) continue;
      const n = front[index] ?? -1;
      const chunk = chunks[n];
      let rgb: Rgb;
      if (nearOutside(px, py)) {
        // The heap's silhouette carries the bible's full ink.
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
      } else {
        // Bare ground between the chunks. Directly under one it is in the
        // chunk's contact shadow; in the gaps up in the pile it is the earth's
        // own shade; elsewhere it is trodden earth, the road's warm key, read
        // through the lawn's rhythm rather than its flagstones.
        let shadowed = false;
        for (let up = 1; up <= SHADOW_PX && !shadowed; up++)
          if (py - up >= 0 && (front[(py - up) * width + px] ?? -1) >= 0) shadowed = true;
        if (shadowed) rgb = shade;
        else if (rubbleMound(px, py) > 0) rgb = gap;
        else {
          const worldX = box.x + (px + 0.5) / SCALE;
          const worldY = box.y + (py + 0.5) / SCALE;
          const dx = (worldX - 768) / 64,
            dy = worldY / 32;
          rgb = material.colour('trodden', (dx + dy) / 2, (dy - dx) / 2);
        }
      }
      setPixel(image, px, py, [rgb[0], rgb[1], rgb[2], 255]);
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
