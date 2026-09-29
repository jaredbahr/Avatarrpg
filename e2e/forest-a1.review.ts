/**
 * Local set-piece probe for the A1 Forest Road pass: the NE bank and its
 * boulder perch, the creek with its alders and deadfall, the keeper's lodge,
 * the milestone, both road mouths and the interactable props, in exploration
 * and in the fight, on both backends.
 * Review fixture only: not a playthrough, not a device or accessibility check.
 *
 * npx playwright test -c playwright.forest-a1.config.ts
 */
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

async function centerTile(page: Page, tx: number, ty: number): Promise<void> {
  const box = await page.locator('.map-canvas').boundingBox();
  if (!box) throw new Error('No canvas');
  const point = await page.evaluate(
    ({ tx, ty }) => {
      const m = window.fnt!.app.rendererCamera()!.groundTransform;
      return {
        x: m.a * (tx + 0.5) * 64 + m.c * (ty + 0.5) * 64 + m.tx,
        y: m.b * (tx + 0.5) * 64 + m.d * (ty + 0.5) * 64 + m.ty,
      };
    },
    { tx, ty },
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

/** Set pieces, by the tile each frame is centred on. */
const PIECES = [
  ['bank', 17, 2],
  ['lodge', 2, 1],
  ['north-clearing', 5, 1],
  ['creek-west', 4, 10],
  ['creek-east', 14, 10],
  ['west-mouth', 0, 5],
  ['east-mouth', 19, 6],
  ['cart-track', 9, 8],
  ['props', 14, 4],
] as const;

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`${renderer} forest set pieces`, async ({ page }) => {
    test.setTimeout(300_000);
    const folder = `.shots/forest-a1/${renderer}`;
    mkdirSync(folder, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Sura', 'Riko', 'Kaya'], ['sura', 'riko', 'kaya'], 'forest-a1', {
      reduceMotion: false,
    });
    await enterNode(page, 'forest_explore');
    await waitForIdle(page);
    await settleLayout(page);
    await page.screenshot({ path: `${folder}/explore-fit.png` });
    await zoom(page, 56);
    for (const [name, tx, ty] of PIECES) {
      await centerTile(page, tx, ty);
      await page.screenshot({ path: `${folder}/explore-${name}.png` });
    }
    writeFileSync(`${folder}/explore-errors.json`, JSON.stringify(errors, null, 2));
    expect(errors).toEqual([]);
  });

  test(`${renderer} forest fight`, async ({ page }) => {
    test.setTimeout(300_000);
    const folder = `.shots/forest-a1/${renderer}`;
    mkdirSync(folder, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(
      page,
      ['Sura', 'Riko', 'Kaya', 'Bo', 'Nima', 'Wen'],
      ['sura', 'riko', 'kaya', 'bo', 'nima', 'wen'],
      'forest-a1-fight',
      { reduceMotion: false },
    );
    await enterNode(page, 'battle_forest_road');
    await takeTurn(page);
    await waitForIdle(page);
    await settleLayout(page);
    await page.screenshot({ path: `${folder}/fight-fit.png` });
    await zoom(page, 44);
    for (const [name, tx, ty] of [
      ['fight-bank', 16, 3],
      ['fight-props', 13, 4],
      ['fight-south', 9, 9],
    ] as const) {
      await centerTile(page, tx, ty);
      await page.screenshot({ path: `${folder}/${name}.png` });
    }
    writeFileSync(`${folder}/fight-errors.json`, JSON.stringify(errors, null, 2));
    expect(errors).toEqual([]);
  });
}
