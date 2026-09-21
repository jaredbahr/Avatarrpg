import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import {
  FOREST_APRON_MAP,
  FOREST_EXTERIOR_APRON,
  FOREST_ROAD_SCENE,
} from '../../src/content/scenes/forestRoad';
import {
  APRON_FADE,
  APRON_SEAM,
  GUARD_ALPHA,
  OUTPUT,
  apronDepth,
  apronLogical,
  baseField,
  loadBasePlates,
  loadGuardField,
  packApron,
} from './forest-exterior-apron';
import { pixelAt, type Image } from './lib/image';
import { encodeWebp } from './lib/webp';

const plates = await loadBasePlates();
const field = baseField(plates);
const guard = await loadGuardField();
const apron = packApron(plates, guard);

/** The apron pixel for a logical point; the forward projection. */
function apronPixel(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.round(768 + (x - y) * 64 - FOREST_EXTERIOR_APRON.x - 0.5),
    y: Math.round((x + y) * 32 - FOREST_EXTERIOR_APRON.y - 0.5),
  };
}

function apronAt(image: Image, x: number, y: number): readonly number[] {
  const px = apronPixel(x, y);
  return pixelAt(image, px.x, px.y);
}

const distance = (a: readonly number[], b: readonly number[]): number =>
  Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0));

it('ships a reproducible apron that never overpaints authored ground', async () => {
  expect(Buffer.from(await encodeWebp(apron, 86, true))).toEqual(readFileSync(OUTPUT));

  let inside = 0,
    beyond = 0,
    opaque = 0,
    feather = 0,
    overpainted = 0;
  for (let py = 0; py < apron.height; py++)
    for (let px = 0; px < apron.width; px++) {
      const alpha = pixelAt(apron, px, py)[3];
      if (alpha === 0) continue;
      const { x, y } = apronLogical(px, py);
      const depth = apronDepth(x, y);
      if (depth <= 0) {
        inside++;
        // Inside the board the plate may only close what the scene left open.
        if ((pixelAt(guard, px, py)[3] ?? 0) >= GUARD_ALPHA) overpainted++;
      }
      if (depth >= APRON_FADE) beyond++;
      if (alpha === 255) opaque++;
      else feather++;
    }
  expect({ overpainted, beyond }).toEqual({ overpainted: 0, beyond: 0 });
  expect(inside, 'the plate closes the seam the authored ground leaves').toBeGreaterThan(1_000);
  expect(opaque, 'the plate has an opaque band').toBeGreaterThan(1_000);
  expect(feather, 'the plate fades out rather than stopping').toBeGreaterThan(1_000);
});

it('is pinned to the map it surrounds and to the scene that paints it', () => {
  expect(FOREST_APRON_MAP).toEqual({ width: FOREST_ROAD.width, height: FOREST_ROAD.height });
  expect(FOREST_ROAD_SCENE.ground.at(-1)).toEqual({
    url: 'art/maps/forest-scene/exterior-apron.webp',
    ...FOREST_EXTERIOR_APRON,
  });
  // The plate is the rotated bounding box of the band, so its own corners sit
  // outside it; what has to hold is that the whole band has somewhere to land.
  for (const point of [
    { x: -2.5, y: 6 },
    { x: FOREST_APRON_MAP.width + 2.5, y: 6 },
    { x: 10, y: -2.5 },
    { x: 10, y: FOREST_APRON_MAP.height + 2.5 },
  ] as const) {
    const px = apronPixel(point.x, point.y);
    expect(px.x).toBeGreaterThanOrEqual(0);
    expect(px.y).toBeGreaterThanOrEqual(0);
    expect(px.x).toBeLessThan(apron.width);
    expect(px.y).toBeLessThan(apron.height);
  }
});

it('carries the material of the cell it leaves, and fades with the page', () => {
  for (const point of [
    { x: 10.5, y: -0.3 },
    { x: -0.3, y: 4.5 },
    { x: 20.3, y: 5.5 },
    { x: 9.5, y: 12.3 },
    { x: 0.5, y: -0.3 },
    { x: -0.3, y: 10.5 },
  ] as const) {
    expect(apronAt(apron, point.x, point.y)[3], `${point.x},${point.y} is painted`).toBeGreaterThan(
      150,
    );
  }

  // Mean authored colour for each material, measured inside the board.
  const mean = (key: string): readonly number[] => {
    const cells = FOREST_ROAD.rows.flatMap((row, y) =>
      [...row].flatMap((value, x) => (value === key ? [{ x, y }] : [])),
    );
    const total = [0, 0, 0];
    let counted = 0;
    for (const cell of cells) {
      const sample = apronAt(field, cell.x + 0.5, cell.y + 0.5);
      if ((sample[3] ?? 0) < 200) continue;
      counted++;
      for (let channel = 0; channel < 3; channel++)
        total[channel] = (total[channel] ?? 0) + (sample[channel] ?? 0);
    }
    return total.map((value) => value / Math.max(1, counted));
  };
  const road = mean('=');
  const meadow = mean(',');
  const leaves = (x: number, y: number): readonly number[] => apronAt(apron, x, y).slice(0, 3);
  // The road leaves the board as road on both flanks; the meadow stays meadow.
  for (const point of [
    { x: -1.5, y: 4.5 },
    { x: 21.5, y: 4.5 },
  ] as const) {
    const colour = leaves(point.x, point.y);
    expect(distance(colour, road), 'the road is carried out').toBeLessThan(
      distance(colour, meadow),
    );
  }
  const grass = leaves(-1.5, 1.5);
  expect(distance(grass, meadow), 'the meadow is carried out').toBeLessThan(distance(grass, road));

  // The authored packs feather to 0 across the rim, so the plate fills that
  // band; with it, nothing along the rim reads as page showing through.
  for (const point of [
    { x: 10.5, y: -0.12 },
    { x: -0.12, y: 1.5 },
    { x: 10.5, y: FOREST_APRON_MAP.height + 0.12 },
    { x: FOREST_APRON_MAP.width + 0.12, y: 4.5 },
  ] as const) {
    const seam = apronAt(apron, point.x, point.y)[3] ?? 0;
    const open = apronAt(guard, point.x, point.y)[3] ?? 0;
    const covered = seam + (open * (255 - seam)) / 255;
    expect(covered, `${point.x},${point.y} is closed`).toBeGreaterThan(245);
  }
  expect(APRON_SEAM).toBeGreaterThan(0.2);

  for (const point of [
    { x: -2.35, y: 6 },
    { x: 22.35, y: 6 },
    { x: 10, y: -2.35 },
    { x: 10, y: 14.35 },
  ] as const) {
    expect(apronAt(apron, point.x, point.y)[3], 'past the fade the page shows').toBe(0);
  }
});
