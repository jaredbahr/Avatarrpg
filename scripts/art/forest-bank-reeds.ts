/**
 * Pack the four approved fine-painted Forest Road bank reeds without
 * resampling. Registration stays in the scene manifest at the centre of each
 * piece's painted root mound.
 *
 * Usage: node --import tsx scripts/art/forest-bank-reeds.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { readImage } from './lib/image';
import type { Image } from './lib/image';
import { encodeWebp } from './lib/webp';
import { alphaBounds, crop, lowestOpaqueRow } from './lib/trim';

export const BANK_REED_DIRECTORY = 'media/art-sources/forest-bank-reeds-fine-v1';
export const BANK_REED_OUTPUT_DIRECTORY = 'public/art/maps/forest-scene';
export const BANK_REED_COUNT = 4;
export const BANK_REED_QUALITY = 88;
export const BANK_REED_SIZE = [
  { width: 79, height: 110 },
  { width: 68, height: 67 },
  { width: 91, height: 69 },
  { width: 94, height: 98 },
] as const;

export const bankReedSource = (index: number): string => `${BANK_REED_DIRECTORY}/reed-${index}.png`;
export const bankReedOutput = (index: number): string =>
  `${BANK_REED_OUTPUT_DIRECTORY}/bank-reed-${index}.webp`;

function packBankReedImage(raw: Image) {
  const bounds = alphaBounds(raw);
  if (!bounds) throw new Error('Bank reed source is empty.');
  return { image: crop(raw, bounds), bounds };
}

export function packBankReed(index: number) {
  const packed = packBankReedImage(readImage(bankReedSource(index)));
  const expected = BANK_REED_SIZE[index];
  if (!expected) throw new Error(`Unknown bank reed ${index}.`);
  if (packed.image.width !== expected.width || packed.image.height !== expected.height)
    throw new Error(
      `Bank reed ${index} trims to ${packed.image.width}x${packed.image.height}; expected ${expected.width}x${expected.height}.`,
    );
  if (
    packed.bounds.x !== 0 ||
    packed.bounds.y !== 0 ||
    packed.bounds.width !== expected.width ||
    packed.bounds.height !== expected.height
  )
    throw new Error(`Bank reed ${index} must fill its registered source canvas.`);
  if (lowestOpaqueRow(packed.image) !== expected.height - 1)
    throw new Error(`Bank reed ${index} changed its approved foot line.`);
  let soft = 0;
  for (let i = 3; i < packed.image.data.length; i += 4) {
    const alpha = packed.image.data[i] ?? 0;
    if (alpha > 0 && alpha < 255) soft++;
  }
  if (soft < 1_000) throw new Error(`Bank reed ${index} lost its soft painted alpha edge.`);
  return packed;
}

async function main(): Promise<void> {
  const packed = [];
  for (let index = 0; index < BANK_REED_COUNT; index++) {
    const output = bankReedOutput(index);
    const { image, bounds } = packBankReed(index);
    const bytes = await encodeWebp(image, BANK_REED_QUALITY, true);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, bytes);
    packed.push({ index, bounds, width: image.width, height: image.height, bytes: bytes.length });
  }
  console.log(JSON.stringify(packed));
}

if (process.argv[1]?.endsWith('forest-bank-reeds.ts')) await main();
