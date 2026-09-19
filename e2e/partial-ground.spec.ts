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

/**
 * The patch begins #d94444 and WebGL's softest water tint raises blue by at
 * least 23 channels at alpha 0.42. Requiring both colour shifts catches an
 * absent/underlaid surface, while retained red distinguishes a tint over the
 * loaded patch from replacing the patch with procedural water.
 */
function expectWaterOverPatch(bare: Rgb, underwater: Rgb): void {
  expect(bare.r - underwater.r).toBeGreaterThan(35);
  expect(underwater.b - bare.b).toBeGreaterThan(20);
  expect(underwater.r).toBeGreaterThan(underwater.b + 12);
}

function expectTreeDecor(pixel: Rgb): void {
  expect(pixel.g).toBeGreaterThan(pixel.r + 15);
  expect(pixel.g).toBeGreaterThan(pixel.b + 15);
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

async function setMapTile(page: Page, pos: Pos, tile: string): Promise<void> {
  await page.evaluate(
    ({ pos, tile }) => {
      const map = window.fnt?.app.content.maps.get('ba_dan_village');
      if (!map) throw new Error('Missing Ba Dan map');
      const row = map.rows[pos.y];
      if (!row) throw new Error('Missing fixture row');
      Object.defineProperty(map, 'rows', {
        value: map.rows.map((candidate, y) =>
          y === pos.y
            ? `${candidate.slice(0, pos.x)}${tile}${candidate.slice(pos.x + 1)}`
            : candidate,
        ),
        configurable: true,
      });
    },
    { pos, tile },
  );
}

async function setPermanentWater(page: Page, pos: Pos, present: boolean): Promise<void> {
  await setMapTile(page, pos, present ? '~' : '=');
}

async function reenterVillage(page: Page): Promise<void> {
  await enterNode(page, 'riverside_explore');
  await page.locator('.explore-scene .map-canvas').waitFor();
  await waitForIdle(page);
  await enterNode(page, 'village_explore');
  await page.locator('.explore-scene .map-canvas').waitFor();
  await waitForIdle(page);
}

/** Reuse the composited frame that passed readiness; software readback is expensive. */
async function waitForSamples<P extends Record<string, Pos>>(
  page: Page,
  probes: P,
  ready: (value: { [K in keyof P]: Rgb }) => boolean,
  timeout: number,
): Promise<{ [K in keyof P]: Rgb }> {
  let verified: { [K in keyof P]: Rgb } | undefined;
  await expect
    .poll(
      async () => {
        const value = await samples(page, probes);
        if (ready(value)) verified = value;
        return verified !== undefined;
      },
      { timeout },
    )
    .toBe(true);
  if (!verified) throw new Error('Readiness passed without a composited screenshot sample');
  return verified;
}

async function waitForAuthoredColours(
  page: Page,
  includePatch = true,
  timeout = 10_000,
): Promise<{ patch: Rgb; valid: Rgb }> {
  return waitForSamples(
    page,
    { patch: PATCH, valid: VALID },
    (sample) =>
      sample.valid.b > sample.valid.r + 55 &&
      sample.valid.b > 170 &&
      (!includePatch || (sample.patch.r > sample.patch.b + 55 && sample.patch.r > 170)),
    timeout,
  );
}

for (const renderer of ['canvas', 'webgl'] as const) {
  // Match the screenshot operation's budget on software WebGL; Canvas keeps
  // its normal readiness bound. All real colour and geometry assertions remain.
  const readbackTimeout = renderer === 'webgl' ? 60_000 : 10_000;
  test(`partial ground keeps an opaque patch under permanent water on ${renderer}`, async ({
    page,
  }) => {
    if (renderer === 'webgl') test.slow();
    await resetStorage(page, `?renderer=${renderer}`);
    await installPartialScene(page, [patch(red, PATCH.x, PATCH.y), patch(blue, VALID.x, VALID.y)]);
    await startGame(page, ['Kaya'], ['kaya'], 'partial-ground-water');
    await enterNode(page, 'village_explore');
    await page.locator('.explore-scene .map-canvas').waitFor();
    const bare = await waitForAuthoredColours(page, true, readbackTimeout);
    expectRed(bare.patch);
    expectBlue(bare.valid);

    await setPermanentWater(page, PATCH, true);
    await reenterVillage(page);
    const underwater = await waitForAuthoredColours(page, false, readbackTimeout);
    expectBlue(underwater.valid);
    // The red image is visible before the real grid's water surface is enabled;
    // water then tints that same image rather than replacing it or being hidden below it.
    expectWaterOverPatch(bare.patch, underwater.patch);

    await setPermanentWater(page, PATCH, false);
    await reenterVillage(page);
    const restored = await waitForAuthoredColours(page, true, readbackTimeout);
    expectRed(restored.patch);
    expectBlue(restored.valid);
    expect(Math.abs(restored.patch.r - bare.patch.r)).toBeLessThan(12);
    expect(Math.abs(restored.patch.g - bare.patch.g)).toBeLessThan(12);
    expect(Math.abs(restored.patch.b - bare.patch.b)).toBeLessThan(12);
  });

  test(`partial ground retains valid pieces when one is missing on ${renderer}`, async ({
    page,
  }) => {
    if (renderer === 'webgl') test.slow();
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
    const loaded = await waitForSamples(
      page,
      { fallback: FALLBACK, valid: VALID },
      ({ valid }) => valid.b > valid.r + 55 && valid.b > 170,
      readbackTimeout,
    );
    expectBlue(loaded.valid);
    // A missing piece exposes its original procedural tile; it must neither turn red nor erase a sibling.
    expect(Math.abs(loaded.fallback.r - baseline.fallback.r)).toBeLessThan(12);
    expect(Math.abs(loaded.fallback.g - baseline.fallback.g)).toBeLessThan(12);
    expect(Math.abs(loaded.fallback.b - baseline.fallback.b)).toBeLessThan(12);
    expect(loaded.fallback.r).not.toBeGreaterThan(loaded.fallback.b + 55);
  });

  test(`partial ground restores decor for accessibility and unavailable art on ${renderer}`, async ({
    page,
  }) => {
    if (renderer === 'webgl') test.slow();
    await resetStorage(page, `?renderer=${renderer}`);
    await installPartialScene(page, [patch(red, PATCH.x, PATCH.y)]);
    await setMapTile(page, PATCH, 'T');
    await startGame(page, ['Kaya'], ['kaya'], 'partial-ground-decor');
    await enterNode(page, 'village_explore');
    await page.locator('.explore-scene .map-canvas').waitFor();
    // A complete partial image normally owns this tile's relief.
    const authored = await waitForSamples(
      page,
      { patch: PATCH },
      ({ patch: tile }) => tile.r > tile.b + 55,
      readbackTimeout,
    );
    expectRed(authored.patch);

    await page.evaluate(() => window.fnt?.app.updateSettings({ highContrast: true }));
    const accessible = await waitForSamples(
      page,
      { patch: PATCH },
      ({ patch: tile }) => tile.g > tile.r + 15 && tile.g > tile.b + 15,
      readbackTimeout,
    );
    expectTreeDecor(accessible.patch);

    await page.evaluate(() => window.fnt?.app.updateSettings({ highContrast: false }));
    await installPartialScene(page, [
      patch('art/maps/missing-partial-ground.webp', PATCH.x, PATCH.y),
    ]);
    await reenterVillage(page);
    const fallback = await waitForSamples(
      page,
      { patch: PATCH },
      ({ patch: tile }) => tile.g > tile.r + 15 && tile.g > tile.b + 15,
      readbackTimeout,
    );
    expectTreeDecor(fallback.patch);
  });
}
