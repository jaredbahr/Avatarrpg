/**
 * Reproducibly integrates the PixelLab Kaya G locomotion set.
 *
 * Usage:
 *   node --import tsx scripts/art/kaya-g.ts --source <kaya-g-set>
 *
 * The source cels remain read-only. They are nearest-neighbour scaled to 75%,
 * kept in their root-locked 192 px coordinate system, and packed beside Kaya's
 * existing cast/KO action cels.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ClipName } from '../../src/content/assets/clips';
import { atlasJsonText } from '../../src/render/sheets/atlasJson';
import { layoutSheet } from '../../src/render/sheets/layout';
import type { Image } from './lib/image';
import { newImage, pixelAt, readPng, setPixel } from './lib/image';
import { encodeWebp } from './lib/webp';

const KEY = 'unit.fire.kaya';
const FRAME_W = 128;
const FRAME_H = 192;
const SCALE = 0.75;
const OFFSET_X = -8;
const OFFSET_Y = 31;

const DIRECTIONS = [
  ['east', 'idle', 'walk', 'rest', 4],
  ['north-east', 'idleNorthEast', 'walkNorthEast', 'restNorthEast', 7],
  ['north', 'idleNorth', 'walkNorth', 'restNorth', 7],
  ['north-west', 'idleNorthWest', 'walkNorthWest', 'restNorthWest', 10],
  ['west', 'idleWest', 'walkWest', 'restWest', 3],
  ['south-west', 'idleSouthWest', 'walkSouthWest', 'restSouthWest', 4],
  ['south', 'idleSouth', 'walkSouth', 'restSouth', 11],
  ['south-east', 'idleSouthEast', 'walkSouthEast', 'restSouthEast', 9],
] as const satisfies readonly (readonly [string, ClipName, ClipName, ClipName, number])[];

function sourceArg(argv: readonly string[]): string {
  const at = argv.indexOf('--source');
  const value = at < 0 ? undefined : argv[at + 1];
  if (!value) throw new Error('Pass --source <kaya-g-set>.');
  return resolve(value);
}

function blit(target: Image, source: Image, x0: number, y0: number): void {
  for (let y = 0; y < source.height; y++)
    for (let x = 0; x < source.width; x++) setPixel(target, x0 + x, y0 + y, pixelAt(source, x, y));
}

function crop(source: Image, x0: number, y0: number, width: number, height: number): Image {
  const out = newImage(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelAt(source, x0 + x, y0 + y);
      if (a === 0) {
        setPixel(out, x, y, [0, 0, 0, 0]);
        continue;
      }
      // The superseded action atlas used soft procedural anti-aliasing. A small
      // lossless-looking channel reduction keeps those four legacy poses from
      // consuming more bytes than all 128 flat PixelLab locomotion cels.
      setPixel(out, x, y, [
        Math.min(255, Math.round(r / 16) * 16),
        Math.min(255, Math.round(g / 16) * 16),
        Math.min(255, Math.round(b / 16) * 16),
        Math.min(255, Math.round(a / 32) * 32),
      ]);
    }
  }
  return out;
}

function normalise(source: Image): Image {
  if (source.width !== 192 || source.height !== 192)
    throw new Error(`Expected a 192x192 PixelLab cel; got ${source.width}x${source.height}.`);
  const out = newImage(FRAME_W, FRAME_H);
  const scaled = Math.round(192 * SCALE);
  for (let y = 0; y < scaled; y++) {
    for (let x = 0; x < scaled; x++) {
      const rgba = pixelAt(source, Math.floor(x / SCALE), Math.floor(y / SCALE));
      setPixel(out, OFFSET_X + x, OFFSET_Y + y, rgba[3] === 0 ? [0, 0, 0, 0] : rgba);
    }
  }
  return out;
}

const source = sourceArg(process.argv.slice(2));
const legacyActions = resolve('art/source/kaya-actions');

const frames = new Map<string, Image>();
const counts: Partial<Record<ClipName, number>> = { cast: 3, ko: 1 };

for (const [direction, idleClip, walkClip, restClip, transition] of DIRECTIONS) {
  counts[idleClip] = 4;
  counts[walkClip] = 12;
  counts[restClip] = 1;
  for (let i = 0; i < 4; i++)
    frames.set(
      `${KEY}/${idleClip}/${i}`,
      normalise(readPng(join(source, 'idle', direction, `${i}.png`))),
    );
  for (let i = 0; i < 12; i++)
    frames.set(
      `${KEY}/${walkClip}/${i}`,
      normalise(readPng(join(source, 'walk', direction, `${String(i).padStart(2, '0')}.png`))),
    );
  frames.set(
    `${KEY}/${restClip}/0`,
    normalise(
      readPng(join(source, 'walk', direction, `${String(transition).padStart(2, '0')}.png`)),
    ),
  );
}

for (const [clip, count] of [
  ['cast', 3],
  ['ko', 1],
] as const) {
  for (let i = 0; i < count; i++) {
    const legacy = readPng(join(legacyActions, clip, `${i}.png`));
    frames.set(`${KEY}/${clip}/${i}`, crop(legacy, 0, 0, legacy.width, legacy.height));
  }
}

const layout = layoutSheet(KEY, counts, FRAME_W, FRAME_H);
const atlas = newImage(layout.width, layout.height);
for (const [name, rect] of layout.frames) {
  const frame = frames.get(name);
  if (!frame) throw new Error(`No pixels prepared for ${name}.`);
  blit(atlas, frame, rect.x, rect.y);
}

const outDir = resolve('public/art/units');
mkdirSync(outDir, { recursive: true });
const webp = await encodeWebp(atlas, 90, true);
writeFileSync(join(outDir, 'kaya-g.webp'), webp);
writeFileSync(
  join(outDir, 'kaya-g.json'),
  `${JSON.stringify(JSON.parse(atlasJsonText(layout.frames, 'kaya-g.webp', layout.width, layout.height)))}\n`,
);
console.log(
  `wrote kaya-g.webp (${layout.width}x${layout.height}, ${Math.round(webp.length / 1024)} KiB) and kaya-g.json`,
);
