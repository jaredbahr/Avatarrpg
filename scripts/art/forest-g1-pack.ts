/**
 * Packs the forest road at G1 (ADR 0087) from its committed sources in
 * `art/source/forest-road-g1/pieces/` (made by that folder's tools, which call
 * PixelLab; this script calls nothing):
 *
 * - ground/<name>.png, world px: the board's ground pieces, lossy q90 with
 *   sharp YUV and an exact alpha plane (as Ba Dan's ground plates), at 1 px
 *   per world px;
 * - uprights/<id>.png, world px: the uprights at 1 px per world px, so they
 *   are sampled nearest and crisp at every integer zoom (ADR 0088; they were
 *   shipped at 1.5 px, smoothed at N = 2). Each is lossy (`encodeUprightWebp`)
 *   when its decoded pixels meet the uprights' fine-grain contract at q100, and
 *   otherwise lossless on a 5-bit colour grid, the rule of ADR 0085;
 * - props/<id>.png, world px: the six combat props, enlarged 4x by nearest
 *   neighbour into the 256 px frame the renderer draws into one 64 world px
 *   sprite box, so 1 art px is 1 world px, standing on each prop's old foot.
 *
 * node --import tsx scripts/art/forest-g1-pack.ts [--check]
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { newImage, readPng, type Image } from './lib/image';
import { LOSSY_MAX_RGB, LOSSY_MEAN_RGB, lossyError } from './lib/lossy-compare';
import { UPRIGHT_WEBP_OPTIONS, decodeWebp, encodeUprightWebp, encodeWebp } from './lib/webp';

export const FOREST_G1_SOURCE = 'art/source/forest-road-g1/pieces';
export const FOREST_G1_OUT = 'public/art/maps/forest-g1';
export const PROPS_OUT = 'public/art/props';
export const GROUND_QUALITY = 90;
/** Each prop's foot in its 256 px frame: the old family's centre and baseline (docs/art/prop-family-v1.md). */
export const PROP_FOOT: Readonly<Record<string, { x: number; bottom: number }>> = {
  barrel: { x: 128, bottom: 218 },
  flask: { x: 128, bottom: 218 },
  hay: { x: 128, bottom: 218 },
  brazier: { x: 128, bottom: 218 },
  cart: { x: 128, bottom: 241 },
  rubble: { x: 128, bottom: 218 },
};
const FRAME = 256;
const PROP_SCALE = 4;

/** Colours on a 5-bit grid per channel, visible pixels only (copied from `ba-dan-regions/pack.ts`, ADR 0085). */
function fiveBit(image: Image): Image {
  const data = new Uint8Array(image.data);
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) === 0) continue;
    for (let c = 0; c < 3; c++) data[i + c] = (((data[i + c] ?? 0) >> 3) << 3) + 4;
  }
  return { ...image, data };
}

async function holdsLossy(image: Image): Promise<boolean> {
  const bytes = await encodeWebp(image, 100, true, UPRIGHT_WEBP_OPTIONS);
  const error = lossyError(image, await decodeWebp(bytes));
  return error.maxRgb <= LOSSY_MAX_RGB && error.meanRgb < LOSSY_MEAN_RGB;
}

export async function encodeUpright(image: Image): Promise<Uint8Array> {
  return (await holdsLossy(image))
    ? encodeUprightWebp(image)
    : encodeWebp(fiveBit(image), 100, true, { lossless: 1, method: 6, exact: 1 });
}

export function encodeGround(image: Image): Promise<Uint8Array> {
  return encodeWebp(image, GROUND_QUALITY, true, UPRIGHT_WEBP_OPTIONS);
}

/** A world-px prop, nearest-neighbour x4, standing on its foot in the 256 px frame. */
export function propFrame(id: string, sprite: Image): Image {
  const foot = PROP_FOOT[id];
  if (!foot) throw new Error(`No foot for prop ${id}`);
  const frame = newImage(FRAME, FRAME);
  const w = sprite.width * PROP_SCALE,
    h = sprite.height * PROP_SCALE;
  const x0 = Math.round(foot.x - w / 2),
    y0 = foot.bottom - h;
  if (x0 < 0 || y0 < 0 || x0 + w > FRAME) throw new Error(`${id} does not fit its frame`);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = (Math.floor(y / PROP_SCALE) * sprite.width + Math.floor(x / PROP_SCALE)) * 4;
      const d = ((y0 + y) * FRAME + x0 + x) * 4;
      for (let c = 0; c < 4; c++) frame.data[d + c] = sprite.data[s + c] ?? 0;
    }
  return frame;
}

export function encodePng(image: Image): Uint8Array {
  const png = new PNG({ width: image.width, height: image.height });
  png.data = Buffer.from(image.data);
  return PNG.sync.write(png, { colorType: 6 });
}

const names = (folder: string): string[] =>
  readdirSync(`${FOREST_G1_SOURCE}/${folder}`)
    .filter((f) => f.endsWith('.png'))
    .map((f) => f.slice(0, -4))
    .sort();

/** Every shipped file, by path, from the sources. */
export async function packForestG1(): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  for (const name of names('ground'))
    files.set(
      `${FOREST_G1_OUT}/${name}.webp`,
      await encodeGround(readPng(`${FOREST_G1_SOURCE}/ground/${name}.png`)),
    );
  for (const name of names('uprights'))
    files.set(
      `${FOREST_G1_OUT}/${name}.webp`,
      await encodeUpright(readPng(`${FOREST_G1_SOURCE}/uprights/${name}.png`)),
    );
  for (const name of names('props'))
    files.set(
      `${PROPS_OUT}/${name}.png`,
      encodePng(propFrame(name, readPng(`${FOREST_G1_SOURCE}/props/${name}.png`))),
    );
  return files;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes('--check');
  const files = await packForestG1();
  let stale = 0;
  if (!check) mkdirSync(FOREST_G1_OUT, { recursive: true });
  for (const [path, bytes] of files) {
    if (check) {
      let same = false;
      try {
        same = Buffer.from(bytes).equals(readFileSync(path));
      } catch {
        same = false;
      }
      if (!same) {
        stale++;
        console.error(`stale: ${path}`);
      }
    } else writeFileSync(path, bytes);
  }
  const total = [...files.values()].reduce((sum, b) => sum + b.length, 0);
  console.log(`${files.size} files, ${total} bytes${check ? `, ${stale} stale` : ''}`);
  if (stale) process.exitCode = 1;
}
