/**
 * Register one reviewed continuous projected ground painting to the existing
 * west/east scene pages. Geometry comes only from the authoritative map: this
 * clips the source to its diamond and never infers terrain, surfaces or cliffs
 * from painted pixels.
 *
 * The reviewed source canvas is 1683x935, a 0.73046875-scale rendering of the
 * 2304x1280 technical guide. Its four declared corners map exactly to the
 * guide's projected map corners. This measured resampling is the only scale;
 * generic material atlases remain deliberately unsupported.
 *
 * Usage:
 *   node --import tsx scripts/art/projected-scene-ground-pack.ts \
 *     <ambush_road|quarry_floor> <reviewed-ground-source.png>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { AMBUSH_ROAD, QUARRY_FLOOR } from '../../src/content/maps/combat';
import type { MapDef } from '../../src/core/types';
import { newImage, pixelAt, readImage, setPixel, type Image } from './lib/image';
import { encodeWebp } from './lib/webp';

const PAGE_WIDTH = 1152;
const PAGE_HEIGHT = 1280;
const GUIDE_WIDTH = PAGE_WIDTH * 2;
const GUIDE_HEIGHT = PAGE_HEIGHT;
const MAP_ORIGIN = { x: 768, y: 0 };
const PAGE_ORIGIN = { x: -128, y: -192 };
const MAPS: Record<string, { readonly map: MapDef; readonly directory: string }> = {
  ambush_road: { map: AMBUSH_ROAD, directory: 'cutting-scene' },
  quarry_floor: { map: QUARRY_FLOOR, directory: 'driller-floor-scene' },
};

type Rgba = readonly [number, number, number, number];

const [mapId, sourcePath] = process.argv.slice(2);
if (!mapId || !sourcePath)
  throw new Error(
    'Usage: projected-scene-ground-pack.ts <ambush_road|quarry_floor> <reviewed-ground-source.png>',
  );
const target = MAPS[mapId];
if (!target) throw new Error(`Unknown map: ${mapId}`);
const source = readImage(sourcePath);
if (Math.abs(source.width / source.height - GUIDE_WIDTH / GUIDE_HEIGHT) > 0.001)
  throw new Error(
    `Expected the reviewed guide aspect ${GUIDE_WIDTH}:${GUIDE_HEIGHT}; received ${source.width}:${source.height}.`,
  );

function mapPoint(px: number, py: number): { x: number; y: number } {
  const worldX = px + PAGE_ORIGIN.x;
  const worldY = py + PAGE_ORIGIN.y;
  const diagonal = (worldX - MAP_ORIGIN.x) / 64;
  const sum = worldY / 32;
  return { x: (diagonal + sum) / 2, y: (sum - diagonal) / 2 };
}

function inMap(map: MapDef, point: { x: number; y: number }): boolean {
  return point.x >= 0 && point.x < map.width && point.y >= 0 && point.y < map.height;
}

function bilinear(image: Image, x: number, y: number): Rgba {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const samples = [
    [pixelAt(image, x0, y0), (1 - tx) * (1 - ty)],
    [pixelAt(image, x0 + 1, y0), tx * (1 - ty)],
    [pixelAt(image, x0, y0 + 1), (1 - tx) * ty],
    [pixelAt(image, x0 + 1, y0 + 1), tx * ty],
  ] as const;
  let red = 0;
  let green = 0;
  let blue = 0;
  let alpha = 0;
  for (const [rgba, weight] of samples) {
    const a = rgba[3] / 255;
    red += rgba[0] * a * weight;
    green += rgba[1] * a * weight;
    blue += rgba[2] * a * weight;
    alpha += a * weight;
  }
  if (alpha === 0) return [0, 0, 0, 0];
  return [
    Math.round(red / alpha),
    Math.round(green / alpha),
    Math.round(blue / alpha),
    Math.round(alpha * 255),
  ];
}

function sourcePoint(image: Image, px: number, py: number): Rgba {
  return bilinear(
    image,
    ((px + 0.5) * image.width) / GUIDE_WIDTH - 0.5,
    ((py + 0.5) * image.height) / GUIDE_HEIGHT - 0.5,
  );
}

/** The rejected candidates' only saturated pixels are generator edge contamination. */
function isFringe([red, green, blue, alpha]: Rgba): boolean {
  return (
    alpha > 0 &&
    ((red > 220 && green > 190 && blue < 105 && red - blue > 130 && green - blue > 85) ||
      (red > 210 && green < 115 && blue < 115 && red - green > 105))
  );
}

