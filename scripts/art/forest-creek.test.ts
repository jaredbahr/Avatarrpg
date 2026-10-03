import { expect, it } from 'vitest';
import { FOREST_CREEK_POOLS } from '../../src/content/scenes/forestRoad';
import { pixelAt } from './lib/image';
import { expectPackerAlpha, expectShippedPin, readShipped } from './lib/shipped-pin';
import { loadForestMaterial } from './forest-village-material';
import { creekOutput, packCreekPool } from './forest-creek';
import { apronDepth, forestApronAlpha } from './forest-exterior-apron';
import { shoreDistance, shorePosition } from './forest-shoreline';

const material = await loadForestMaterial();
const packed = FOREST_CREEK_POOLS.map((pool) => ({ pool, ...packCreekPool(material, pool) }));

/** Generated 2026-10-03 (see docs/art/forest-pond-shoreline.md); not packer output. */
const CREEK_PINS: Record<string, { bytes: number; sha256: string }> = {
  west: {
    bytes: 47174,
    sha256: '5bf397bd4fa1ccec0cca0e8503fd5c7e495f27863ee1486b54a20be6029ab6f5',
  },
  east: {
    bytes: 46462,
    sha256: '157119dc31c7196c19b3efc27d2d9699b129dcd8725ccc9031a4537e0094585b',
  },
};

it('ships the generated creek plates on the packer footprint', async () => {
  for (const { pool, image } of packed) {
    const pin = CREEK_PINS[pool.name];
    expect(pin, `${pool.name} has a recorded pin`).toBeDefined();
    if (pin) expectShippedPin(creekOutput(pool.name), pin);
    await expectPackerAlpha(creekOutput(pool.name), image);
  }
});

it('clips every exterior creek pixel to the apron contour before every plate crop', async () => {
  for (const { pool } of packed) {
    const image = await readShipped(creekOutput(pool.name));
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

/**
 * Measured on the shipped plates 2026-10-03: every cell-centre patch (21x21 px,
 * step 1) mean blue-minus-red 74 to 101 and luma 44 to 64; 0.99 to 1.00 of each
 * patch above 20 (east 12,11 holds a few off-hue pixels, min -13); dry bank
 * inside the map (beyond 0.1 cell of the water, y < 12) has no water-keyed
 * pixel at all (1,507 west, 170 east).
 */
it('shows blue water at every creek cell centre and nothing wet on dry ground', async () => {
  for (const { pool } of packed) {
    const image = await readShipped(creekOutput(pool.name));
    for (const { x, y } of pool.cells) {
      const px = Math.round((768 + (x - y) * 64 - pool.patch.x) * 2);
      const py = Math.round(((x + y + 1) * 32 - pool.patch.y) * 2);
      let n = 0,
        blueMinusRed = 0,
        blue = 0;
      for (let oy = -10; oy <= 10; oy++)
        for (let ox = -10; ox <= 10; ox++) {
          const sample = pixelAt(image, px + ox, py + oy);
          n++;
          blueMinusRed += sample[2] - sample[0];
          if (sample[3] === 255 && sample[2] - sample[0] > 20) blue++;
        }
      expect(blueMinusRed / n, `${pool.name} ${x},${y} blue minus red`).toBeGreaterThan(50);
      expect(blue / n, `${pool.name} ${x},${y} opaque blue share`).toBeGreaterThan(0.95);
    }
    let dry = 0,
      wetOnDry = 0;
    for (let py = 0; py < image.height; py++)
      for (let px = 0; px < image.width; px++) {
        const [r, g, b, a] = pixelAt(image, px, py);
        if (a < 200) continue;
        const { x, y } = shorePosition(px, py, 2, pool);
        if (y >= 12 || shoreDistance(x, y, pool.cells) <= 0.1) continue;
        dry++;
        if (b > r + 5 && g > r + 5) wetOnDry++;
      }
    expect(dry, `${pool.name} has dry bank samples`).toBeGreaterThan(100);
    expect(wetOnDry / dry, `${pool.name} water-keyed share of the dry bank`).toBeLessThan(0.01);
  }
});
