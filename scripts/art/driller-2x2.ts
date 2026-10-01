/**
 * Pack the approved 2x2 Driller animation without recolouring or resampling.
 * Each cel is mirrored to face screen-right and placed inside an 8 px gutter.
 * Each clip's first cel is the shared still with a baked ground shadow, so it
 * is deliberately omitted and the remaining cels are renumbered from zero.
 *
 * Usage: node --import tsx scripts/art/driller-2x2.ts
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ClipName } from '../../src/content/assets/clips';
import { atlasJsonText } from '../../src/render/sheets/atlasJson';
import { layoutSheet } from '../../src/render/sheets/layout';
import type { Image } from './lib/image';
import { newImage, pixelAt, readPng, setPixel } from './lib/image';
import { encodeWebpLossless } from './lib/webp';

export const DRILLER_SOURCE_DIRECTORY = 'media/art-sources/driller-2x2-v1';
export const DRILLER_WEBP = 'public/art/units/driller.webp';
export const OBSOLETE_DRILLER_PNG = 'public/art/units/driller.png';
export const DRILLER_JSON = 'public/art/units/driller.json';
export const DRILLER_KEY = 'unit.enemy.driller';
export const DRILLER_FRAME_SIZE = 160;
export const DRILLER_MARGIN = 8;
export const DRILLER_PACKED_FRAME_SIZE = DRILLER_FRAME_SIZE + DRILLER_MARGIN * 2;
export const DRILLER_CLIPS = {
  idle: 6,
  walk: 6,
  cast: 8,
  hit: 4,
  ko: 8,
} as const satisfies Partial<Record<ClipName, number>>;

export const drillerSource = (clip: keyof typeof DRILLER_CLIPS, sourceIndex: number): string =>
  `${DRILLER_SOURCE_DIRECTORY}/${clip}-${sourceIndex}.png`;

export function packDriller(): { image: Image; json: string } {
  const layout = layoutSheet(
    DRILLER_KEY,
    DRILLER_CLIPS,
    DRILLER_PACKED_FRAME_SIZE,
    DRILLER_PACKED_FRAME_SIZE,
  );
  const image = newImage(layout.width, layout.height);
  for (const [name, rect] of layout.frames) {
    const match = /\/(idle|walk|cast|hit|ko)\/(\d+)$/.exec(name);
    if (!match) throw new Error(`Unexpected Driller frame id: ${name}`);
    const clip = match[1] as keyof typeof DRILLER_CLIPS;
    const packedIndex = Number(match[2]);
    const source = readPng(drillerSource(clip, packedIndex + 1));
    if (source.width !== DRILLER_FRAME_SIZE || source.height !== DRILLER_FRAME_SIZE) {
      throw new Error(
        `${drillerSource(clip, packedIndex + 1)} is ${source.width}x${source.height}, not 160x160.`,
      );
    }
    for (let y = 0; y < DRILLER_FRAME_SIZE; y++)
      for (let x = 0; x < DRILLER_FRAME_SIZE; x++)
        setPixel(
          image,
          rect.x + DRILLER_MARGIN + x,
          rect.y + DRILLER_MARGIN + y,
          pixelAt(source, DRILLER_FRAME_SIZE - 1 - x, y),
        );
  }
  return {
    image,
    json: `${atlasJsonText(layout.frames, 'driller.webp', layout.width, layout.height)}\n`,
  };
}

async function main(): Promise<void> {
  const { image, json } = packDriller();
  mkdirSync(dirname(DRILLER_WEBP), { recursive: true });
  writeFileSync(DRILLER_WEBP, await encodeWebpLossless(image));
  writeFileSync(DRILLER_JSON, json);
  if (existsSync(OBSOLETE_DRILLER_PNG)) rmSync(OBSOLETE_DRILLER_PNG);
  console.log(`wrote lossless driller.webp (${image.width}x${image.height}) and driller.json`);
}

if (process.argv[1]?.endsWith('driller-2x2.ts')) await main();
