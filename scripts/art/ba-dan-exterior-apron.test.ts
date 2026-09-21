import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { TERRAIN_STYLES } from '../../src/render/palettes';
import { pixelAt, parseHex } from './lib/image';
import { encodeWebp } from './lib/webp';
import {
  APRON_FADE,
  MATERIAL_REACH,
  OUTPUT,
  apronDepth,
  apronLogical,
  apronPixel,
  packApron,
} from './ba-dan-exterior-apron';

const distance = (a: readonly number[], b: readonly number[]): number =>
  Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0));

it('ships a reproducible apron that never paints a playable pixel', async () => {
  const image = packApron();
  expect(Buffer.from(await encodeWebp(image, 82, true))).toEqual(readFileSync(OUTPUT));

  let inside = 0,
    beyond = 0,
    opaque = 0,
    feather = 0;
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++) {
      const alpha = pixelAt(image, px, py)[3];
      if (alpha === 0) continue;
      const { x, y } = apronLogical(px, py);
      const depth = apronDepth(x, y);
      if (depth <= 0) inside++;
      if (depth >= APRON_FADE) beyond++;
      if (alpha === 255) opaque++;
      else feather++;
    }
  expect({ inside, beyond }).toEqual({ inside: 0, beyond: 0 });
  expect(opaque, 'the plate has an opaque band').toBeGreaterThan(1_000);
  expect(feather, 'the plate fades out rather than stopping').toBeGreaterThan(1_000);
});

it('starts opaque at the rim, has room for the whole band, and carries grass outward', () => {
  // Byte-identical to the shipped file, which the first test pins.
  const image = packApron();
  const alphaAt = (x: number, y: number): number => {
    const px = apronPixel(x, y);
    return pixelAt(image, px.x, px.y)[3];
  };
  expect(alphaAt(10.5, -0.05), 'north rim').toBe(255);
  expect(alphaAt(-0.05, 7.5), 'west road rim').toBe(255);
  expect(alphaAt(23.5, 16.05), 'south rim').toBe(255);
  expect(image.width, 'the plate covers the map and the band').toBe(3200);
  expect(image.height).toBe(1600);
  expect(apronDepth(-2.4, 8)).toBeGreaterThan(0);
  expect(apronDepth(26.4, 8)).toBeGreaterThan(0);
  // The meadow takes over once the outer cell's material has had its say.
  const grass = parseHex(TERRAIN_STYLES.grass.fill);
  const road = parseHex(TERRAIN_STYLES.road.fill);
  const sample = (x: number, y: number): readonly number[] => {
    const px = apronPixel(x, y);
    return pixelAt(image, px.x, px.y).slice(0, 3);
  };
  expect(distance(sample(-0.4, 7.5), road)).toBeLessThan(distance(sample(-0.4, 7.5), grass));
  expect(distance(sample(10.5, -MATERIAL_REACH - 0.2), grass)).toBeLessThan(
    distance(sample(10.5, -MATERIAL_REACH - 0.2), road),
  );
  expect(distance(sample(-1.6, 3.5), grass)).toBeLessThan(distance(sample(-1.6, 3.5), road));
});
