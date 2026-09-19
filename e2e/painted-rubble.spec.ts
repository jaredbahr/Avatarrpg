import { test, expect } from '@playwright/test';
import { resetStorage, startGame, enterNode, takeTurn, waitForIdle } from './helpers';
import { screenshotClipPixels, average } from './pixels';

for (const renderer of ['canvas', 'webgl'])
  test(`registered rubble retains live overlay fallback on ${renderer}`, async ({ page }) => {
    // On CI's software WebGL, a full-canvas readback took 15 seconds per capture
    // in run 35417898299. Keep the WebGL allowance even with the smaller probe.
    if (renderer === 'webgl') test.slow();
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
      const { point, rect } = await page.evaluate(() => {
        const m = window.fnt!.app.rendererCamera()!.groundTransform;
        const canvas = document.querySelector('.map-canvas');
        if (!canvas) throw new Error('Missing map canvas');
        const bounds = canvas.getBoundingClientRect();
        return {
          point: {
            x: m.a * 7.5 * 64 + m.c * 3.5 * 64 + m.tx,
            y: m.b * 7.5 * 64 + m.d * 3.5 * 64 + m.ty,
          },
          rect: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
        };
      });
      expect(point.x).toBeGreaterThan(3);
      expect(point.x).toBeLessThan(rect.width - 3);
      expect(point.y).toBeGreaterThan(3);
      expect(point.y).toBeLessThan(rect.height - 3);
      const left = Math.round(point.x) - 3;
      const top = Math.round(point.y) - 3;
      const pixels = await screenshotClipPixels(page, {
        x: rect.x + left,
        y: rect.y + top,
        width: 7,
        height: 7,
      });
      return average(pixels, point.x - left, point.y - top, 3);
    };
    const registered = await sample();
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
