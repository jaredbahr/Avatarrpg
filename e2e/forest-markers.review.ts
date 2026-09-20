/** Local marker review; seeded setup, then ordinary map taps and Inspect. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

async function zoom(page: Page, target: number): Promise<void> {
  const current = await page.evaluate(() => window.fnt?.app.rendererCamera()?.tilePx);
  const box = await page.locator('.map-canvas').boundingBox();
  if (!current || !box) throw new Error('Missing camera');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, Math.log(current / target) / 0.002);
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.rendererCamera()?.tilePx))
    .toBeCloseTo(target, 1);
  await page.getByRole('button', { name: 'Follow party', exact: true }).click();
  await settleLayout(page);
}

async function tapTile(page: Page, x: number, y: number): Promise<void> {
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

for (const renderer of ['canvas', 'webgl'] as const) {
  for (const fallback of [false, true]) {
    test(`${renderer} forest markers ${fallback ? 'fallback' : 'illustrated'}`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const revision = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
        encoding: 'utf8',
      }).trim();
      const folder = `${process.env.FNT_FOREST_REVIEW_DIR ?? '.shots/forest-markers'}/${renderer}-${fallback ? 'fallback' : 'illustrated'}`;
      mkdirSync(folder, { recursive: true });
      const errors: string[] = [];
      const blockedAssets: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      if (fallback)
        await page.route('**/art/units/thug.*', async (route) => {
          blockedAssets.push(route.request().url());
          await route.abort();
        });
      await resetStorage(page, `?renderer=${renderer}`);
      const build = page.locator('[aria-label^="Game version"]');
      await expect(build).toHaveText(new RegExp(`build ${revision}$`));
      const stamp = await build.innerText();
      await page.screenshot({ path: `${folder}/source-build.png` });
      await startGame(page, ['Sura', 'Riko'], ['sura', 'riko'], 'forest-markers-review', {
        reduceMotion: false,
      });
      await enterNode(page, 'forest_explore');
      await waitForIdle(page);
      await settleLayout(page);
      expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(renderer);
      const views = [];
      for (const size of [64, 96]) {
        await zoom(page, size);
        await page.screenshot({ path: `${folder}/entry-${size}.png` });
        views.push({
          name: 'entry',
          size,
          camera: await page.evaluate(() => window.fnt!.app.rendererCamera()),
        });
      }
      await zoom(page, 64);
      // Stay west of the narrative crossing while approaching the discoverable nest.
      for (const [x, y] of [
        [2, 5],
        [2, 8],
      ] as const) {
        await tapTile(page, x, y);
        await expect
          .poll(() => page.evaluate(() => window.fnt!.app.state!.location.pos))
          .toEqual({ x, y });
        await waitForIdle(page);
        await page.getByRole('button', { name: 'Follow party', exact: true }).click();
        await settleLayout(page);
      }
      for (const size of [64, 96]) {
        await zoom(page, size);
        await page.screenshot({ path: `${folder}/nest-${size}.png` });
        views.push({
          name: 'nest',
          size,
          camera: await page.evaluate(() => window.fnt!.app.rendererCamera()),
        });
      }
      // Click the original logical cell center, independent of the smaller painted body.
      await tapTile(page, 2, 9);
      await expect
        .poll(() => page.evaluate(() => window.fnt!.app.state!.story.nodeId))
        .toBe('discover_duck_nest');
      await expect(page.locator('.explore-conversation, .dialogue-scene').first()).toBeVisible();
      await page.screenshot({ path: `${folder}/inspect.png` });
      if (fallback) expect(blockedAssets.length).toBeGreaterThan(0);
      expect(errors).toEqual([]);
      writeFileSync(
        `${folder}/provenance.json`,
        JSON.stringify(
          {
            revision,
            stamp,
            renderer,
            fallback,
            blockedAssets,
            seed: 'forest-markers-review',
            reduced: false,
            views,
            errors,
            setup:
              'Standard newGame/enterNode fixture; subsequent normal map taps, wheel and Follow party. Original nest cell tap opens its story.',
          },
          null,
          2,
        ),
      );
    });
  }
}
