/**
 * Pack the four approved Forest Road bank-reed silhouettes through the shared
 * scene-image contract: alpha trim, uniform downscale only, and lossless alpha
 * in the WebP. Registration stays in the scene manifest at the centre of each
 * piece's painted root mound.
 *
 * Usage: node --import tsx scripts/art/forest-bank-reeds.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { readImage } from './lib/image';
import { encodeWebp } from './lib/webp';
import { packSceneImage } from './scene-image';

export const BANK_REED_DIRECTORY = 'media/art-sources/forest-bank-reeds-v1';
export const BANK_REED_OUTPUT_DIRECTORY = 'public/art/maps/forest-scene';
export const BANK_REED_COUNT = 4;

export const bankReedSource = (index: number): string => `${BANK_REED_DIRECTORY}/reed-${index}.png`;
export const bankReedOutput = (index: number): string =>
  `${BANK_REED_OUTPUT_DIRECTORY}/bank-reed-${index}.webp`;

export function packBankReed(index: number) {
  return packSceneImage(readImage(bankReedSource(index)), 128);
}

async function main(): Promise<void> {
  const packed = [];
  for (let index = 0; index < BANK_REED_COUNT; index++) {
    const output = bankReedOutput(index);
    const { image, bounds } = packBankReed(index);
    const bytes = await encodeWebp(image, 88, true);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, bytes);
    packed.push({ index, bounds, width: image.width, height: image.height, bytes: bytes.length });
  }
  console.log(JSON.stringify(packed));
}

if (process.argv[1]?.endsWith('forest-bank-reeds.ts')) await main();
