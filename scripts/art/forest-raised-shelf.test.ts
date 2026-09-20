import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import decode, { init } from '@jsquash/webp/decode.js';
import { expect, it } from 'vitest';
import {
  FOREST_RAISED_SHELF,
  FOREST_RAISED_SHELF_CELLS,
} from '../../src/content/scenes/forestRoad';

const OUTPUT = 'public/art/maps/forest-scene/raised-shelf.webp';
const EXIT = { x: 19, y: 4 };
const raised = new Set(FOREST_RAISED_SHELF_CELLS.map(({ x, y }) => `${x},${y}`));

it('decodes complete six-cell shelf coverage while leaving the road exit clear', async () => {
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
