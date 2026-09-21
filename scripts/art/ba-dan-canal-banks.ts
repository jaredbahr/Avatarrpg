/**
 * Pack the Ba Dan canal: the bed its water sits on, the laid stone kerb around
 * it, and a wet rim where the two meet.
 *
 * The runtime water layer still covers every water cell exactly as the rules do
 * — it lays a 0.4-alpha film over the tile — so most of what the camera sees in a
 * water cell is whatever this plate puts underneath. It used to put nothing
 * there, which left the courtyard's *grass* material showing through the film:
 * the village canal read as one flat pale band. This plate cuts a channel bottom
 * out of the village's own paving — the road row beside the canal, sampled with
 * the courtyard plate's own world mapping — and shades it by how far it sits from
 * the water's edge, so the middle of the channel is deeper, cooler and darker
 * than the shelf under the kerb, and the kerb itself runs from wet, dark stone at
 * the waterline to the paving's own brightness where it meets the street.
 *
 * Nothing is synthesised: every pixel is the tracked courtyard painting's own
 * material, shaded.
 *
 * npx tsx scripts/art/ba-dan-canal-banks.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import decode, { init } from '@jsquash/webp/decode.js';
import {
  BA_DAN_CANAL_BANK_RADIUS,
  BA_DAN_CANAL_BANKS,
  BA_DAN_WATER_CELLS,
} from '../../src/content/scenes/baDan';
import { newImage, pixelAt, setPixel, writePng } from './lib/image';
import type { Image } from './lib/image';
import { encodeWebp } from './lib/webp';

/** The tracked courtyard painting this plate's material is cut from. */
export const SOURCE = 'public/art/maps/ba-dan-scene/courtyard-ground.webp';
export const OUTPUT = 'public/art/maps/ba-dan-scene/canal-banks.webp';
export const SOURCE_ORIGIN = { x: 640, y: 256 } as const;
/**
 * How many cells nearer the viewer the channel's material is cut from. The two
 * rows under the canal are the village's broad flagstone (`=` in `village.ts`),
 * so the bed and the kerb are the paving the player walks on, one unit of depth
 * down, and the grain continues across the waterline instead of changing
 * material. The shift clears the ring's own half-cell reach northward, so no part
 * of the kerb can sample the water row the courtyard paints as grass.
 */
export const BED_ROW = 1.5;
/** What the shelf under the kerb keeps of the paving's brightness. */
export const BED_SHELF = 0.78;
/** How much of it the middle of the channel takes away. */
export const BED_SHADE = 0.42;
/** World pixels from the water's edge to the channel's deepest point. */
export const BED_DEPTH = 32;
/** The deepest the seeded mottle may darken or lighten the bed, at full depth. */
export const BED_MOTTLE = 0.06;
/** Standing water absorbs red first, so the bed cools as it goes under. */
export const BED_COOL = { red: 0.88, green: 0.99, blue: 1.12 } as const;
/** Width of the darker, cooler wet stone right where the kerb meets the water. */
export const WET_RIM = 0.12;
/** What the kerb keeps of the paving's brightness in the wet band and outside it. */
export const KERB_WET_SHADE = 0.86;
export const KERB_DRY_SHADE = 1.02;
/** How far the kerb's red falls and blue rises where it is wet. */
export const KERB_WET_COOL = 0.05;
/**
 * How far the kerb's stone moves toward its own grey. A coping is dressed stone
 * laid against the warm paving, so it has to read as its own material without
 * authoring a second one — the same trick as shading, applied to saturation.
 */
export const KERB_DESATURATE = 0.24;

const CELL_X = 64;
const CELL_Y = 32;
const ORIGIN_X = 1024;

/**
 * Where a packed pixel sits in the plate's own cell space: `x` and `y` are cell
 * corners, so a tile's diamond centre lands on `(cell + 0.5, cell + 0.5)`. The
 * courtyard packer uses the same inverse, which is what keeps the sampled
 * material registered with the ground it is cut from.
 */
export function canalPosition(px: number, py: number): { x: number; y: number } {
  const dx = (BA_DAN_CANAL_BANKS.x + px + 0.5 - ORIGIN_X) / CELL_X;
  const dy = (BA_DAN_CANAL_BANKS.y + py + 0.5) / CELL_Y;
  return { x: (dx + dy) / 2, y: (dy - dx) / 2 };
}

