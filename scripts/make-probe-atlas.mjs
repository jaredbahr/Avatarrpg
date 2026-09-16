/**
 * The probe atlas: a real sheet of flat-colour frames, committed so the
 * sheet loader, the clip runtime and both backends' frame drawing are
 * exercised in CI before any generated art exists (ADR 0003, amended).
 *
 *   node scripts/make-probe-atlas.mjs
 *
 * Five frames of 128x192 in a row: two idle poses and three cast poses,
 * each a solid colour with a dark border so the frame's edges show too.
 * `e2e/sheets.spec.ts` points a unit at `unit.test.probe` and reads the
 * colour back at the frame's centre.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './lib/png.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../public/art/test');

const KEY = 'unit.test.probe';
const FRAME_W = 128;
const FRAME_H = 192;
const BORDER = 4;
const INK = [0x1b, 0x14, 0x10, 0xff];

/** Pose colours, far apart so a sample cannot be mistaken for a neighbour. */
export const PROBE_FRAMES = [
  ['idle', 0, [214, 58, 52, 255]],
  ['idle', 1, [66, 178, 90, 255]],
  ['cast', 0, [58, 110, 214, 255]],
  ['cast', 1, [232, 196, 58, 255]],
  ['cast', 2, [196, 74, 196, 255]],
];

const width = FRAME_W * PROBE_FRAMES.length;
const height = FRAME_H;
const rgba = new Uint8Array(width * height * 4);
const frames = {};

PROBE_FRAMES.forEach(([clip, index, color], slot) => {
  const x0 = slot * FRAME_W;
  for (let y = 0; y < FRAME_H; y++) {
    for (let x = 0; x < FRAME_W; x++) {
      const edge = x < BORDER || y < BORDER || x >= FRAME_W - BORDER || y >= FRAME_H - BORDER;
      const px = edge ? INK : color;
      const o = (y * width + x0 + x) * 4;
      rgba[o] = px[0];
      rgba[o + 1] = px[1];
      rgba[o + 2] = px[2];
      rgba[o + 3] = px[3];
    }
  }
  frames[`${KEY}/${clip}/${index}`] = {
    frame: { x: x0, y: 0, w: FRAME_W, h: FRAME_H },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: FRAME_W, h: FRAME_H },
    sourceSize: { w: FRAME_W, h: FRAME_H },
  };
});

mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'probe.png'), encodePng(width, height, rgba));
writeFileSync(
  resolve(outDir, 'probe.json'),
  `${JSON.stringify(
    {
      frames,
      meta: {
        app: 'four-nations-tactics',
        version: '1',
        image: 'probe.png',
        format: 'RGBA8888',
        size: { w: width, h: height },
        scale: '1',
      },
    },
    null,
    2,
  )}\n`,
);
console.log(`wrote ${outDir}/probe.png (${width}x${height}) and probe.json`);
