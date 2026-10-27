/**
 * Whole-village review captures for Ba Dan (issue #284): the same Canvas camera before and after a change to the
 * village art, zoomed out (tile ~36 px) and at mid zoom (~56 px, three frames west to east). Local review fixture only,
 * not a CI check.
 *
 * FNT_VILLAGE_LABEL=before npx playwright test -c playwright.ba-dan-village.config.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

async function zoom(page: Page, target: number): Promise<number> {
  const box = await page.locator('.map-canvas').boundingBox();
  if (!box) throw new Error('No canvas');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 6; i++) {
    const current = await page.evaluate(() => window.fnt?.app.rendererCamera()?.tilePx ?? 0);
    if (Math.abs(current - target) < 0.5) break;
    await page.mouse.wheel(0, Math.log(current / target) / 0.002);
    await settleLayout(page);
  }
  return page.evaluate(() => window.fnt?.app.rendererCamera()?.tilePx ?? 0);
}

async function centerTile(page: Page, tx: number, ty: number): Promise<void> {
  const box = await page.locator('.map-canvas').boundingBox();
  if (!box) throw new Error('No canvas');
  const point = await page.evaluate(
    ({ x, y }) => {
      const m = window.fnt!.app.rendererCamera()!.groundTransform;
      return {
        x: m.a * (x + 0.5) * 64 + m.c * (y + 0.5) * 64 + m.tx,
        y: m.b * (x + 0.5) * 64 + m.d * (y + 0.5) * 64 + m.ty,
      };
    },
    { x: tx, y: ty },
  );
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + box.width / 2 - point.x, start.y + box.height / 2 - point.y, {
    steps: 6,
  });
  await page.mouse.up();
  await settleLayout(page);
}

const FRAMES = [
  ['wide', 36, [12, 8]],
  ['mid-west', 56, [5, 7]],
  ['mid-centre', 56, [12, 8]],
  ['mid-east', 56, [18, 7]],
] as const;

test('Ba Dan whole village (canvas)', async ({ page }) => {
  test.setTimeout(240_000);
  const label = process.env.FNT_VILLAGE_LABEL ?? 'current';
  const folder = `${process.env.FNT_VILLAGE_REVIEW_DIR ?? '.shots/ba-dan-village'}/${label}`;
  mkdirSync(folder, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Kaya', 'Sura', 'Bo'], ['kaya', 'sura', 'bo'], 'ba-dan-village', {
    reduceMotion: true,
  });
  await enterNode(page, 'village_explore');
  await waitForIdle(page);
  await settleLayout(page);
  const tiles: Record<string, number> = {};
  for (const [name, tile, [tx, ty]] of FRAMES) {
    tiles[name] = await zoom(page, tile);
    await centerTile(page, tx, ty);
    await page.waitForTimeout(500);
    await page.locator('.map-canvas').screenshot({ path: `${folder}/${name}.png` });
  }
  const revision = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  writeFileSync(
    `${folder}/provenance.json`,
    JSON.stringify({ issue: 284, label, revision, tiles, errors }, null, 2) + '\n',
  );
  expect(errors).toEqual([]);
});
