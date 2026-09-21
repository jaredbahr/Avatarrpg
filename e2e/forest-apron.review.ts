/**
 * Local rim probe for the forest road exterior apron.
 *
 * Captures the forest exploration view at the default follow camera and at zoom
 * 64 centred on each rim face and both road exits, so the apron's join, its road
 * continuation and its fade can be compared with the approved references.
 * Review fixture only: not a playthrough, not a device or accessibility check.
 *
 * FNT_REVIEW_BROWSER_CHANNEL=chrome npx playwright test -c
 * playwright.forest-apron.config.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  enterNode,
  resetStorage,
  settleLayout,
  startGame,
  takeTurn,
  waitForIdle,
} from './helpers';

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

/** Rim faces and both road exits of the 20x12 forest board. */
const RIM = [
  [9, 0],
  [0, 6],
  [19, 6],
  [9, 11],
  [0, 4],
  [19, 4],
] as const;

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`${renderer} forest rim probe`, async ({ page }) => {
    test.setTimeout(240_000);
    const folder = `.shots/forest-apron/${renderer}`;
    mkdirSync(folder, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Sura', 'Riko', 'Kaya'], ['sura', 'riko', 'kaya'], 'forest-apron', {
      reduceMotion: false,
    });
    await enterNode(page, 'forest_explore');
    await waitForIdle(page);
    await settleLayout(page);
    await page.screenshot({ path: `${folder}/fit.png` });
    await zoom(page, 64);
    for (const [tx, ty] of RIM) {
      await centerTile(page, tx, ty);
      await page.screenshot({ path: `${folder}/rim-${tx}-${ty}.png` });
    }
    writeFileSync(`${folder}/errors.json`, JSON.stringify(errors, null, 2));
    expect(errors).toEqual([]);
  });
}

/*
 * The rim probe above is exploration. This one answers the sibling question the
 * forest apron handoff left open: does the apron hold while the road is being
 * fought over, where the encounter camera, not the follow camera, owns the
 * frame? It captures the fight's own framing, then pulls out and centres on the
 * two board edges the fight sits nearest — the west exit and the north rim.
 */
for (const renderer of ['canvas', 'webgl'] as const) {
  test(`${renderer} forest combat framing`, async ({ page }) => {
    test.setTimeout(240_000);
    const folder = `.shots/forest-apron/${renderer}`;
    mkdirSync(folder, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Sura', 'Riko', 'Kaya'], ['sura', 'riko', 'kaya'], 'forest-apron-fight', {
      reduceMotion: false,
    });
    await enterNode(page, 'battle_forest_road');
    await takeTurn(page);
    await waitForIdle(page);
    await settleLayout(page);
    await page.screenshot({ path: `${folder}/combat-fit.png` });
    await zoom(page, 40);
    for (const [tx, ty] of [
      [0, 4],
      [9, 0],
    ] as const) {
      await centerTile(page, tx, ty);
      await page.screenshot({ path: `${folder}/combat-rim-${tx}-${ty}.png` });
    }
    writeFileSync(`${folder}/combat-errors.json`, JSON.stringify(errors, null, 2));
    expect(errors).toEqual([]);
  });
}
