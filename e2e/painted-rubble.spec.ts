import { test, expect } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
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
    allowSoftwareWebgl(test, renderer);
    await page.setViewportSize({ width: 1672, height: 941 });
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Kaya'], ['kaya'], 'forest-rubble');
    await enterNode(page, 'battle_forest_road');
    await takeTurn(page);
    await waitForIdle(page);
    await page.waitForTimeout(1000);
    /*
     * One round trip per probe: wait for two published frames and read the
     * camera in the same evaluate. While the software rasteriser is busy, a
     * call across the protocol costs seconds — run 35555673408 measured the
     * two frames alone at about five, and this spec's webgl half passed at
     * 297.2s of a 300s cap — so a second `page.evaluate` for the transform
     * charged eight more of those. The camera is settled before the second
     * frame is published, and the screenshot below still follows the wait, so
     * the probe reads the same pixels with one fewer crossing.
     */
    const sample = async (regionSize = 7) => {
      const probe = await page.evaluate(
        () =>
          new Promise<{
            point: { x: number; y: number };
            rect: { x: number; y: number; width: number; height: number };
          } | null>((resolve) => {
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                const m = window.fnt?.app.rendererCamera()?.groundTransform;
                const canvas = document.querySelector('.map-canvas');
                if (!m || !canvas) {
                  resolve(null);
                  return;
                }
                const bounds = canvas.getBoundingClientRect();
                resolve({
                  point: {
                    x: m.a * 7.5 * 64 + m.c * 3.5 * 64 + m.tx,
                    y: m.b * 7.5 * 64 + m.d * 3.5 * 64 + m.ty,
                  },
                  rect: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
                });
              }),
            );
          }),
      );
      expect(probe, 'the map canvas is mounted with a settled camera').not.toBeNull();
      if (!probe) throw new Error('Missing map canvas');
      const { point, rect } = probe;
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
    // the registered local rubble image remains visible underneath it. A
    // registered heap only seats the wash (no bank, fading inside the cell),
    // so under the pile it lays the same strength as the unregistered wash.
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
    // One capture answers both probes: the average reads the same 7x7 centre
    // whichever window it is taken from, and a software-WebGL screenshot is the
    // most expensive operation in this spec, so the wider window serves the
    // colour check and the change count together.
    const waterRegion = await sample(ROI_CSS);
    /*
     * The live water surface tints the authored rubble image: blue and green
     * rise together while red falls. How big each shift is depends on the
     * rasteriser's colour pipeline - run 35499544183's software WebGL
     * compressed every channel shift to roughly two thirds of this host's and
     * put the green shift at 4.96 where this host measures 7.2 - so the floor
     * is anchored on the channel the material raises most, with the others
     * required to follow it, instead of on a per-channel absolute value.
     */
    const blueShift = waterRegion.b - registered.b;
    expect(blueShift).toBeGreaterThan(10);
    expect(waterRegion.r - registered.r).toBeLessThan(-10);
    // Measured as a cool shift rather than an absolute green rise: the ground
    // contract's warm packed earth is already greener than the water fill, so
    // no film can raise green over light warm ground (see partial-ground.spec.ts).
    expect(waterRegion.b - waterRegion.r - (registered.b - registered.r)).toBeGreaterThan(25);

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
