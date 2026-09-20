import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame } from './helpers';
import { average, screenshotPixels } from './pixels';

// The production service worker precaches art; this probe must intercept the
// network response instead of receiving the already cached illustration.
test.use({ serviceWorkers: 'block' });

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`exploration encounter markers draw their atlas on ${renderer}`, async ({
    page,
    browserName,
  }) => {
    test.setTimeout(120_000);
    if (renderer === 'webgl' && browserName === 'webkit') test.slow();
    // Substitute the existing flat red probe for the bandit's idle art. Keep
    // both idle entries on the red source rectangle: the CI trace showed slow
    // WebGL readback phase-locking the 1 fps red/green fixture on green, even
    // though the atlas had loaded and the marker was on-screen.
    const atlas = readFileSync('public/art/test/probe.json', 'utf8')
      .replaceAll('unit.test.probe', 'unit.enemy.thug')
      .replace('probe.png', 'thug.png')
      .replace(
        '"unit.enemy.thug/idle/1": {\n      "frame": {\n        "x": 128,',
        '"unit.enemy.thug/idle/1": {\n      "frame": {\n        "x": 0,',
      );
    await page.route('**/art/units/thug.json', (route) =>
      route.fulfill({ contentType: 'application/json', body: atlas }),
    );
    await page.route('**/art/units/thug.png', (route) =>
      route.fulfill({ contentType: 'image/png', body: readFileSync('public/art/test/probe.png') }),
    );
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Explorer'], ['kaya'], 'marker-sheet');
    await enterNode(page, 'forest_explore');
    await settleLayout(page);
    const centre = await page.evaluate(() => {
      const app = window.fnt!.app;
      const map = app.content.maps.get('forest_road');
      const pos = map?.triggers?.find((trigger) => trigger.sprite === 'unit.enemy.thug')?.area[0];
      const camera = app.rendererCamera();
      if (!pos || !camera) throw new Error('Missing encounter marker or camera');
      const m = camera.groundTransform;
      const x = (pos.x + 0.5) * 64,
        y = (pos.y + 0.5) * 64;
      // Frame sample is upright: lift vertically from the projected foot.
      const lift = camera.projection === 'oblique' ? 0.86 - 0.325 : 0.5 - 0.325;
      return {
        x: m.a * x + m.c * y + m.tx,
        y: m.b * x + m.d * y + m.ty - camera.tilePx * lift,
      };
    });
    await expect
      .poll(
        async () => {
          const pixels = await screenshotPixels(page.locator('.map-canvas'));
          const c = average(pixels, centre.x, centre.y, 2);
          return c.r > 150 && c.g < 120 && c.b < 120;
        },
        { timeout: 30_000, message: 'The exploration marker never drew the red idle atlas frame' },
      )
      .toBe(true);
  });
}
