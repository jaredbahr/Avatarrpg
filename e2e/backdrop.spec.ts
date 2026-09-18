import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  enterNode,
  resetStorage,
  settleLayout,
  startGame,
  takeTurn,
  waitForIdle,
  useOrthographicBackdropFixture,
} from './helpers';
import type { Pixels } from './pixels';
import { average, screenshotPixels } from './pixels';

/**
 * The painting slot (ADR 0009), end to end, on both backends.
 *
 * `public/art/test/backdrop.png` is the forest road's layout image with a
 * magenta block over tiles (3,2) to (4,3). Put under the forest road through
 * the review hook, it has to land on screen where the camera says those
 * tiles are, in place of the procedural ground, on the Canvas 2D path and
 * the WebGL one alike; and the Show grid lines, which the renderer draws
 * over the painting, have to appear on it when the setting turns them on.
 */

/** Screen point at a tile's centre, inside the canvas element, through the camera. */
async function tilePoint(
  page: Page,
  pos: { x: number; y: number },
  fraction: { x: number; y: number } = { x: 0.5, y: 0.5 },
): Promise<{ x: number; y: number }> {
  const point = await page.evaluate(
    ({ p, f }) => {
      const camera = window.fnt?.app.rendererCamera?.();
      if (!camera) return null;
      const m = camera.groundTransform;
      const x = (p.x + f.x) * 64,
        y = (p.y + f.y) * 64;
      return { x: m.a * x + m.c * y + m.tx, y: m.b * x + m.d * y + m.ty };
    },
    { p: pos, f: fraction },
  );
  if (!point) throw new Error('no map camera');
  return point;
}

const lum = (c: { r: number; g: number; b: number }): number => c.r + c.g + c.b;

/**
 * The darkest pixel in a short horizontal window centred on `x`: where a
 * tile line would be, whichever backend drew it and however wide it came out.
 * Steps by half a CSS pixel so every device pixel is looked at on a 2x screen.
 */
function darkest(pixels: Pixels, x: number, y: number, halfWidth: number): number {
  let min = Number.POSITIVE_INFINITY;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -halfWidth; dx <= halfWidth; dx += 0.5) {
      const c = pixels.at(x + dx, y + dy);
      if (c) min = Math.min(min, lum(c));
    }
  }
  return min;
}

test.describe('map paintings', () => {
  for (const renderer of ['canvas', 'webgl'] as const) {
    test(`draws the painting under the tiles and the grid over it on ${renderer}`, async ({
      page,
      browserName,
    }) => {
      test.setTimeout(120_000);
      if (renderer === 'webgl' && browserName === 'webkit') test.slow();

      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));

      await resetStorage(page, `?renderer=${renderer}`);
      await startGame(page, ['Elias'], ['kaya'], 'backdrop-spec');
      await useOrthographicBackdropFixture(page, 'forest_road');
      await enterNode(page, 'battle_forest_road');
      await takeTurn(page);
      await waitForIdle(page);
      await settleLayout(page);
      expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(renderer);

      // Put the probe painting under the map, exactly as content would.
      const loaded = await page.evaluate(() =>
        window.fnt?.app.overrideBackdrop('forest_road', {
          url: 'art/test/backdrop.png',
          pixelsPerTile: 32,
        }),
      );
      expect(loaded, 'the probe painting did not load').toBe(true);

      const block = await tilePoint(page, { x: 3, y: 2 });
      const grass = await tilePoint(page, { x: 6, y: 2 });
      const isMagenta = (c: { r: number; g: number; b: number }): boolean =>
        c.r > 150 && c.b > 150 && c.g < 100;

      // The next frame draws it; poll until the block is there.
      await expect
        .poll(
          async () => {
            const pixels = await screenshotPixels(page.locator('.map-canvas'));
            return isMagenta(average(pixels, block.x, block.y, 2));
          },
          { timeout: 30_000, message: 'the probe block never appeared where tile (3,2) is' },
        )
        .toBe(true);

      // Elsewhere the painting's flat grass shows, not the procedural ground.
      let pixels = await screenshotPixels(page.locator('.map-canvas'));
      const green = average(pixels, grass.x, grass.y, 2);
      expect(
        green.g,
        `tile (6,2) is not the painting's grass: ${JSON.stringify(green)}`,
      ).toBeGreaterThan(130);
      expect(green.r).toBeLessThan(110);
      expect(green.b).toBeLessThan(110);

      // No grid: the edge between tiles (3,2) and (4,2) is as bright as the block.
      const edge = await tilePoint(page, { x: 4, y: 2 }, { x: 0, y: 0.5 });
      const centre = lum(average(pixels, block.x, block.y, 2));
      expect(darkest(pixels, edge.x, edge.y, 4) / centre).toBeGreaterThan(0.93);

      // Show grid on: a line darkens that edge, drawn over the painting.
      await page.evaluate(() => window.fnt?.app.updateSettings({ showGrid: true }));
      await expect
        .poll(
          async () => {
            pixels = await screenshotPixels(page.locator('.map-canvas'));
            return darkest(pixels, edge.x, edge.y, 4) / lum(average(pixels, block.x, block.y, 2));
          },
          { timeout: 30_000, message: 'no tile line appeared over the painting' },
        )
        .toBeLessThan(0.9);

      expect(errors.filter((text) => !/favicon/i.test(text))).toEqual([]);
    });
  }
});
