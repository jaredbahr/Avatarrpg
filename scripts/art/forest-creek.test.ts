import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { FOREST_CREEK_POOLS } from '../../src/content/scenes/forestRoad';
import { pixelAt, toHex } from './lib/image';
import { encodeWebp } from './lib/webp';
import {
  FOREST_GROUND_QUALITY,
  FOREST_PIECE_TONES,
  loadForestMaterial,
} from './forest-village-material';
import { creekOutput, packCreekPool } from './forest-creek';
import { shoreDistance, shorePosition } from './forest-shoreline';

const material = await loadForestMaterial();
const packed = FOREST_CREEK_POOLS.map((pool) => ({ pool, ...packCreekPool(material, pool) }));
const BED = new Set<string>(Object.values(FOREST_PIECE_TONES.bed));

it('ships the creek plates the packer builds', async () => {
  for (const { pool, image } of packed)
    expect(Buffer.from(await encodeWebp(image, FOREST_GROUND_QUALITY, true)), pool.name).toEqual(
      readFileSync(creekOutput(pool.name)),
    );
});

it('fades the south run-on before every creek plate crop', () => {
  for (const { pool, image } of packed) {
    let fadedRunOn = 0;
    for (let py = 0; py < image.height; py++)
      for (let px = 0; px < image.width; px++) {
        const { y } = shorePosition(px, py, 2, pool);
        if (y < 12) continue;
        const alpha = pixelAt(image, px, py)[3] ?? 0;
        if (alpha > 0 && alpha < 255) fadedRunOn++;
        if (px === 0 || py === 0 || px === image.width - 1 || py === image.height - 1)
          expect(alpha, `${pool.name} ${px},${py} crop edge`).toBe(0);
      }
    expect(fadedRunOn, `${pool.name} has a dissolving water/bank band`).toBeGreaterThan(1_000);
  }
});

it('keeps bed at every creek cell centre and nothing wet on dry ground', () => {
  for (const { pool, image } of packed) {
    for (const { x, y } of pool.cells) {
      const px = Math.round((768 + (x - y) * 64 - pool.patch.x) * 2);
      const py = Math.round(((x + y + 1) * 32 - pool.patch.y) * 2);
      for (let oy = -10; oy <= 10; oy += 2)
        for (let ox = -10; ox <= 10; ox += 2) {
          const sample = pixelAt(image, px + ox, py + oy);
          expect(BED.has(toHex(sample.slice(0, 3))), `${pool.name} ${x},${y}`).toBe(true);
        }
    }
    let wetOnDry = 0;
    for (let py = 0; py < image.height; py++)
      for (let px = 0; px < image.width; px++) {
        const pixel = pixelAt(image, px, py);
        if (pixel[3] === 0 || !BED.has(toHex(pixel.slice(0, 3)))) continue;
        const { x, y } = shorePosition(px, py, 2, pool);
        if (shoreDistance(x, y, pool.cells) > 0 && y < 12) wetOnDry++;
      }
    expect(wetOnDry, pool.name).toBe(0);
  }
});
