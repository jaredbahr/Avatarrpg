import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import decode, { init } from '@jsquash/webp/decode.js';
import { expect, it } from 'vitest';
import {
  FOREST_RAISED_SHELF,
  FOREST_RAISED_SHELF_CELLS,
} from '../../src/content/scenes/forestRoad';
import { toHex } from './lib/image';
import { encodeWebp } from './lib/webp';
import {
  FOREST_ALL_TONES,
  FOREST_GROUND_QUALITY,
  FOREST_INK,
  FOREST_PIECE_TONES,
  FOREST_GROUND_TONES,
  loadForestMaterial,
} from './forest-village-material';
import { FOREST_RAISED_SHELF_OUTPUT, packRaisedShelf } from './forest-raised-shelf';

const OUTPUT = FOREST_RAISED_SHELF_OUTPUT;
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

it('ships the shelf the packer builds, in the packed-earth and cut-stone keys', async () => {
  const image = packRaisedShelf(await loadForestMaterial());
  expect(Buffer.from(await encodeWebp(image, FOREST_GROUND_QUALITY, true))).toEqual(
    readFileSync(OUTPUT),
  );
  const allowed = new Set<string>([
    FOREST_INK,
    ...Object.values(FOREST_GROUND_TONES.road),
    ...Object.values(FOREST_PIECE_TONES.stone),
  ]);
  const seen = new Set<string>();
  for (let i = 0; i < image.data.length; i += 4) {
    if ((image.data[i + 3] ?? 0) === 0) continue;
    seen.add(toHex([image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0]));
  }
  // Two materials, two flat tones each plus a thin pale rim, and the ink: no
  // continuous tone is left for a gradient or a distance haze to live in.
  expect([...seen].filter((hex) => !allowed.has(hex))).toEqual([]);
  // The ledge is packed earth standing on a cut stone face; both show.
  expect(seen).toContain(FOREST_GROUND_TONES.road.base);
  expect(seen).toContain(FOREST_PIECE_TONES.stone.base);
  expect(seen).toContain(FOREST_INK);
  // Nothing from the forest's other materials reaches this plate.
  for (const hex of Object.values(FOREST_ALL_TONES.verge)) expect(seen).not.toContain(hex);
});
