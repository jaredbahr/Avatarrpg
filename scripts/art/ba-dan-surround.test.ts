import { readFileSync, statSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { BA_DAN_SURROUND_MODULES } from '../../src/content/scenes/baDan';
import { MASTER, OUTPUT, packSurround, readMaster } from './ba-dan-surround';
import { readImage } from './lib/image';
import { lossyError } from './lib/lossy-compare';
import { decodeWebp } from './lib/webp';

// Decoding and encoding a 1824x640 WebP is slow on a busy machine.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 30_000 });

it('ships the compact two-run surround atlas (the wall runs moved to the dressing atlas) with binary alpha', async () => {
  expect(OUTPUT).toBe('public/art/maps/ba-dan-scene/village-surround.webp');
  expect(statSync(OUTPUT).size).toBeLessThanOrEqual(750 * 1024);
  const atlas = await decodeWebp(new Uint8Array(readFileSync(OUTPUT)));
  expect({ width: atlas.width, height: atlas.height }).toEqual({ width: 1824, height: 640 });
  expect(BA_DAN_SURROUND_MODULES).toEqual({
    'north-backdrop-run': { x: 0, y: 0, width: 912, height: 640 },
    'west-backdrop-run': { x: 912, y: 0, width: 912, height: 640 },
  });
  for (const rect of Object.values(BA_DAN_SURROUND_MODULES)) {
    expect(rect.x + rect.width).toBeLessThanOrEqual(atlas.width);
    expect(rect.y + rect.height).toBeLessThanOrEqual(atlas.height);
  }
  const alpha = new Set<number>();
  for (let at = 3; at < atlas.data.length; at += 4) alpha.add(atlas.data[at] ?? -1);
  expect(alpha).toEqual(new Set([0, 255]));
});

it('re-packs the tracked master to the shipped bytes and decodes within bounds', async () => {
  const master = readMaster();
  expect(readImage(MASTER).data).toEqual(master.data);
  const packed = await packSurround();
  expect(Buffer.from(packed).equals(readFileSync(OUTPUT))).toBe(true);
  // Lossy: alpha exact, RGB bounded in worst and mean error against the master.
  const error = lossyError(master, await decodeWebp(packed));
  expect(error.alphaMismatches).toBe(0);
  expect(error.maxRgb).toBeLessThanOrEqual(90);
  expect(error.meanRgb).toBeLessThan(5);
});
