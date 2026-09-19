import { expect, test, type Page } from '@playwright/test';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';
import { average, screenshotPixels } from './pixels';

const svg = (colour: string): string =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${colour}"/></svg>`)}`;

const red = svg('#d94444');
const blue = svg('#4477d9');

async function tileCentre(page: Page, pos: { x: number; y: number }) {
  const point = await page.evaluate((p) => {
    const camera = window.fnt?.app.rendererCamera?.();
    if (!camera) return null;
    const m = camera.groundTransform;
    const x = (p.x + 0.5) * 64;
    const y = (p.y + 0.5) * 64;
    return { x: m.a * x + m.c * y + m.tx, y: m.b * x + m.d * y + m.ty };
  }, pos);
  if (!point) throw new Error('no map camera');
  return point;
}

async function installPartialScene(page: Page, missing = false) {
  await page.evaluate(
    ({ redUrl, blueUrl, missing }) => {
      const map = window.fnt?.app.content.maps.get('ba_dan_village');
      if (!map?.scene) throw new Error('Missing Ba Dan scene');
      const piece = (url: string, x: number, y: number) => ({
        url,
        x: 1024 + (x - y) * 64 - 32,
        y: (x + y + 1) * 32 - 32,
        width: 64,
        height: 64,
      });
      Object.defineProperties(map.scene, {
        groundMode: { value: 'partial', configurable: true },
        ground: {
          value: [
            piece(missing ? 'art/maps/missing-partial-ground.webp' : redUrl, 3, 7),
            piece(blueUrl, 5, 7),
            piece(redUrl, 11, 6),
          ],
          configurable: true,
        },
        scenery: { value: [], configurable: true },
      });
    },
    { redUrl: red, blueUrl: blue, missing },
  );
  await expect
    .poll(async () => {
      const pixels = await screenshotPixels(page.locator('.explore-scene .map-canvas'));
      const bluePoint = await tileCentre(page, { x: 5, y: 7 });
      const redPoint = await tileCentre(page, { x: 3, y: 7 });
      const bluePixel = average(pixels, bluePoint.x, bluePoint.y, 3);
      const redPixel = average(pixels, redPoint.x, redPoint.y, 3);
      return (
        bluePixel.b > bluePixel.r + 20 &&
        bluePixel.b > 150 &&
        (missing || (redPixel.r > redPixel.b + 20 && redPixel.r > 150))
      );
    })
    .toBe(true);
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`partial ground layers authored patches and live water on ${renderer}`, async ({
    page,
    browserName,
  }) => {
    if (renderer === 'webgl' && browserName === 'webkit') test.slow();
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Kaya'], ['kaya'], 'partial-ground');
    await enterNode(page, 'village_explore');
    await page.locator('.explore-scene .map-canvas').waitFor();
    await installPartialScene(page);
    const pixels = await screenshotPixels(page.locator('.explore-scene .map-canvas'));
    const authoredPoint = await tileCentre(page, { x: 5, y: 7 });
    const proceduralPoint = await tileCentre(page, { x: 3, y: 8 });
    const pondPoint = await tileCentre(page, { x: 11, y: 6 });
    const box = await page.locator('.explore-scene .map-canvas').boundingBox();
    expect(box).not.toBeNull();
    expect(authoredPoint.x).toBeGreaterThan(3);
    expect(authoredPoint.x).toBeLessThan((box?.width ?? 0) - 3);
    expect(authoredPoint.y).toBeGreaterThan(3);
    expect(authoredPoint.y).toBeLessThan((box?.height ?? 0) - 3);
    const authored = average(pixels, authoredPoint.x, authoredPoint.y, 3);
    const procedural = average(pixels, proceduralPoint.x, proceduralPoint.y, 3);
    expect(authored.b).toBeGreaterThan(authored.r + 20);
    expect(procedural.r).toBeGreaterThan(procedural.b + 5);
    const pond = average(pixels, pondPoint.x, pondPoint.y, 3);
    expect(Math.abs(pond.r - 217) + Math.abs(pond.g - 68) + Math.abs(pond.b - 68)).toBeGreaterThan(
      40,
    );
  });

  test(`partial ground falls back and survives scene re-entry on ${renderer}`, async ({
    page,
    browserName,
  }) => {
    if (renderer === 'webgl' && browserName === 'webkit') test.slow();
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Kaya'], ['kaya'], 'partial-ground-reentry');
    await enterNode(page, 'village_explore');
    await page.locator('.explore-scene .map-canvas').waitFor();
    await installPartialScene(page, true);
    const sample = async () => {
      const pixels = await screenshotPixels(page.locator('.explore-scene .map-canvas'));
      const validPoint = await tileCentre(page, { x: 5, y: 7 });
      const fallbackPoint = await tileCentre(page, { x: 3, y: 7 });
      const valid = average(pixels, validPoint.x, validPoint.y, 3);
      const fallback = average(pixels, fallbackPoint.x, fallbackPoint.y, 3);
      return { valid, fallback };
    };
    const before = await sample();
    expect(before.valid.b).toBeGreaterThan(before.valid.r + 20);
    expect(before.fallback.r).toBeGreaterThan(before.fallback.b + 5);
    await enterNode(page, 'riverside_explore');
    await page.locator('.explore-scene .map-canvas').waitFor();
    await waitForIdle(page);
    await enterNode(page, 'village_explore');
    await page.locator('.explore-scene .map-canvas').waitFor();
    await waitForIdle(page);
    const after = await sample();
    expect(after.valid.b).toBeGreaterThan(after.valid.r + 20);
    expect(after.fallback.r).toBeGreaterThan(after.fallback.b + 5);
  });
}
