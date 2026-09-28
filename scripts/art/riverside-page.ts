/**
 * Packs Kaya's and Sura's riverside-only cels, the wave and the seated tea,
 * into a small lossless page of their G sheets (ADR 0054).
 *
 * The riverside draws both from their PixelLab G atlases; these four cels a
 * character are the only art the retired four-way riverside sheets had that
 * the G sets do not. They are preserved, not redrawn:
 *
 * - the two wave cels are byte-exact crops of the retired sheets, kept in
 *   `art/source/<name>-riverside/wave/`;
 * - the two tea cels are rebuilt from the reviewed imagegen strips in
 *   `docs/art/sources/riverside-tea/` exactly as they were first packed
 *   (docs/art/riverside-tea.md): uniformly scaled to 88 px of visible height
 *   and placed on the 128 x 192 baseline.
 *
 * Usage: node --import tsx scripts/art/riverside-page.ts
 */

import { writeFileSync } from 'node:fs';
import { atlasJsonText } from '../../src/render/sheets/atlasJson';
import { layoutSheet } from '../../src/render/sheets/layout';
import type { Image } from './lib/image';
import { newImage, pixelAt, readPng, setPixel, writePng } from './lib/image';
import { placeOnBaseline } from './lib/align';
import { scaleTo } from './lib/scale';
import { alphaBounds, crop } from './lib/trim';

const FRAME_W = 128;
const FRAME_H = 192;

export const RIVERSIDE_PAGES = {
  kaya: 'unit.fire.kaya',
  sura: 'unit.water.sura',
} as const;

/** The seated hold and sip, as `scripts/art/riverside-tea.ts` first packed them. */
export function teaCels(name: string): Image[] {
  const raw = readPng(`docs/art/sources/riverside-tea/${name}.png`);
  return [0, 1].map((i) => {
    const half = crop(raw, {
      x: i * Math.floor(raw.width / 2),
      y: 0,
      width: Math.floor(raw.width / 2),
      height: raw.height,
    });
    const bounds = alphaBounds(half);
    if (!bounds) throw new Error(`Empty ${name} tea source`);
    const ink = crop(half, bounds);
    // Uniform scaling preserves anatomy; seated height is lower than standing.
    const scaled = scaleTo(ink, Math.round((ink.width * 88) / ink.height), 88);
    const placed = placeOnBaseline(scaled, FRAME_W, FRAME_H);
    if (placed.problems.length) throw new Error(placed.problems.join(', '));
    return placed.image;
  });
}

export function waveCels(name: string): Image[] {
  return [0, 1].map((i) => readPng(`art/source/${name}-riverside/wave/${i}.png`));
}

function blit(target: Image, source: Image, x0: number, y0: number): void {
  for (let y = 0; y < source.height; y++)
    for (let x = 0; x < source.width; x++) setPixel(target, x0 + x, y0 + y, pixelAt(source, x, y));
}

export function buildRiversidePage(name: keyof typeof RIVERSIDE_PAGES): void {
  const key = RIVERSIDE_PAGES[name];
  const cels = { wave: waveCels(name), tea: teaCels(name) };
  const layout = layoutSheet(key, { wave: 2, tea: 2 }, FRAME_W, FRAME_H);
  const atlas = newImage(layout.width, layout.height);
  for (const [clip, list] of Object.entries(cels) as ['wave' | 'tea', Image[]][]) {
    list.forEach((cel, i) => {
      if (cel.width !== FRAME_W || cel.height !== FRAME_H)
        throw new Error(`${name} ${clip}/${i} is ${cel.width}x${cel.height}`);
      const frame = layout.frames.get(`${key}/${clip}/${i}`);
      if (!frame) throw new Error(`No slot for ${clip}/${i}`);
      blit(atlas, cel, frame.x, frame.y);
    });
  }
  const stem = `riverside-${name}`;
  writePng(`public/art/units/${stem}.png`, atlas);
  writeFileSync(
    `public/art/units/${stem}.json`,
    `${JSON.stringify(JSON.parse(atlasJsonText(layout.frames, `${stem}.png`, layout.width, layout.height)))}\n`,
  );
  console.log(`wrote ${stem}.png (${layout.width}x${layout.height}) and ${stem}.json`);
}

if (process.argv[1]?.endsWith('riverside-page.ts')) {
  buildRiversidePage('kaya');
  buildRiversidePage('sura');
}
