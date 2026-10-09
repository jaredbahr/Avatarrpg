/**
 * Deterministic packer for the Ba Dan exterior-surround atlas.
 *
 * The canonical master is `art/source/ba-dan-surround/village-surround-master.png`,
 * the assembled 1824x1280 atlas itself; see the README beside it. This script
 * validates it and encodes the shipped lossy WebP with an exact alpha plane.
 *
 * Usage: node --import tsx scripts/art/ba-dan-surround.ts [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { BA_DAN_SURROUND_MODULES } from '../../src/content/scenes/baDan';
import type { Image } from './lib/image';
import { readImage } from './lib/image';
import { encodeUprightWebp } from './lib/webp';

export const SOURCE_DIR = 'art/source/ba-dan-surround';
export const MASTER = `${SOURCE_DIR}/village-surround-master.png`;
export const OUTPUT = 'public/art/maps/ba-dan-scene/village-surround.webp';
export const ATLAS_SIZE = { width: 1824, height: 640 } as const;

/** Read and validate the master: size, binary alpha, and non-empty modules. */
export function readMaster(): Image {
  const atlas = readImage(MASTER);
  if (atlas.width !== ATLAS_SIZE.width || atlas.height !== ATLAS_SIZE.height)
    throw new Error(
      `${MASTER} must be ${ATLAS_SIZE.width}x${ATLAS_SIZE.height}, got ${atlas.width}x${atlas.height}`,
    );
  for (let i = 3; i < atlas.data.length; i += 4) {
    const alpha = atlas.data[i] ?? 0;
    if (alpha !== 0 && alpha !== 255)
      throw new Error(`${MASTER}: alpha must be binary; found ${alpha} at byte ${i}.`);
  }
  for (const [name, rect] of Object.entries(BA_DAN_SURROUND_MODULES)) {
    if (rect.x + rect.width > atlas.width || rect.y + rect.height > atlas.height)
      throw new Error(`${name} falls outside the surround atlas.`);
    let opaque = 0;
    for (let y = rect.y; y < rect.y + rect.height; y++)
      for (let x = rect.x; x < rect.x + rect.width; x++)
        if ((atlas.data[(y * atlas.width + x) * 4 + 3] ?? 0) !== 0) opaque++;
    if (opaque === 0) throw new Error(`${name} is empty in the surround master.`);
  }
  return atlas;
}

/** The shipped bytes for the master. */
export async function packSurround(): Promise<Uint8Array> {
  return encodeUprightWebp(readMaster());
}

async function main(): Promise<void> {
  const packed = await packSurround();
  if (process.argv.includes('--check')) {
    const shipped = new Uint8Array(readFileSync(OUTPUT));
    if (!Buffer.from(shipped).equals(Buffer.from(packed)))
      throw new Error('Repacked surround differs from the shipped atlas.');
    console.log('village-surround: matches');
  } else {
    writeFileSync(OUTPUT, packed);
    console.log(JSON.stringify({ asset: 'village-surround', bytes: packed.length }));
  }
}

const invoked = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invoked) await main();