function edgeDistance(map: MapDef, point: { x: number; y: number }): number {
  return Math.min(point.x, point.y, map.width - point.x, map.height - point.y);
}

function repairedSample(
  map: MapDef,
  image: Image,
  px: number,
  py: number,
  point: { x: number; y: number },
): { readonly rgba: Rgba; readonly repaired: boolean } {
  const direct = sourcePoint(image, px, py);
  if (direct[3] >= 128 && (!isFringe(direct) || edgeDistance(map, point) > 0.14))
    return { rgba: direct, repaired: false };
  for (let radius = 1; radius <= 48; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const neighbor = mapPoint(px + dx, py + dy);
        if (!inMap(map, neighbor)) continue;
        const candidate = sourcePoint(image, px + dx, py + dy);
        if (candidate[3] >= 128 && !isFringe(candidate)) return { rgba: candidate, repaired: true };
      }
    }
  }
  throw new Error(`No non-fringe painted sample near projected map pixel ${px},${py}.`);
}

const pages = [0, 1].map(() => newImage(PAGE_WIDTH, PAGE_HEIGHT));
let opaquePixels = 0;
let repairedPixels = 0;
for (let py = 0; py < GUIDE_HEIGHT; py++) {
  for (let px = 0; px < GUIDE_WIDTH; px++) {
    const point = mapPoint(px, py);
    if (!inMap(target.map, point)) continue;
    const { rgba, repaired } = repairedSample(target.map, source, px, py, point);
    const page = pages[Math.floor(px / PAGE_WIDTH)];
    if (!page) throw new Error(`Missing output page for ${px},${py}.`);
    setPixel(page, px % PAGE_WIDTH, py, [rgba[0], rgba[1], rgba[2], 255]);
    opaquePixels++;
    if (repaired) repairedPixels++;
  }
}

let quality = 82;
let outputs: { readonly name: string; readonly bytes: Uint8Array }[] = [];
for (const candidate of [82, 78, 74, 70, 66, 62, 58]) {
  const encoded = await Promise.all(
    pages.map(async (page, index) => ({
      name: `ground-${index === 0 ? 'west' : 'east'}`,
      bytes: await encodeWebp(page, candidate, true),
    })),
  );
  if (encoded.reduce((total, output) => total + output.bytes.length, 0) <= 220 * 1024) {
    quality = candidate;
    outputs = encoded;
    break;
  }
}
if (outputs.length === 0)
  throw new Error(`${mapId} projected ground exceeds 220KiB at WebP quality 58.`);

const outDir = `public/art/maps/${target.directory}`;
mkdirSync(outDir, { recursive: true });
for (const output of outputs) writeFileSync(`${outDir}/${output.name}.webp`, output.bytes);
const registration = {
  map: target.map.id,
  source: sourcePath,
  sourcePixels: [source.width, source.height],
  guidePixels: [GUIDE_WIDTH, GUIDE_HEIGHT],
  guideScale: { x: GUIDE_WIDTH / source.width, y: GUIDE_HEIGHT / source.height },
  sourceCorners: {
    top: [source.width * 0.388889, source.height * 0.15],
    right: [source.width * 0.944444, source.height * 0.65],
    bottom: [source.width * 0.611111, source.height * 0.95],
    left: [source.width * 0.055556, source.height * 0.45],
  },
  guideCorners: { top: [896, 192], right: [2176, 832], bottom: [1408, 1216], left: [128, 576] },
  pagePixels: [PAGE_WIDTH, PAGE_HEIGHT],
  output: outputs.map((output) => ({ name: `${output.name}.webp`, bytes: output.bytes.length })),
  webpQuality: quality,
  opaquePixels,
  repairedFringePixels: repairedPixels,
  note: 'Exact map-diamond clip. Water, oil, mud and rubble remain live rules overlays; cliffs are separate scenery.',
};
mkdirSync(`art/raw/${mapId === 'ambush_road' ? 'cutting' : 'driller'}`, { recursive: true });
writeFileSync(
  `art/raw/${mapId === 'ambush_road' ? 'cutting' : 'driller'}/ground-registration.json`,
  JSON.stringify(registration, null, 2),
);
console.log(registration);
