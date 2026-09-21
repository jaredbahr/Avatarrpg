/**
 * Local whole-rim review for the Ba Dan exterior apron.
 *
 * Captures the village and forest exploration views at the default follow
 * camera and at zoom 64 centred on each rim face and both road exits, so the
 * apron's join, its road continuation and its fade can be compared with the
 * approved references. Review fixtures only — not a playthrough, not an
 * accessibility or device check.
 *
 * FNT_REVIEW_BROWSER_CHANNEL=chrome npx playwright test -c
 * playwright.ba-dan-apron.config.ts
 */
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

const SCENES = [
  {
    node: 'village_explore',
    rim: [
      [12, 0],
      [0, 8],
      [23, 15],
      [12, 15],
      [0, 7],
      [23, 7],
    ],
  },
  {
    node: 'forest_explore',
    rim: [
      [8, 0],
      [0, 8],
      [15, 15],
      [8, 15],
    ],
  },
] as const;

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`${renderer} board rim probe`, async ({ page }) => {
    test.setTimeout(300_000);
    const folder = `.shots/rim-probe/${renderer}`;
    mkdirSync(folder, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Sura', 'Riko', 'Kaya'], ['sura', 'riko', 'kaya'], 'rim-probe', {
      reduceMotion: false,
    });
    for (const { node, rim } of SCENES) {
      await enterNode(page, node);
      await waitForIdle(page);
      await settleLayout(page);
      await page.screenshot({ path: `${folder}/${node}-fit.png` });
      await zoom(page, 64);
      for (const [tx, ty] of rim) {
        await centerTile(page, tx, ty);
        await page.screenshot({ path: `${folder}/${node}-rim-${tx}-${ty}.png` });
      }
    }
    writeFileSync(`${folder}/errors.json`, JSON.stringify(errors, null, 2));
    expect(errors).toEqual([]);
  });
}
