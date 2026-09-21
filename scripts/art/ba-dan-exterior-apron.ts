/**
 * Paint the ground outside the Ba Dan board.
 *
 * The village's authored pieces cover the playable diamond; outside it the page
 * showed through, so the rim read as the edge of a board rather than the edge of
 * a village. This plate carries the terrain that borders the rim outward: the
 * same grass the procedural cells paint, continued for about a tile where the
 * outermost logical cell is road or paving, then faded out over the next tile so
 * the page wash takes over gradually.
 *
 * Nothing here touches a playable pixel — every sample inside the board stays
 * transparent, which `ba-dan-exterior-apron.test.ts` asserts.
 *
 * npx tsx scripts/art/ba-dan-exterior-apron.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { BA_DAN_VILLAGE } from '../../src/content/maps/village';
import { BA_DAN_APRON_MAP, BA_DAN_EXTERIOR_APRON } from '../../src/content/scenes/baDan';
import { TERRAIN_STYLES } from '../../src/render/palettes';
import { tileNoise } from '../../src/render/painters/shapes';
import { newImage, parseHex, pixelAt, setPixel } from './lib/image';
import type { Image } from './lib/image';
import { encodeWebp } from './lib/webp';

export const OUTPUT = 'public/art/maps/ba-dan-scene/exterior-apron.webp';
/** Terrain is fully faded out by this far outside the rim, in logical tiles. */
export const APRON_FADE = 2.2;
/** The outer cell's road or paving is carried this far before meadow takes over. */
export const MATERIAL_REACH = 1.15;
const TILE_PX = 64;
/** The projection's origin in local pixels, matching the scene's own pieces. */
const ORIGIN = 1024;

type Terrain = 'grass' | 'road' | 'stone';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Local image pixels to logical map coordinates; the inverse of the projection. */
export function apronLogical(px: number, py: number): { x: number; y: number } {
  const dx = (BA_DAN_EXTERIOR_APRON.x + px + 0.5 - ORIGIN) / 64;
  const dy = (BA_DAN_EXTERIOR_APRON.y + py + 0.5) / 32;
  return { x: (dx + dy) / 2, y: (dy - dx) / 2 };
}

/** The plate's pixel for a logical map point; the forward projection. */
export function apronPixel(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.round(ORIGIN + (x - y) * 64 - BA_DAN_EXTERIOR_APRON.x - 0.5),
    y: Math.round((x + y) * 32 - BA_DAN_EXTERIOR_APRON.y - 0.5),
  };
}

/** How far outside the board this point is, in logical tiles; 0 on the board. */
export function apronDepth(x: number, y: number): number {
  const { width, height } = BA_DAN_APRON_MAP;
  return Math.max(-x, x - width, -y, y - height);
}

/** The terrain of the board cell this exterior point borders, and its depth. */
export function apronBorders(x: number, y: number): { terrain: Terrain; depth: number } {
  const { width, height, rows } = BA_DAN_VILLAGE;
  const column = clamp(Math.floor(x), 0, width - 1);
  const row = clamp(Math.floor(y), 0, height - 1);
  const sides = [
    { depth: -x, cell: rows[row]?.[0] },
    { depth: x - width, cell: rows[row]?.[width - 1] },
    { depth: -y, cell: rows[0]?.[column] },
    { depth: y - height, cell: rows[height - 1]?.[column] },
  ];
  const nearest = sides.reduce((best, side) => (side.depth > best.depth ? side : best));
  const key = nearest.cell ?? ',';
  const terrain: Terrain =
    key === '=' ? 'road' : key === '.' || key === 'l' || key === 'B' ? 'stone' : 'grass';
  return { terrain, depth: nearest.depth };
}

/** A glyph of detail: half the material colour and half the detail ink. */
function blend(image: Image, px: number, py: number, detail: readonly number[]): void {
  if (px < 0 || py < 0 || px >= image.width || py >= image.height) return;
  const [r, g, b, a] = pixelAt(image, px, py);
  if (a === 0) return;
  setPixel(image, px, py, [
    Math.round(r * 0.5 + (detail[0] ?? 0) * 0.5),
    Math.round(g * 0.5 + (detail[1] ?? 0) * 0.5),
    Math.round(b * 0.5 + (detail[2] ?? 0) * 0.5),
    a,
  ]);
}

/**
 * The tile painter's own detail pass, at 50% over the terrain fill: four short
 * blades on grass, two or three pebbles on road and paving. Positions come from
 * the same hash over the cell's logical coordinates, so the density and rhythm
 * outside the board match the cells inside it.
 */
