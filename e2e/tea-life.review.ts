/**
 * Local review of the seated tea pair on the life layer, at the 1280x720
 * viewport `riverside-tea.spec.ts` uses.
 *
 * The suite asserts that the layer's own pixels around the veranda foot are
 * inked. When that fails on CI the report shows a page with no figures on the
 * veranda, so this harness prints what the layer drew and where: the ink
 * bounding box and a coarse ink map of the whole backing store, the ink inside
 * the suite's 60x110 crop, the projected foot against the stage box, and the
 * camera. It saves the life layer on its own so the crop can be compared with
 * the drawing rather than with the composited page.
 *
 * Run: npx playwright test -c playwright.tea-life.config.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { resetStorage, settleLayout } from './helpers';

for (const backend of ['canvas', 'webgl']) {
  test(`tea life layer report (${backend})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await resetStorage(page, `?renderer=${backend}`);
    await page.getByRole('button', { name: 'Explore the riverside', exact: true }).click();
    await page.evaluate(() => window.fnt!.app.updateSettings({ reduceMotion: true }));
    await page.getByRole('button', { name: 'Activities', exact: true }).click();
    await page.getByRole('button', { name: 'Tea break', exact: true }).click();
    await expect(page.locator('.village-life-canvas')).toHaveAttribute('data-tea-actors', '2');
    await page.getByRole('button', { name: 'Activities', exact: true }).click();
    await settleLayout(page);

    const report = await page.evaluate(() => {
      // The suite reads the first `.village-life-canvas`; report every canvas so
      // a stale or duplicated stage is visible rather than assumed away.
      const canvases = [...document.querySelectorAll('canvas')].map((c) => ({
        cls: c.className,
        store: `${c.width}x${c.height}`,
        box: `${c.clientWidth}x${c.clientHeight}`,
        top: Math.round(c.getBoundingClientRect().top),
        left: Math.round(c.getBoundingClientRect().left),
      }));
      const canvas = document.querySelector<HTMLCanvasElement>('.village-life-canvas');
      const camera = window.fnt?.app.rendererCamera() ?? null;
      if (!canvas || !camera) return { canvases, camera, error: 'missing life layer' };
      const m = camera.groundTransform;
      const point = (x: number, y: number) => ({
        x: (m.a * x + m.c * y) * 64 + m.tx,
        y: (m.b * x + m.d * y) * 64 + m.ty,
      });
      const ctx = canvas.getContext('2d');
      const data = ctx?.getImageData(0, 0, canvas.width, canvas.height).data;
      let inked = 0;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      const buckets: Record<string, number> = {};
      if (data) {
        for (let i = 3, p = 0; i < data.length; i += 4, p++) {
          if ((data[i] ?? 0) === 0) continue;
          inked += 1;
          const x = p % canvas.width;
          const y = (p - x) / canvas.width;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          const key = `${Math.floor(x / 64) * 64},${Math.floor(y / 64) * 64}`;
          buckets[key] = (buckets[key] ?? 0) + 1;
        }
      }
      // The suite's own crop, so the number here is the number it asserts on.
      const cropInk = (css: { x: number; y: number }) => {
        const sx = canvas.width / canvas.clientWidth;
        const sy = canvas.height / canvas.clientHeight;
        const scratch = document.createElement('canvas');
        scratch.width = Math.max(1, Math.round(60 * sx));
        scratch.height = Math.max(1, Math.round(110 * sy));
        const out = scratch.getContext('2d');
        if (!out) return -1;
        out.drawImage(
          canvas,
          Math.round((css.x - 30) * sx),
          Math.round((css.y - 55) * sy),
          scratch.width,
          scratch.height,
          0,
          0,
          scratch.width,
          scratch.height,
        );
        const px = out.getImageData(0, 0, scratch.width, scratch.height).data;
        let n = 0;
        for (let i = 3; i < px.length; i += 4) if ((px[i] ?? 0) > 0) n += 1;
        return n;
      };
      const between = point(8.5, 18.85);
      const footA = point(8.5, 18.5);
      const footB = point(8.5, 19.5);
      return {
        canvases,
        camera,
        store: `${canvas.width}x${canvas.height}`,
        box: `${canvas.clientWidth}x${canvas.clientHeight}`,
        dataset: { ...canvas.dataset },
        partyPositions: window.fnt?.app.partyPositions() ?? null,
        ink: { inked, bbox: [minX, minY, maxX, maxY], buckets },
        crops: { between: cropInk(between), footA: cropInk(footA), footB: cropInk(footB) },
        // A crop whose centre is off this box reads blank however the layer drew.
        points: { between, footA, footB, onStage: { between: between.y >= 0 && between.y <= 485 } },
        layer: canvas.toDataURL('image/png'),
      };
    });

    mkdirSync('test-results/tea-life', { recursive: true });
    const { layer, ...text } = report as typeof report & { layer?: string };
    if (layer) {
      writeFileSync(
        `test-results/tea-life/life-${backend}.png`,
        Buffer.from(layer.slice(layer.indexOf(',') + 1), 'base64'),
      );
    }
    writeFileSync(
      `test-results/tea-life/report-${backend}.json`,
      `${JSON.stringify(text, null, 2)}\n`,
    );
    console.log(
      `TEA-LIFE ${backend} ${JSON.stringify(text.ink)} crops=${JSON.stringify(text.crops)}`,
    );
  });
}
