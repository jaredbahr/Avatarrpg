/**
 * Pack the eight approved Forest Road roadside sprites through the shared
 * scene-image contract: alpha trim and nothing else (no resampling), lossless
 * alpha in the WebP. Registration stays in the scene manifest
 * (`FOREST_ROADSIDE_PROPS` in `forestRoad.ts`), which scales each sprite by
 * the 64/96 ratio between the world tile and the 96 px tile it was reviewed at.
 *
 * Usage: node --import tsx scripts/art/forest-roadside-props.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { readImage } from './lib/image';
import { encodeWebp } from './lib/webp';
import { alphaBounds, crop } from './lib/trim';

export const ROADSIDE_DIRECTORY = 'media/art-sources/forest-roadside-v1';
export const ROADSIDE_OUTPUT_DIRECTORY = 'public/art/maps/forest-scene';
export const ROADSIDE_QUALITY = 88;
export const ROADSIDE_ART = [
  'broken-cart-wheel',
  'lantern-post',
  'milestone',
  'mushroom-fallen-log',
  'rope-bound-quarry-blocks',
  'signpost',
  'split-rail-fence',
  'woodpile-stump',
] as const;
export type RoadsideArt = (typeof ROADSIDE_ART)[number];

export const roadsideSource = (name: RoadsideArt): string => `${ROADSIDE_DIRECTORY}/${name}.png`;
export const roadsideOutput = (name: RoadsideArt): string =>
  `${ROADSIDE_OUTPUT_DIRECTORY}/roadside-${name}.webp`;

export function packRoadside(name: RoadsideArt) {
  const raw = readImage(roadsideSource(name));
  const bounds = alphaBounds(raw);
  if (!bounds) throw new Error(`Roadside source ${name} is empty.`);
  return { image: crop(raw, bounds), bounds };
}

async function main(): Promise<void> {
  const packed = [];
  for (const name of ROADSIDE_ART) {
    const { image, bounds } = packRoadside(name);
    const bytes = await encodeWebp(image, ROADSIDE_QUALITY, true);
    mkdirSync(dirname(roadsideOutput(name)), { recursive: true });
    writeFileSync(roadsideOutput(name), bytes);
    packed.push({ name, bounds, width: image.width, height: image.height, bytes: bytes.length });
  }
  console.log(JSON.stringify(packed));
}

if (process.argv[1]?.endsWith('forest-roadside-props.ts')) await main();
