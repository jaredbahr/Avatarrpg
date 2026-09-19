/** Pack two reviewed tea cels into each Riverside atlas's unused final cells. */
import { readFileSync, writeFileSync } from 'node:fs';
import { readPng, writePng, pixelAt, setPixel } from './lib/image';
import { crop, alphaBounds } from './lib/trim';
import { scaleTo } from './lib/scale';
import { placeOnBaseline } from './lib/align';

for (const name of ['sura', 'kaya']) {
  const raw = readPng(`docs/art/sources/riverside-tea/${name}.png`);
  const path = `public/art/units/riverside-locomotion-${name}`;
  const atlas = readPng(`${path}.png`);
  const meta = JSON.parse(readFileSync(`${path}.json`, 'utf8')) as {
    frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
  };
  if (atlas.width !== 1024 || atlas.height !== 576) throw new Error('Unexpected Riverside atlas');
  for (let i = 0; i < 2; i++) {
    const half = crop(raw, {
      x: i * Math.floor(raw.width / 2),
      y: 0,
      width: Math.floor(raw.width / 2),
      height: raw.height,
    });
    const bounds = alphaBounds(half);
    if (!bounds) throw new Error('Empty tea source');
    const ink = crop(half, bounds);
    // Uniform scaling preserves anatomy; seated height is lower than standing.
    const scaled = scaleTo(ink, Math.round((ink.width * 88) / ink.height), 88);
    const placed = placeOnBaseline(scaled, 128, 192);
    if (placed.problems.length) throw new Error(placed.problems.join(', '));
    const x = (6 + i) * 128,
      y = 384;
    for (let yy = 0; yy < 192; yy++) {
      for (let xx = 0; xx < 128; xx++)
        setPixel(atlas, x + xx, y + yy, pixelAt(placed.image, xx, yy));
    }
    meta.frames[`unit.village.${name}/tea/${i}`] = { frame: { x, y, w: 128, h: 192 } };
  }
  writePng(`${path}.png`, atlas);
  writeFileSync(`${path}.json`, JSON.stringify(meta) + '\n');
}
