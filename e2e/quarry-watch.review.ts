/** Local gate-marker review; fixture setup, then normal approach and parley. */
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
    return { x: m.a * 7 * 64 + m.c * 5.5 * 64 + m.tx, y: m.b * 7 * 64 + m.d * 5.5 * 64 + m.ty };
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
  test(`${renderer} quarry watch`, async ({ page }) => {
    test.setTimeout(90_000);
    const revision = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
    const modified = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
      encoding: 'utf8',
    }).trim();
    const build = `${revision}${modified ? '-modified' : ''}`;
    const folder = `${process.env.FNT_WATCH_REVIEW_DIR ?? '.shots/quarry-watch'}/${renderer}`;
    mkdirSync(folder, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await resetStorage(page, `?renderer=${renderer}`);
    await expect(page.locator('[aria-label^="Game version"]')).toHaveText(
      new RegExp(`build ${build}$`),
    );
    await page.screenshot({ path: `${folder}/source-build.png` });
    await startGame(page, ['Sura', 'Riko'], ['sura', 'riko'], 'quarry-watch-review', {
      reduceMotion: false,
    });
    await enterNode(page, 'gate_escort_explore');
    // Setup only: unvisited gate at the west approach, without the escort objective.
    await page.evaluate(() => {
      const app = window.fnt!.app,
        state = app.state!;
      app.state = {
        ...state,
        location: { ...state.location, pos: { x: 5, y: 5 } },
        story: { ...state.story, nodeId: null },
      };
      app.resync();
    });
    await waitForIdle(page);
    expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(renderer);
    const views = [];
    for (const size of [64, 96]) {
      await frame(page, size);
      await page.screenshot({ path: `${folder}/watch-${size}.png` });
      views.push({ size, camera: await page.evaluate(() => window.fnt!.app.rendererCamera()) });
    }
    await page.evaluate(() => window.fnt!.app.updateSettings({ reduceMotion: true }));
    await settleLayout(page);
    await page.screenshot({ path: `${folder}/watch-96-reduced.png` });
    await page.evaluate(() => window.fnt!.app.updateSettings({ reduceMotion: false }));
    await frame(page, 64);
    await tapTile(page, 7, 5);
    await waitForIdle(page);
    await expect
      .poll(() => page.evaluate(() => window.fnt!.app.state!.location.pos))
      .toEqual({ x: 7, y: 5 });
    await tapTile(page, 8, 5);
    await expect
      .poll(() => page.evaluate(() => window.fnt!.app.state!.story.nodeId))
      .toBe('gate_parley');
    await expect(page.getByRole('button', { name: /Walk up and knock/ })).toBeVisible();
    await page.screenshot({ path: `${folder}/parley.png` });
    expect(errors).toEqual([]);
    writeFileSync(
      `${folder}/provenance.json`,
      JSON.stringify(
        {
          build,
          renderer,
          views,
          errors,
          setup:
            'Seeded newGame; gate explore fixture at (5,5), unvisited trigger and no escort objective. Actual wheel/pan, then ordinary map taps (7,5) and (8,5) to gate_parley. Reduced-motion screenshot is idle still review.',
        },
        null,
        2,
      ),
    );
  });
