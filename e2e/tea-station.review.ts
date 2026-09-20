/** Local tea-station review; fixture setup, then normal approach and discovery. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

async function tapTile(page: Page, x: number, y: number) {
  const point = await page.evaluate(
    ({ x, y }) => {
      const m = window.fnt!.app.rendererCamera()!.groundTransform;
      return {
        x: m.a * (x + 0.5) * 64 + m.c * (y + 0.5) * 64 + m.tx,
        y: m.b * (x + 0.5) * 64 + m.d * (y + 0.5) * 64 + m.ty,
      };
    },
    { x, y },
  );
  await page.locator('.map-canvas').click({ position: point });
}

async function frame(page: Page, size: number) {
  const camera = await page.evaluate(() => window.fnt!.app.rendererCamera()!);
  const box = await page.locator('.map-canvas').boundingBox();
  if (!box) throw new Error('No canvas');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, Math.log(camera.tilePx / size) / 0.002);
  await expect
    .poll(() => page.evaluate(() => window.fnt!.app.rendererCamera()!.tilePx))
    .toBeCloseTo(size, 1);
  const point = await page.evaluate(() => {
    const m = window.fnt!.app.rendererCamera()!.groundTransform;
    return { x: m.a * 4.5 * 64 + m.c * 9.5 * 64 + m.tx, y: m.b * 4.5 * 64 + m.d * 9.5 * 64 + m.ty };
  });
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.down();
  await page.mouse.move(x + box.width / 2 - point.x, y + box.height / 2 - point.y, { steps: 8 });
  await page.mouse.up();
  await page.mouse.move(10, 10);
  await settleLayout(page);
}

for (const renderer of ['canvas', 'webgl'] as const)
  test(`${renderer} tea station`, async ({ page }) => {
    test.setTimeout(90_000);
    const revision = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
    const modified = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
      encoding: 'utf8',
    }).trim();
    const build = `${revision}${modified ? '-modified' : ''}`;
    const folder = `${process.env.FNT_TEA_REVIEW_DIR ?? '.shots/tea-station'}/${renderer}`;
    mkdirSync(folder, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const fallback = process.env.FNT_TEA_FALLBACK === '1';
    let failedImageRequests = 0;
    if (fallback)
      await page.route('**/art/props/tea-station.png', async (route) => {
        failedImageRequests++;
        await route.abort();
      });
    await resetStorage(page, `?renderer=${renderer}`);
    await expect(page.locator('[aria-label^="Game version"]')).toHaveText(
      new RegExp(`build ${build}$`),
    );
    await page.screenshot({ path: `${folder}/source-build.png` });
    await startGame(page, ['Sura', 'Riko'], ['sura', 'riko'], 'tea-station-review', {
      reduceMotion: false,
    });
    await enterNode(page, 'cutting_explore');
    // Setup only: party near Sen, before inspecting the tea station.
    await page.evaluate(() => {
      const app = window.fnt!.app,
        state = app.state!;
      app.state = {
        ...state,
        location: { ...state.location, pos: { x: 4, y: 8 } },
        story: { ...state.story, nodeId: null },
      };
      app.resync();
    });
    await waitForIdle(page);
    expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(renderer);
    const views = [];
    for (const size of [64, 96]) {
      await frame(page, size);
      await page.screenshot({ path: `${folder}/tea-${size}.png` });
      views.push({ size, camera: await page.evaluate(() => window.fnt!.app.rendererCamera()) });
    }
    await page.evaluate(() => window.fnt!.app.updateSettings({ reduceMotion: true }));
    await settleLayout(page);
    await page.screenshot({ path: `${folder}/tea-96-reduced.png` });
    await page.evaluate(() => window.fnt!.app.updateSettings({ reduceMotion: false }));
    await frame(page, 64);
    await tapTile(page, 4, 9);
    await waitForIdle(page);
    await expect
      .poll(() => page.evaluate(() => window.fnt!.app.state!.location.pos))
      .toEqual({ x: 4, y: 9 });
    await tapTile(page, 3, 9);
    await expect
      .poll(() => page.evaluate(() => window.fnt!.app.state!.story.nodeId))
      .toBe('discover_tea_station');
    await expect(
      page.getByText('Six cups stand beside the kettle.', { exact: false }),
    ).toBeVisible();
    await page.screenshot({ path: `${folder}/discovery.png` });
    expect(errors).toEqual([]);
    if (fallback) expect(failedImageRequests).toBeGreaterThan(0);
    writeFileSync(
      `${folder}/provenance.json`,
      JSON.stringify(
        {
          build,
          renderer,
          fallback,
          failedImageRequests,
          views,
          errors,
          setup:
            'Seeded newGame; Cutting fixture near Sen at (4,8). Actual wheel/pan, then ordinary map taps (4,9) and (3,9) to the tea discovery. Reduced-motion screenshot is idle still review.',
        },
        null,
        2,
      ),
    );
  });
