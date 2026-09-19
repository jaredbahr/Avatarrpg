import { test, expect } from '@playwright/test';
import { resetStorage, startGame, enterNode, takeTurn, waitForIdle } from './helpers';
import { screenshotClipPixels, average, type Pixels } from './pixels';

const ROI_CSS = 96;

function changedPixels(before: Pixels, after: Pixels, cssSize: number): number {
  let changed = 0;
  for (let y = 0; y < cssSize; y++) {
    for (let x = 0; x < cssSize; x++) {
      const a = before.at(x, y);
      const b = after.at(x, y);
      if (a && b && Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) > 6) changed++;
    }
  }
  return changed;
}

for (const renderer of ['canvas', 'webgl'])
  test(`partial ground keeps rubble art and live overlays on ${renderer}`, async ({ page }) => {
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
    const sample = async (regionSize = 7) => {
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
      const half = Math.floor(regionSize / 2);
      const left = Math.round(point.x) - half;
      const top = Math.round(point.y) - half;
      const pixels = await screenshotClipPixels(page, {
        x: rect.x + left,
        y: rect.y + top,
        width: regionSize,
        height: regionSize,
      });
      return { ...average(pixels, point.x - left, point.y - top, 3), pixels };
    };
    const registered = await sample();
    // Forest Road is a partial scene: the permanent live rubble overlay remains
    // active regardless of the legacy complete-scene registration list, while
    // the registered local rubble image remains visible underneath it.
    await page.evaluate(() => {
      const scene = window.fnt!.app.content.maps.get('forest_road')!.scene!;
      Object.defineProperty(scene, 'paintedRubble', { value: [], configurable: true });
    });
    const unregistered = await sample();
    expect(Math.abs(unregistered.r - registered.r)).toBeLessThan(3);
    expect(Math.abs(unregistered.g - registered.g)).toBeLessThan(3);
    expect(Math.abs(unregistered.b - registered.b)).toBeLessThan(3);

    // A live material must still tint the authored rubble image.
    await page.evaluate(() => {
      const app = window.fnt!.app;
      const tile = app.state!.battle!.grid.tiles[3 * 20 + 7]!;
      Object.defineProperty(tile, 'surface', {
        value: { id: 'water', duration: -1, spread: 0 },
        configurable: true,
      });
    });
    const water = await sample();
    expect(water.b - registered.b).toBeGreaterThan(10);
    expect(water.g - registered.g).toBeGreaterThan(5);
    const waterRegion = await sample(ROI_CSS);

    // Hatch mode remains visible over the authored image for a live material.
    await page.evaluate(() => {
      const app = window.fnt!.app;
      Object.defineProperty(app.state!.battle!.grid.tiles[3 * 20 + 7]!, 'surface', {
        value: { id: 'water', duration: -1, spread: 0 },
        configurable: true,
      });
      app.updateSettings({ hatchSurfaces: true });
    });
    const hatchedWater = await sample(ROI_CSS);
    expect(
      changedPixels(waterRegion.pixels, hatchedWater.pixels, ROI_CSS),
      'hatch changed pixels',
    ).toBeGreaterThan(10);

    // High contrast restores procedural markers when authored pieces are unavailable.
    await page.evaluate(() => {
      const app = window.fnt!.app;
      Object.defineProperty(app.state!.battle!.grid.tiles[3 * 20 + 7]!, 'surface', {
        value: { id: 'rubble', duration: -1, spread: 0 },
        configurable: true,
      });
      app.updateSettings({ hatchSurfaces: false, highContrast: false });
    });
    const beforeContrast = await sample(ROI_CSS);
    await page.evaluate(() => {
      window.fnt!.app.updateSettings({ highContrast: true });
    });
    const accessible = await sample(ROI_CSS);
    expect(
      changedPixels(beforeContrast.pixels, accessible.pixels, ROI_CSS),
      'high-contrast changed pixels',
    ).toBeGreaterThan(10);
    await page.evaluate(() => {
      const app = window.fnt!.app;
      const scene = app.content.maps.get('forest_road')!.scene!;
      Object.defineProperty(scene, 'ground', {
        value: scene.ground.map((piece) => ({
          ...piece,
          url: 'art/maps/missing-rubble-test.webp',
        })),
        configurable: true,
      });
    });
    const fallbackAccessible = await sample();
    expect(
      Math.abs(fallbackAccessible.r - registered.r) +
        Math.abs(fallbackAccessible.g - registered.g) +
        Math.abs(fallbackAccessible.b - registered.b),
    ).toBeGreaterThan(10);
    await page.evaluate(() => window.fnt!.app.updateSettings({ highContrast: false }));
    const fallback = await sample();
    expect(
      Math.abs(fallback.r - registered.r) +
        Math.abs(fallback.g - registered.g) +
        Math.abs(fallback.b - registered.b),
    ).toBeGreaterThan(10);
  });
