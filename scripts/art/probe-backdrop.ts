/**
 * The probe painting: the forest road's layout image at 32 px a tile with a
 * magenta 2x2 block over tiles (3,2) to (4,3), committed so the painting slot
 * is exercised in CI before any painting exists (ADR 0009).
 *
 *   npx tsx scripts/art/probe-backdrop.ts
 *
 * `e2e/backdrop.spec.ts` puts it under the forest road on both backends and
 * reads the block back where the camera says tile (3,2) is; the gallery's
 * beat 18 shows it. It carries no grid lines of its own, so the spec can
 * check the renderer draws the Show grid lines over a painting.
 */

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import type { Image } from './lib/image';
import { writePng } from './lib/image';
import { renderLayout } from './lib/layout';

export const PROBE_PATH = 'public/art/test/backdrop.png';
export const PROBE_PX = 32;
export const PROBE_COLOR = '#ff00ff';
export const PROBE_TILES = [
  { x: 3, y: 2 },
  { x: 4, y: 2 },
  { x: 3, y: 3 },
  { x: 4, y: 3 },
] as const;

export function probeBackdrop(): Image {
  return renderLayout(FOREST_ROAD, PROBE_PX, {
    marks: PROBE_TILES.map((pos) => ({ pos, color: PROBE_COLOR })),
  });
}

if (process.argv[1]?.endsWith('probe-backdrop.ts')) {
  const path = resolve(PROBE_PATH);
  mkdirSync(dirname(path), { recursive: true });
  const image = probeBackdrop();
  writePng(path, image);
  console.warn(`wrote ${PROBE_PATH} (${image.width}x${image.height})`);
}
