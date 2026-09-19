import { test, expect } from '@playwright/test';
import { resetStorage, startGame, enterNode, takeTurn, waitForIdle } from './helpers';
import { screenshotPixels, average } from './pixels';

for (const renderer of ['canvas', 'webgl'])
  test(`registered rubble retains live overlay fallback on ${renderer}`, async ({ page }) => {
    await page.setViewportSize({ width: 1672, height: 941 });
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Kaya'], ['kaya'], 'forest-rubble');
    await enterNode(page, 'battle_forest_road');
    await takeTurn(page);
    await waitForIdle(page);
    await page.waitForTimeout(1000);
    const sample = async () => {
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      const point = await page.evaluate(() => {
        const m = window.fnt!.app.rendererCamera()!.groundTransform;
        return {
          x: m.a * 7.5 * 64 + m.c * 3.5 * 64 + m.tx,
          y: m.b * 7.5 * 64 + m.d * 3.5 * 64 + m.ty,
        };
      });
      const pixels = await screenshotPixels(page.locator('.map-canvas'));
      expect(point.x).toBeGreaterThan(3);
      expect(point.x).toBeLessThan(pixels.width - 3);
      expect(point.y).toBeGreaterThan(3);
      expect(point.y).toBeLessThan(pixels.height - 3);
      return average(pixels, point.x, point.y, 3);
    };
    const registered = await sample();
    // Capture only the rendered board: full-page screenshots are needlessly
    // expensive on software WebGL and do not contribute to the pixel probe.
    await page.locator('.map-canvas').screenshot({
      path: `.shots/forest-${renderer}-registered-rubble.png`,
    });
    await page.evaluate(() => {
      const scene = window.fnt!.app.content.maps.get('forest_road')!.scene!;
      Object.defineProperty(scene, 'paintedRubble', { value: [], configurable: true });
    });
    const overlay = await sample();
    expect(
      Math.abs(overlay.r - registered.r) +
        Math.abs(overlay.g - registered.g) +
        Math.abs(overlay.b - registered.b),
    ).toBeGreaterThan(10);
    await page.locator('.map-canvas').screenshot({
      path: `.shots/forest-${renderer}-duplicate-rubble.png`,
    });
    await page.evaluate(() => {
      const app = window.fnt!.app;
      Object.defineProperty(app.content.maps.get('forest_road')!.scene!, 'paintedRubble', {
        value: [
          { x: 7, y: 3 },
          { x: 8, y: 9 },
        ],
        configurable: true,
      });
      const tile = app.state!.battle!.grid.tiles[3 * 20 + 7]!;
      Object.defineProperty(tile, 'surface', {
        value: { id: 'rubble', duration: 3, spread: 0 },
        configurable: true,
      });
    });
    const dynamic = await sample();
    expect(
      Math.abs(dynamic.r - registered.r) +
        Math.abs(dynamic.g - registered.g) +
        Math.abs(dynamic.b - registered.b),
    ).toBeGreaterThan(10);
    await page.evaluate(() => {
      const app = window.fnt!.app;
      Object.defineProperty(app.state!.battle!.grid.tiles[3 * 20 + 7]!, 'surface', {
        value: { id: 'rubble', duration: -1, spread: 0 },
        configurable: true,
      });
      app.updateSettings({ highContrast: true });
    });
    const accessible = await sample();
    expect(
      Math.abs(accessible.r - registered.r) +
        Math.abs(accessible.g - registered.g) +
        Math.abs(accessible.b - registered.b),
    ).toBeGreaterThan(10);
    await page.evaluate(() => {
      const app = window.fnt!.app;
      app.updateSettings({ highContrast: false });
      const scene = app.content.maps.get('forest_road')!.scene!;
      Object.defineProperty(scene, 'ground', {
        value: scene.ground.map((piece) => ({
          ...piece,
          url: 'art/maps/missing-rubble-test.webp',
        })),
        configurable: true,
      });
    });
    const fallback = await sample();
    expect(
      Math.abs(fallback.r - registered.r) +
        Math.abs(fallback.g - registered.g) +
        Math.abs(fallback.b - registered.b),
    ).toBeGreaterThan(10);
  });
