/** Local pond composition review; surface samples are explicitly staged gallery fixtures. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';

async function zoom(page: Page, target: number): Promise<void> {
  const current = await page.evaluate(() => window.fnt?.app.rendererCamera()?.tilePx);
  const box = await page.locator('.map-canvas').boundingBox();
  if (!current || !box) throw new Error('Missing camera');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, Math.log(current / target) / 0.002);
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.rendererCamera()?.tilePx))
    .toBeCloseTo(target, 1);
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

async function focusPond(page: Page): Promise<void> {
  const box = await page.locator('.map-canvas').boundingBox();
  if (!box) throw new Error('No canvas');
  const point = await page.evaluate(() => {
    const m = window.fnt!.app.rendererCamera()!.groundTransform;
    return { x: m.a * 6 * 64 + m.c * 6.5 * 64 + m.tx, y: m.b * 6 * 64 + m.d * 6.5 * 64 + m.ty };
  });
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + box.width / 2 - point.x, start.y + box.height / 2 - point.y, {
    steps: 8,
  });
  await page.mouse.up();
  await settleLayout(page);
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`${renderer} forest pond`, async ({ page }) => {
    test.setTimeout(180_000);
    const revision = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
    const modified = execFileSync('git', ['diff', 'HEAD', '--name-only'], {
      encoding: 'utf8',
    }).trim();
    const build = `${revision}${modified ? '-modified' : ''}`;
    const folder = `${process.env.FNT_POND_REVIEW_DIR ?? '.shots/pond-review'}/${renderer}`;
    mkdirSync(folder, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await resetStorage(page, `?renderer=${renderer}`);
    await expect(page.locator('[aria-label^="Game version"]')).toHaveText(
      new RegExp(`build ${build}$`),
    );
    await page.screenshot({ path: `${folder}/source-build.png` });
    const views = [];
    for (const mode of ['exploration', 'combat'] as const) {
      await startGame(page, ['Sura', 'Riko'], ['sura', 'riko'], 'pond-review', {
        reduceMotion: false,
      });
      await enterNode(page, mode === 'exploration' ? 'forest_explore' : 'battle_forest_road');
      if (mode === 'combat') await takeTurn(page);
      await waitForIdle(page);
      await settleLayout(page);
      expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(renderer);
      if (mode === 'exploration') {
        await zoom(page, 64);
        await tapTile(page, 2, 5);
        await waitForIdle(page);
        await expect
          .poll(() => page.evaluate(() => window.fnt!.app.state!.location.pos))
          .toEqual({ x: 2, y: 5 });
      }
      for (const size of [64, 96]) {
        await zoom(page, size);
        await focusPond(page);
        for (const grid of [false, true]) {
          await page.evaluate((showGrid) => window.fnt!.app.updateSettings({ showGrid }), grid);
          await settleLayout(page);
          const name = `${mode}-${size}-grid-${grid ? 'on' : 'off'}`;
          await page.screenshot({ path: `${folder}/${name}.png` });
          views.push({ name, camera: await page.evaluate(() => window.fnt!.app.rendererCamera()) });
        }
      }
      if (mode === 'exploration') {
        // Ordinary approach stays west of the live Into the Pines story trigger.
        for (const pos of [
          { x: 3, y: 6 },
          { x: 3, y: 7 },
        ]) {
          await tapTile(page, pos.x, pos.y);
          await waitForIdle(page);
          await expect
            .poll(() => page.evaluate(() => window.fnt!.app.state!.location.pos))
            .toEqual(pos);
        }
      }
      if (mode === 'combat') {
        await page.evaluate(() => {
          const app = window.fnt!.app,
            state = app.state!,
            battle = state.battle!;
          const patches = [
            { x: 5, y: 5, id: 'ice' as const },
            { x: 6, y: 6, id: 'mud' as const },
            { x: 5, y: 7, id: 'steam' as const },
          ];
          app.state = {
            ...state,
            battle: {
              ...battle,
              grid: {
                ...battle.grid,
                tiles: battle.grid.tiles.map((tile, i) => {
                  const p = patches.find((p) => p.y * battle.grid.width + p.x === i);
                  return p ? { ...tile, surface: { id: p.id, duration: 3, spread: 0 } } : tile;
                }),
              },
            },
          };
          app.resync();
          app.updateSettings({ showGrid: false });
        });
        for (const size of [64, 96]) {
          await zoom(page, size);
          await focusPond(page);
          await page.screenshot({ path: `${folder}/staged-surfaces-${size}.png` });
        }
        await page.evaluate(() =>
          window.fnt!.app.updateSettings({ highContrast: true, hatchSurfaces: true }),
        );
        await settleLayout(page);
        await page.screenshot({ path: `${folder}/accessibility-96.png` });
      }
    }
    const blocked: string[] = [];
    await page.route('**/art/maps/forest-scene/water.webp', async (route) => {
      blocked.push(route.request().url());
      await route.abort();
    });
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Sura', 'Riko'], ['sura', 'riko'], 'pond-review', {
      reduceMotion: false,
    });
    await enterNode(page, 'forest_explore');
    await waitForIdle(page);
    await zoom(page, 96);
    await focusPond(page);
    await page.screenshot({ path: `${folder}/missing-water-fallback-96.png` });
    expect(blocked.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    writeFileSync(
      `${folder}/provenance.json`,
      JSON.stringify(
        {
          revision,
          build,
          renderer,
          views,
          errors,
          blocked,
          setup:
            'Seeded newGame/enterNode; actual wheel/pan/map tap; grid via settings API. Ice/mud/steam are explicit presentation-only battle-grid fixtures, not claimed legal casts.',
        },
        null,
        2,
      ),
    );
  });
}
