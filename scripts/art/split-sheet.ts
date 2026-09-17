/** Split a transparent 3x2 pose sheet at clear gutters before normalising it.
 * Rows: idle/0, idle/1, cast/0; cast/1, cast/2, ko/0.
 * Refuses a cut through visible art instead of silently amputating a pose.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readPng, writePng } from './lib/image';
import type { Image } from './lib/image';
import { crop } from './lib/trim';

function gutter(image: Image, axis: 'x' | 'y', target: number, radius: number): number {
  const limit = axis === 'x' ? image.width : image.height;
  const across = axis === 'x' ? image.height : image.width;
  const candidates: number[] = [];
  for (
    let p = Math.max(1, Math.floor(target - radius));
    p < Math.min(limit - 1, target + radius);
    p++
  ) {
    let clear = true;
    for (let q = 0; q < across; q++) {
      const x = axis === 'x' ? p : q;
      const y = axis === 'y' ? p : q;
      if ((image.data[(y * image.width + x) * 4 + 3] ?? 0) > 8) {
        clear = false;
        break;
      }
    }
    if (clear) candidates.push(p);
  }
  candidates.sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
  const best = candidates[0];
  if (best === undefined)
    throw new Error(`No clear ${axis} gutter near ${Math.round(target)}; regenerate the sheet.`);
  return best;
}

/** Isolate a regular grid without cutting through any visible pixel. */
export function splitGrid(image: Image, columns: number, rows: number): Image[] {
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 1)
    throw new Error('Grid dimensions must be positive integers.');
  const ys = [
    0,
    ...Array.from({ length: rows - 1 }, (_, i) =>
      gutter(image, 'y', (image.height * (i + 1)) / rows, image.height / rows / 6),
    ),
    image.height,
  ];
  const cells: Image[] = [];
  for (let row = 0; row < rows; row++) {
    const top = ys[row],
      bottom = ys[row + 1];
    if (top === undefined || bottom === undefined || bottom <= top) throw new Error('Invalid row.');
    const strip = crop(image, { x: 0, y: top, width: image.width, height: bottom - top });
    const xs = [
      0,
      ...Array.from({ length: columns - 1 }, (_, i) =>
        gutter(strip, 'x', (image.width * (i + 1)) / columns, image.width / columns / 6),
      ),
      image.width,
    ];
    for (let col = 0; col < columns; col++) {
      const left = xs[col],
        right = xs[col + 1];
      if (left === undefined || right === undefined || right <= left)
        throw new Error('Invalid column.');
      cells.push(crop(strip, { x: left, y: 0, width: right - left, height: strip.height }));
    }
  }
  return cells;
}

export function splitSheet(input: string, unit: string, out = 'art/raw'): void {
  const image = readPng(input);
  const mid = gutter(image, 'y', image.height / 2, image.height / 12);
  const poses = ['idle/0', 'idle/1', 'cast/0', 'cast/1', 'cast/2', 'ko/0'];
  for (let row = 0; row < 2; row++) {
    const y = row === 0 ? 0 : mid;
    const height = row === 0 ? mid : image.height - mid;
    const strip = crop(image, { x: 0, y, width: image.width, height });
    const xs = [
      0,
      gutter(strip, 'x', image.width / 3, image.width / 12),
      gutter(strip, 'x', (image.width * 2) / 3, image.width / 12),
      image.width,
    ];
    for (let col = 0; col < 3; col++) {
      const left = xs[col];
      const right = xs[col + 1];
      const pose = poses[row * 3 + col];
      if (left === undefined || right === undefined || !pose)
        throw new Error('Invalid pose layout');
      const path = join(out, unit, `${pose}.png`);
      mkdirSync(dirname(path), { recursive: true });
      writePng(path, crop(strip, { x: left, y: 0, width: right - left, height }));
    }
  }
}

if (process.argv[1]?.endsWith('split-sheet.ts')) {
  const [input, unit, out] = process.argv.slice(2);
  if (!input || !unit) throw new Error('Usage: split-sheet.ts INPUT.png UNIT_KEY [OUTPUT_DIR]');
  splitSheet(input, unit, out);
}
