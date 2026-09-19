import { expect, test, type Page } from '@playwright/test';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';
import { average, screenshotPixels, type Rgb } from './pixels';

const svg = (colour: string): string =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${colour}"/></svg>`)}`;

const red = svg('#d94444');
const blue = svg('#4477d9');
const radius = 3;
const patch = (url: string, x: number, y: number) => ({
  url,
  x: 1024 + (x - y) * 64 - 32,
  y: (x + y + 1) * 32 - 32,
  width: 64,
  height: 64,
});

type Pos = { readonly x: number; readonly y: number };

const PATCH = { x: 5, y: 7 } as const;
const VALID = { x: 6, y: 7 } as const;
const FALLBACK = { x: 5, y: 7 } as const;

async function tileCentres(page: Page, probes: Record<string, Pos>): Promise<Record<string, Pos>> {
  const points = await page.evaluate((entries) => {
    const camera = window.fnt?.app.rendererCamera?.();
    if (!camera) return null;
    const m = camera.groundTransform;
    return Object.fromEntries(
      entries.map(([name, p]) => {
        const x = (p.x + 0.5) * 64;
        const y = (p.y + 0.5) * 64;
        return [name, { x: m.a * x + m.c * y + m.tx, y: m.b * x + m.d * y + m.ty }];
      }),
    );
  }, Object.entries(probes));
  if (!points) throw new Error('No map camera');
  return points;
}

/** Every read is inside the canvas, so a black no-sample average cannot pass. */
async function samples<P extends Record<string, Pos>>(
  page: Page,
  probes: P,
): Promise<{ [K in keyof P]: Rgb }> {
  const canvas = page.locator('.explore-scene .map-canvas');
  const [pixels, box, points] = await Promise.all([
    screenshotPixels(canvas),
    canvas.boundingBox(),
    tileCentres(page, probes),
  ]);
  if (!box) throw new Error('Map canvas has no bounding box');
  for (const [name, point] of Object.entries(points)) {
    expect(point.x, `${name} x is inside the map canvas`).toBeGreaterThan(radius);
    expect(point.x, `${name} x is inside the map canvas`).toBeLessThan(box.width - radius);
    expect(point.y, `${name} y is inside the map canvas`).toBeGreaterThan(radius);
    expect(point.y, `${name} y is inside the map canvas`).toBeLessThan(box.height - radius);
  }
  return Object.fromEntries(
    Object.entries(points).map(([name, point]) => [
      name,
      average(pixels, point.x, point.y, radius),
    ]),
  ) as { [K in keyof P]: Rgb };
}

function expectRed(pixel: Rgb): void {
  expect(pixel.r).toBeGreaterThan(pixel.b + 55);
  expect(pixel.r).toBeGreaterThan(170);
}

function expectBlue(pixel: Rgb): void {
  expect(pixel.b).toBeGreaterThan(pixel.r + 55);
  expect(pixel.b).toBeGreaterThan(170);
}

/** Replaces only the scene fixture. The real map rows remain the surface source. */
async function installPartialScene(page: Page, ground: readonly ReturnType<typeof patch>[]) {
  await page.evaluate((pieces) => {
    const map = window.fnt?.app.content.maps.get('ba_dan_village');
    if (!map) throw new Error('Missing Ba Dan map');
    Object.defineProperty(map, 'scene', {
      value: { groundMode: 'partial', paintedWater: true, ground: pieces, scenery: [] },
      configurable: true,
    });
  }, ground);
}

async function setPermanentWater(page: Page, pos: Pos, present: boolean): Promise<void> {
  await page.evaluate(
    ({ pos, present }) => {
      const map = window.fnt?.app.content.maps.get('ba_dan_village');
      if (!map) throw new Error('Missing Ba Dan map');
      const row = map.rows[pos.y];
      if (!row) throw new Error('Missing fixture row');
      const tile = present ? '~' : '=';
      Object.defineProperty(map, 'rows', {
        value: map.rows.map((candidate, y) =>
          y === pos.y
            ? `${candidate.slice(0, pos.x)}${tile}${candidate.slice(pos.x + 1)}`
            : candidate,
        ),
        configurable: true,
      });
    },
    { pos, present },
  );
}

async function reenterVillage(page: Page): Promise<void> {
  await enterNode(page, 'riverside_explore');
  await page.locator('.explore-scene .map-canvas').waitFor();
  await waitForIdle(page);
  await enterNode(page, 'village_explore');
  await page.locator('.explore-scene .map-canvas').waitFor();
  await waitForIdle(page);
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`partial ground keeps an opaque patch under permanent water on ${renderer}`, async ({
    page,
  }) => {
    await resetStorage(page, `?renderer=${renderer}`);
    await installPartialScene(page, [patch(red, PATCH.x, PATCH.y), patch(blue, VALID.x, VALID.y)]);
    await startGame(page, ['Kaya'], ['kaya'], 'partial-ground-water');
    await enterNode(page, 'village_explore');
    await page.locator('.explore-scene .map-canvas').waitFor();
    await expect
      .poll(async () => {
        const { patch: loaded, valid } = await samples(page, { patch: PATCH, valid: VALID });
        return loaded.r > loaded.b + 55 && valid.b > valid.r + 55;
      })
      .toBe(true);
    const bare = await samples(page, { patch: PATCH, valid: VALID });
    expectRed(bare.patch);
    expectBlue(bare.valid);

    await setPermanentWater(page, PATCH, true);
    await reenterVillage(page);
    const underwater = await samples(page, { patch: PATCH, valid: VALID });
    expectBlue(underwater.valid);
    // The red image is visible before the real grid's water surface is enabled;
    // water then tints that same image rather than replacing it or being hidden below it.
    expect(underwater.patch.r).toBeLessThan(bare.patch.r - 35);
    expect(underwater.patch.b).toBeGreaterThan(bare.patch.b + 35);

    await setPermanentWater(page, PATCH, false);
    await reenterVillage(page);
    const restored = await samples(page, { patch: PATCH, valid: VALID });
    expectRed(restored.patch);
    expectBlue(restored.valid);
  });

  test(`partial ground retains valid pieces when one is missing on ${renderer}`, async ({
    page,
  }) => {
    await resetStorage(page, `?renderer=${renderer}`);
    // Establish the actual procedural base before adding any scene pieces.
    await installPartialScene(page, []);
    await startGame(page, ['Kaya'], ['kaya'], 'partial-ground-fallback');
    await enterNode(page, 'village_explore');
    await page.locator('.explore-scene .map-canvas').waitFor();
    const baseline = await samples(page, { fallback: FALLBACK });

    await installPartialScene(page, [
      patch('art/maps/missing-partial-ground.webp', FALLBACK.x, FALLBACK.y),
      patch(blue, VALID.x, VALID.y),
    ]);
    await reenterVillage(page);
    await expect
      .poll(async () => {
        const { valid } = await samples(page, { fallback: FALLBACK, valid: VALID });
        return valid.b > valid.r + 55 && valid.b > 170;
      })
      .toBe(true);
    const loaded = await samples(page, { fallback: FALLBACK, valid: VALID });
    expectBlue(loaded.valid);
    // A missing piece exposes its original procedural tile; it must neither turn red nor erase a sibling.
    expect(Math.abs(loaded.fallback.r - baseline.fallback.r)).toBeLessThan(12);
    expect(Math.abs(loaded.fallback.g - baseline.fallback.g)).toBeLessThan(12);
    expect(Math.abs(loaded.fallback.b - baseline.fallback.b)).toBeLessThan(12);
    expect(loaded.fallback.r).not.toBeGreaterThan(loaded.fallback.b + 55);
  });
}