/**
 * Distance to the nearest water cell's diamond edge in metric units: below 1 is
 * inside the water, 1 is the waterline, and `BA_DAN_CANAL_BANK_RADIUS` is the
 * outer edge of the kerb. One metric unit is half a tile of screen travel in
 * either axis, which is exactly the diamond's own half-extent.
 */
export function canalMetric(x: number, y: number): number {
  let metric = Number.POSITIVE_INFINITY;
  for (const cell of BA_DAN_WATER_CELLS) {
    /*
     * The corner-based cell space is the screen's own axes rotated by 45°, so a
     * tile's L1 diamond is `2 · max(|u|, |v|)` here rather than `|u| + |v|`:
     * one metric unit is the diamond's half-extent in either screen axis.
     */
    const u = Math.abs(x - (cell.x + 0.5));
    const v = Math.abs(y - (cell.y + 0.5));
    const distance = 2 * Math.max(u, v);
    if (distance < metric) metric = distance;
  }
  return metric;
}

/** The paving's own pixel at a cell-space point, `BED_ROW` cells nearer the viewer. */
export function pavingAt(source: Image, x: number, y: number): readonly number[] {
  const px = Math.floor(ORIGIN_X + (x - (y + BED_ROW)) * CELL_X - SOURCE_ORIGIN.x);
  const py = Math.floor((x + y + BED_ROW) * CELL_Y - SOURCE_ORIGIN.y);
  if (px < 0 || py < 0 || px >= source.width || py >= source.height)
    throw new Error(`Canal material sampled outside the courtyard plate at ${x},${y}`);
  const pixel = pixelAt(source, px, py);
  // The courtyard packer leaves the pixels past its own logical boundary
  // untouched. Sampling one of those would put a black hole in the bed.
  if (pixel[3] === 0)
    throw new Error(`Canal material sampled an unpainted courtyard pixel at ${x},${y}`);
  return pixel;
}

/** How far inside the water a packed pixel sits, in world pixels; zero outside. */
export function canalInset(width: number, height: number): Float64Array {
  const far = 1e9;
  const inset = new Float64Array(width * height);
  for (let py = 0; py < height; py++)
    for (let px = 0; px < width; px++) {
      const { x, y } = canalPosition(px, py);
      inset[py * width + px] = canalMetric(x, y) <= 1 ? far : 0;
    }
  const step = (index: number, previous: number, cost: number): void => {
    const value = inset[previous];
    if (value !== undefined && value + cost < (inset[index] ?? far)) inset[index] = value + cost;
  };
  for (let py = 0; py < height; py++)
    for (let px = 0; px < width; px++) {
      const index = py * width + px;
      if (px > 0) step(index, index - 1, 1);
      if (py > 0) step(index, index - width, 1);
      if (px > 0 && py > 0) step(index, index - width - 1, 2);
      if (px + 1 < width && py > 0) step(index, index - width + 1, 2);
    }
  for (let py = height - 1; py >= 0; py--)
    for (let px = width - 1; px >= 0; px--) {
      const index = py * width + px;
      if (px + 1 < width) step(index, index + 1, 1);
      if (py + 1 < height) step(index, index + width, 1);
      if (px + 1 < width && py + 1 < height) step(index, index + width + 1, 2);
      if (px > 0 && py + 1 < height) step(index, index + width - 1, 2);
    }
  for (let index = 0; index < inset.length; index++) {
    const value = inset[index] ?? 0;
    inset[index] = value >= far ? 0 : value;
  }
  return inset;
}

/**
 * How much of the paving colour survives at a point inside the water. The shelf
 * under the kerb keeps the artist's own tone so the wet rim meets it without a
 * seam; the middle of the channel loses `BED_SHADE` of its brightness and gains a
 * slow mottle, which is what makes the water read as deeper there.
 */
export function bedShade(x: number, y: number, inset: number): number {
  const depth = Math.min(1, Math.max(0, inset) / BED_DEPTH);
  const mottle = (canalNoise(x * 1.7 + 31.7, y * 1.7 + 17.3) - 0.5) * 2 * BED_MOTTLE * depth;
  return Math.max(0.26, BED_SHELF - BED_SHADE * depth + mottle);
}

/**
 * The kerb's own shading: darkest and coolest where it meets the water, rising
 * smoothly to the paving's own brightness at the outer edge, so the stone neither
 * draws a line along the water nor ends in a bare edge against the street it is
 * laid in. `wetness` is 1 in the water's own band and 0 at the outer edge.
 */