function paintDetail(
  image: Image,
  left: number,
  top: number,
  tile: { x: number; y: number },
  salt: number,
  terrain: Terrain,
  detail: readonly number[],
): void {
  const size = TILE_PX;
  const nx = tileNoise(tile.x, tile.y, salt * 3 + 1);
  const ny = tileNoise(tile.x, tile.y, salt * 3 + 2);
  const nr = tileNoise(tile.x, tile.y, salt * 3 + 3);
  if (terrain === 'grass') {
    const x = Math.round(left + nx * size);
    const y = Math.round(top + ny * size - size * 0.06);
    const width = Math.max(1, Math.round(size * 0.02));
    const height = Math.round(size * 0.08 + nr * size * 0.04);
    for (let py = y; py < y + height; py++)
      for (let px = x; px < x + width; px++) blend(image, px, py, detail);
    return;
  }
  const cx = left + nx * size;
  const cy = top + ny * size;
  const radius = size * (0.02 + nr * 0.03);
  for (let py = Math.floor(cy - radius); py <= Math.ceil(cy + radius); py++)
    for (let px = Math.floor(cx - radius); px <= Math.ceil(cx + radius); px++)
      if ((px - cx) ** 2 + (py - cy) ** 2 <= radius * radius) blend(image, px, py, detail);
}

export function packApron(): Image {
  const image = newImage(BA_DAN_EXTERIOR_APRON.width, BA_DAN_EXTERIOR_APRON.height);
  const terrains: Record<Terrain, readonly number[]> = {
    grass: parseHex(TERRAIN_STYLES.grass.fill),
    road: parseHex(TERRAIN_STYLES.road.fill),
    stone: parseHex(TERRAIN_STYLES.stone.fill),
  };
  const details: Record<Terrain, readonly number[]> = {
    grass: parseHex(TERRAIN_STYLES.grass.detail),
    road: parseHex(TERRAIN_STYLES.road.detail),
    stone: parseHex(TERRAIN_STYLES.stone.detail),
  };
  for (let py = 0; py < image.height; py++) {
    for (let px = 0; px < image.width; px++) {
      const { x, y } = apronLogical(px, py);
      const depth = apronDepth(x, y);
      if (depth <= 0 || depth >= APRON_FADE) continue;
      const { terrain } = apronBorders(x, y);
      const weight = 1 - smoothstep(0.08, MATERIAL_REACH, depth);
      // Two octaves of the tile hash keep the field from reading as flat paint,
      // and the slow recession keeps the far edge from shouting at the page.
      // Both fade in from the rim, so the board's own edge is not drawn again as
      // a line between flat procedural ground and its grained continuation.
      const settle = smoothstep(0, 0.35, depth);
      const grain =
        1 + settle * ((tileNoise(px, py, 7) - 0.5) * 0.09 + (tileNoise(px, py, 11) - 0.5) * 0.05);
      const recession = 1 - 0.1 * smoothstep(0.1, APRON_FADE, depth);
      const grass = terrains.grass;
      const outer = terrains[terrain];
      const shade = (channel: 0 | 1 | 2): number =>
        clamp(
          Math.round(
            ((grass[channel] ?? 0) * (1 - weight) + (outer[channel] ?? 0) * weight) *
              grain *
              recession,
          ),
          0,
          255,
        );
      const alpha = Math.round(255 * (1 - smoothstep(0.05, APRON_FADE, depth)));
      setPixel(image, px, py, [shade(0), shade(1), shade(2), alpha]);
    }
  }
  const { width, height } = BA_DAN_APRON_MAP;
  for (let i = -3; i <= width + 3; i++) {
    for (let j = -3; j <= height + 3; j++) {
      if (i >= 0 && i < width && j >= 0 && j < height) continue;
      const centerX = ORIGIN + (i - j) * TILE_PX - BA_DAN_EXTERIOR_APRON.x;
      const centerY = (i + j + 1) * 32 - BA_DAN_EXTERIOR_APRON.y;
      const { terrain, depth } = apronBorders(i + 0.5, j + 0.5);
      if (depth <= 0 || depth >= APRON_FADE) continue;
      const box = { cx: centerX - TILE_PX / 2, cy: centerY - TILE_PX / 2 };
      const count = terrain === 'grass' ? 4 : terrain === 'stone' ? 3 : 2;
      for (let k = 0; k < count; k++)
        paintDetail(image, box.cx, box.cy, { x: i, y: j }, k, terrain, details[terrain]);
    }
  }
  return image;
}

if (process.argv[1]?.endsWith('ba-dan-exterior-apron.ts')) {
  mkdirSync('public/art/maps/ba-dan-scene', { recursive: true });
  writeFileSync(OUTPUT, await encodeWebp(packApron(), 82, true));
}
