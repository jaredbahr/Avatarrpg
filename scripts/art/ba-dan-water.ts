/**
 * Ba Dan's painted water: the connected canal and west ford on the single
 * `edge-water.webp` page. `canal-banks.webp` is a retired plate and is not
 * rewritten here.
 *
 * The source is the 1:1 fieldstone repaint in `art/source/ba-dan-water/`: the
 * Forest Road pond's family (stone-edged, clear, shallows into a darker
 * channel, a few ripples, pads only in the ford). Packing derives the current
 * canal size and edge alpha from scene geometry before encoding, so a layout or
 * registration change cannot leave the painted RGB on a stale footprint.
 * The water is the picture's own: the scene declares it painted
 * (`paintedWaterCells`), so the renderer lays no film over it and none is
 * baked in.
 *
 * npx tsx scripts/art/ba-dan-water.ts
 */
import { writeFileSync } from 'node:fs';
import { packEdgePage } from './ba-dan-edges';
import { newImage, pixelAt, readPng, setPixel } from './lib/image';
import type { Image } from './lib/image';
import { encodeWebp } from './lib/webp';

export const MASTER_DIRECTORY = 'art/source/ba-dan-water';
export const SHIPPED_DIRECTORY = 'public/art/maps/ba-dan-scene';
export const WATER_QUALITY = 82;
export const WATER_PLATES = ['edge-water'] as const;
export type WaterPlate = (typeof WATER_PLATES)[number];

export const masterPath = (plate: WaterPlate): string => `${MASTER_DIRECTORY}/${plate}.png`;
export const shippedPath = (plate: WaterPlate): string => `${SHIPPED_DIRECTORY}/${plate}.webp`;

export function readMaster(plate: WaterPlate): Image {
  const edge = readPng(masterPath(plate));
  // The upper field is the accepted continuous channel; the lower field is
  // the west ford. `packEdgePage` preserves the former's authored alpha and
  // derives the latter from current map/apron geometry. The tracked master
  // remains authoritative for every painted colour.
  const footprint = packEdgePage();
  const composed = newImage(footprint.width, footprint.height);
  for (let y = 0; y < footprint.height; y++)
    for (let x = 0; x < footprint.width; x++) {
      const alpha = pixelAt(footprint, x, y)[3] ?? 0;
      if (!alpha) continue;
      const painted = pixelAt(edge, x, y);
      setPixel(composed, x, y, [painted[0] ?? 0, painted[1] ?? 0, painted[2] ?? 0, alpha]);
    }
  return composed;
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
