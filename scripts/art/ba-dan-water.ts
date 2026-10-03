/**
 * Ba Dan's painted water: the courtyard canal's two pools (`canal-banks.webp`)
 * and the south canal and west ford (`edge-water.webp`).
 *
 * The masters are the 1:1 fieldstone repaint in `art/source/ba-dan-water/`: the
 * Forest Road pond's family (stone-edged, clear, shallows into a darker
 * channel, a few ripples, pads only in the ford). Their alpha is today's
 * footprint, the cells' diamonds plus the shoreline band, so packing is only
 * the encode; `ba-dan-water.test.ts` holds the shipped files to the geometry.
 * The water is the picture's own: the scene declares it painted
 * (`paintedWaterCells`), so the renderer lays no film over it and none is
 * baked in.
 *
 * npx tsx scripts/art/ba-dan-water.ts
 */
import { writeFileSync } from 'node:fs';
import { readPng } from './lib/image';
import type { Image } from './lib/image';
import { encodeWebp } from './lib/webp';

export const MASTER_DIRECTORY = 'art/source/ba-dan-water';
export const SHIPPED_DIRECTORY = 'public/art/maps/ba-dan-scene';
export const WATER_QUALITY = 82;
export const WATER_PLATES = ['canal-banks', 'edge-water'] as const;
export type WaterPlate = (typeof WATER_PLATES)[number];

export const masterPath = (plate: WaterPlate): string => `${MASTER_DIRECTORY}/${plate}.png`;
export const shippedPath = (plate: WaterPlate): string => `${SHIPPED_DIRECTORY}/${plate}.webp`;

export function readMaster(plate: WaterPlate): Image {
  return readPng(masterPath(plate));
}

export async function packWater(plate: WaterPlate): Promise<Uint8Array> {
  return encodeWebp(readMaster(plate), WATER_QUALITY, true);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/art/ba-dan-water.ts')) {
  for (const plate of WATER_PLATES) {
    const bytes = await packWater(plate);
    writeFileSync(shippedPath(plate), bytes);
    console.log(shippedPath(plate), bytes.byteLength);
  }
}
