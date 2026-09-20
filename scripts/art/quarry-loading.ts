/** Deterministic packaging only; every visible pixel comes from the reviewed source. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { newImage, readPng, writePng } from './lib/image';
import { scaleBy } from './lib/scale';
import { alphaBounds, crop } from './lib/trim';
import { encodeWebp } from './lib/webp';

export const LOADING_SOURCE = 'assets/reference/quarry-loading/source.png';
export const LOADING_OUTPUT = 'public/art/maps/driller-floor-scene/rear-loading.webp';
const GUTTER = 4;

export async function packLoadingStrip(sourcePath = LOADING_SOURCE) {
  const source = readPng(sourcePath);
  const bounds = alphaBounds(source, 1);
  if (!bounds || !source.data.some((v, i) => i % 4 === 3 && v === 0))
    throw new Error('The loading strip needs reviewed art with genuine transparent alpha');
  const trimmed = crop(source, bounds);
  const scaled = scaleBy(trimmed, Math.min(1, 504 / trimmed.width, 376 / trimmed.height));
  const image = newImage(scaled.width + GUTTER * 2, scaled.height + GUTTER * 2);
  for (let y = 0; y < scaled.height; y++) {
    const row = scaled.data.subarray(y * scaled.width * 4, (y + 1) * scaled.width * 4);
    image.data.set(row, ((y + GUTTER) * image.width + GUTTER) * 4);
  }
  const bytes = await encodeWebp(image, 88, true);
  if (bytes.length > 100 * 1024) throw new Error(`Loading strip exceeds 100 KiB: ${bytes.length}`);
  return { image, bytes, sourceBounds: bounds };
}

async function main() {
  const packed = await packLoadingStrip();
  mkdirSync(dirname(LOADING_OUTPUT), { recursive: true });
  writeFileSync(LOADING_OUTPUT, packed.bytes);
  const review = '.shots/quarry-loading';
  mkdirSync(review, { recursive: true });
  writePng(`${review}/packed.png`, packed.image);
  const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  const report = {
    source: LOADING_SOURCE,
    sourceSha256: hash(readFileSync(LOADING_SOURCE)),
    sourceBounds: packed.sourceBounds,
    output: LOADING_OUTPUT,
    width: packed.image.width,
    height: packed.image.height,
    bytes: packed.bytes.length,
    sha256: hash(packed.bytes),
    quality: 88,
    gutter: GUTTER,
  };
  writeFileSync(`${review}/packing.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
