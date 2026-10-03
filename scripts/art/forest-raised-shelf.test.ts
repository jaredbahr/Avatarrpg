import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import decode, { init } from '@jsquash/webp/decode.js';
import { expect, it } from 'vitest';
import {
  FOREST_PERCH_CELLS,
  FOREST_RAISED_SHELF,
  FOREST_RAISED_SHELF_CELLS,
} from '../../src/content/scenes/forestRoad';
import { toHex } from './lib/image';
import { expectPackerAlpha, expectShippedPin, readShipped } from './lib/shipped-pin';
import { loadForestMaterial } from './forest-village-material';
import {
  FOREST_RAISED_SHELF_OUTPUT,
  SHELF_RISE,
  packRaisedShelf,
  shelfTiers,
} from './forest-raised-shelf';

const LIP_STEP = 15;
const OUTPUT = FOREST_RAISED_SHELF_OUTPUT;
const EXIT = { x: 19, y: 4 };
const raised = new Set(
  [...FOREST_RAISED_SHELF_CELLS, ...FOREST_PERCH_CELLS].map(({ x, y }) => `${x},${y}`),
);

it('decodes complete bank and perch coverage while leaving the road exit clear', async () => {
  const packed = readFileSync(OUTPUT);
  const require = createRequire(import.meta.url);
  await init(
    await WebAssembly.compile(
      readFileSync(require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm')),
    ),
  );
  const decoded = await decode(
    packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength),
  );
  expect({ width: decoded.width, height: decoded.height }).toEqual({
    width: FOREST_RAISED_SHELF.width,
    height: FOREST_RAISED_SHELF.height,
  });

  let transparentExit = 0;
  const missingRaised = new Map<string, number>();
  for (let py = 0; py < decoded.height; py++)
    for (let px = 0; px < decoded.width; px++) {
      const worldX = FOREST_RAISED_SHELF.x + px + 0.5;
      const worldY = FOREST_RAISED_SHELF.y + py + 0.5;
      const diagonal = (worldX - 768) / 64;
      const sum = worldY / 32;
      const cellX = Math.floor((diagonal + sum) / 2);
      const cellY = Math.floor((sum - diagonal) / 2);
      const alpha = decoded.data[(py * decoded.width + px) * 4 + 3];
      if (cellX === EXIT.x && cellY === EXIT.y) {
        if (alpha !== 0) transparentExit++;
      } else if (raised.has(`${cellX},${cellY}`) && alpha !== 255) {
        const key = `${cellX},${cellY}`;
        missingRaised.set(key, (missingRaised.get(key) ?? 0) + 1);
      }
    }

  expect(transparentExit).toBe(0);
  expect([...missingRaised.entries()]).toEqual([]);
});

/** Generated 2026-10-03 (see docs/art/forest-raised-shelf.md); not packer output. */
const SHELF_PIN = {
  bytes: 23442,
  sha256: '764d2257089b58928af59bb6faaf329307d3cc0de92c88319cb967df92fd2511',
};

it('ships the generated shelf on the packer footprint', async () => {
  expectShippedPin(OUTPUT, SHELF_PIN);
  await expectPackerAlpha(OUTPUT, packRaisedShelf(await loadForestMaterial()));
});

it('stands the top above a darker face, with a light rim along the lip', async () => {
  const image = await readShipped(OUTPUT);
  const at = (px: number, py: number) => {
    const i = (py * image.width + px) * 4;
    return {
      alpha: image.data[i + 3] ?? 0,
      hex: toHex([image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0]),
      luma:
        0.2126 * (image.data[i] ?? 0) +
        0.7152 * (image.data[i + 1] ?? 0) +
        0.0722 * (image.data[i + 2] ?? 0),
    };
  };
  // The tier of the cell a face stands in: one rise for the bank, two for the
  // perch where its east face drops past the rim to the ground.
  const tierOf = shelfTiers(FOREST_RAISED_SHELF_CELLS, FOREST_PERCH_CELLS);
  const tierAt = (px: number, py: number): number => {
    const worldX = FOREST_RAISED_SHELF.x + px + 0.5,
      worldY = FOREST_RAISED_SHELF.y + py + 0.5;
    const diagonal = (worldX - 768) / 64,
      sum = worldY / 32;
    return tierOf(Math.floor((diagonal + sum) / 2), Math.floor((sum - diagonal) / 2));
  };
  // Walk down every column: wherever the shelf ends below, the last rise (or
  // two) of pixels above that end are the face, and the two at its top are the
  // lip. The road beside the shelf has neither, which is the difference.
  const face = { n: 0, sum: 0 },
    top = { n: 0, sum: 0 };
  let columns = 0,
    rimmedLips = 0;
  for (let px = 0; px < image.width; px++) {
    let run = 0;
    for (let py = 0; py <= image.height; py++) {
      const opaque = py < image.height && at(px, py).alpha === 255;
      if (opaque) {
        run++;
        continue;
      }
      const rise = Math.max(1, tierAt(px, py - 1)) * SHELF_RISE;
      if (run > rise + 8) {
        columns++;
        const end = py;
        const lip = end - rise;
        // The generated lip is a pale rim over the shaded face, not a ruled ink line:
        // the light edge just above the lip stands well clear of the face below it.
        let rim = 0,
          below = 0;
        for (let y = lip - 3; y <= lip; y++) rim = Math.max(rim, at(px, y).luma);
        for (let y = lip + 2; y <= lip + 5; y++) below += at(px, y).luma / 4;
        if (rim - below > LIP_STEP) rimmedLips++;
        for (let y = lip + 2; y < end - 2; y++) {
          face.n++;
          face.sum += at(px, y).luma;
        }
        for (let y = end - run + 4; y < lip - 1; y++) {
          top.n++;
          top.sum += at(px, y).luma;
        }
      }
      run = 0;
    }
  }
  expect(columns).toBeGreaterThan(200);
  expect(rimmedLips / columns).toBeGreaterThan(0.6);
  expect(face.sum / face.n).toBeLessThan((top.sum / top.n) * 0.95);
});