export function kerbShade(edge: number): { shade: number; wetness: number } {
  const dry = smoothstep(0, BA_DAN_CANAL_BANK_RADIUS - 1, edge);
  return {
    shade: KERB_WET_SHADE + (KERB_DRY_SHADE - KERB_WET_SHADE) * dry,
    wetness: 1 - dry,
  };
}

export function packCanalBanks(source: Image) {
  const { width, height } = BA_DAN_CANAL_BANKS;
  const image = newImage(width, height);
  const inset = canalInset(width, height);
  let bedPixels = 0;
  let deepBedPixels = 0;
  let kerbPixels = 0;
  let wetRimPixels = 0;
  let deepestShade = 1;
  for (let py = 0; py < height; py++)
    for (let px = 0; px < width; px++) {
      const { x, y } = canalPosition(px, py);
      const metric = canalMetric(x, y);
      const wet = metric <= 1;
      if (!wet && metric > BA_DAN_CANAL_BANK_RADIUS) continue;
      const paving = pavingAt(source, x, y);
      if (wet) {
        /*
         * The bed is opaque across every water pixel, so the 0.4-alpha film
         * tints the village's own paving the way the street beside it is made,
         * rather than the grass the courtyard happens to paint under the canal.
         */
        const inside = inset[py * width + px] ?? 0;
        const shade = bedShade(x, y, inside);
        deepestShade = Math.min(deepestShade, shade);
        setPixel(image, px, py, [
          Math.min(255, Math.round((paving[0] ?? 0) * shade * BED_COOL.red)),
          Math.min(255, Math.round((paving[1] ?? 0) * shade * BED_COOL.green)),
          Math.min(255, Math.round((paving[2] ?? 0) * shade * BED_COOL.blue)),
          255,
        ]);
        bedPixels++;
        if (inside > BED_DEPTH * 0.6) deepBedPixels++;
        continue;
      }
      const edge = metric - 1;
      const { shade, wetness } = kerbShade(edge);
      const wetRim = edge <= WET_RIM;
      if (wetRim) wetRimPixels++;
      const coolRed = 1 - wetness * KERB_WET_COOL;
      const coolBlue = 1 + wetness * KERB_WET_COOL;
      const grey = (paving[0] ?? 0) * 0.3 + (paving[1] ?? 0) * 0.55 + (paving[2] ?? 0) * 0.15;
      const dressed = (channel: number): number => {
        const value = paving[channel] ?? 0;
        return value * (1 - KERB_DESATURATE) + grey * KERB_DESATURATE;
      };
      setPixel(image, px, py, [
        Math.min(255, Math.round(dressed(0) * shade * coolRed)),
        Math.min(255, Math.round(dressed(1) * shade)),
        Math.min(255, Math.round(dressed(2) * shade * coolBlue)),
        255,
      ]);
      kerbPixels++;
    }
  return { image, bedPixels, deepBedPixels, kerbPixels, wetRimPixels, deepestShade };
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Two octaves of value noise over a seeded integer lattice. */
function canalNoise(x: number, y: number): number {
  return (valueNoise(x, y) * 2 + valueNoise(x * 2.1 + 11.3, y * 2.1 + 4.7)) / 3;
}

function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash01(ix, iy);
  const b = hash01(ix + 1, iy);
  const c = hash01(ix, iy + 1);
  const d = hash01(ix + 1, iy + 1);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

function hash01(ix: number, iy: number): number {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export async function main() {
  const require = createRequire(import.meta.url);
  const wasm = readFileSync(require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm'));
  await init(await WebAssembly.compile(wasm));
  const bytes = readFileSync(SOURCE);
  const courtyard = await decode(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  const result = packCanalBanks({
    width: courtyard.width,
    height: courtyard.height,
    data: new Uint8Array(courtyard.data),
  });
  mkdirSync('public/art/maps/ba-dan-scene', { recursive: true });
  writeFileSync(OUTPUT, await encodeWebp(result.image, 88, true));
  if (process.argv.includes('--audit')) writePng('.shots/canal/packed.png', result.image);
  console.log({
    width: result.image.width,
    height: result.image.height,
    bedPixels: result.bedPixels,
    deepBedPixels: result.deepBedPixels,
    kerbPixels: result.kerbPixels,
    wetRimPixels: result.wetRimPixels,
    deepestShade: Number(result.deepestShade.toFixed(3)),
  });
}
if (process.argv[1]?.endsWith('ba-dan-canal-banks.ts')) await main();
