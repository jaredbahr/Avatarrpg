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
import { apronDepth, forestApronAlpha } from './forest-exterior-apron';
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

it('clips every exterior creek pixel to the apron contour before every plate crop', () => {
  for (const { pool, image } of packed) {
    let fadedRunOn = 0;
    const offenders: string[] = [];
    for (let py = 0; py < image.height; py++)
      for (let px = 0; px < image.width; px++) {
        const { x, y } = shorePosition(px, py, 2, pool);
        if (apronDepth(x, y) <= 0) continue;
        const alpha = pixelAt(image, px, py)[3] ?? 0;
        const apronAlpha = forestApronAlpha(apronDepth(x, y), x, y);
        if (alpha > 0 && apronAlpha <= 0) offenders.push(`${px},${py}: painted beyond fade`);
        if (alpha > apronAlpha) offenders.push(`${px},${py}: ${alpha}>${apronAlpha}`);
        if (alpha > 0 && alpha < 255) fadedRunOn++;
        if (
          (px === 0 || py === 0 || px === image.width - 1 || py === image.height - 1) &&
          alpha !== 0
        )
          offenders.push(`${px},${py}: non-clear crop edge (${alpha})`);
      }
    expect(offenders, `${pool.name} exterior contour offenders`).toEqual([]);
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
