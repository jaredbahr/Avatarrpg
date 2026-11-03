/**
 * Review captures for the occlusion reveal (ADR 0096): the party behind the
 * south-west house and behind Gao's shop at game zoom (128 px tiles, N = 2 at
 * dpr 1), on both backends, with a nearest 4x crop around the hidden leader.
 *
 * Writes, under FNT_REVEAL_DIR (default .shots/occlusion-reveal/<label>/<renderer>):
 * - <spot>.png: the board around the spot;
 * - <spot>-4x.png: the leader's surroundings, 4x nearest.
 *
 * Local review fixture only: not a playthrough, not a CI check.
 *
 * FNT_REVEAL_LABEL=before npx playwright test -c playwright.occlusion-reveal.config.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

async function zoom(page: Page, target: number): Promise<number> {
  const current = await page.evaluate(() => window.fnt?.app.rendererCamera()?.tilePx);
  const box = await page.locator('.map-canvas').boundingBox();
  if (!current || !box) throw new Error('Missing camera');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, Math.log(current / target) / 0.002);
  let last = 0;
  await expect
    .poll(async () => {
      const now = await page.evaluate(() => window.fnt?.app.rendererCamera()?.tilePx ?? 0);
      const still = now === last;
      last = now;
      return still;
    })
    .toBe(true);
  await settleLayout(page);
  return page.evaluate(() => window.fnt!.app.rendererCamera()!.tilePx);
}

/** Canvas-relative pixel of a tile's centre on the ground. */
async function tilePoint(page: Page, x: number, y: number) {
  return page.evaluate(
    ({ x, y }) => {
      const m = window.fnt!.app.rendererCamera()!.groundTransform;
      return {
        x: m.a * (x + 0.5) * 64 + m.c * (y + 0.5) * 64 + m.tx,
        y: m.b * (x + 0.5) * 64 + m.d * (y + 0.5) * 64 + m.ty,
      };
    },
    { x, y },
  );
}

async function centerTile(page: Page, tx: number, ty: number): Promise<void> {
  const box = await page.locator('.map-canvas').boundingBox();
  if (!box) throw new Error('No canvas');
  const point = await tilePoint(page, tx, ty);
  const start = { x: box.x + 24, y: box.y + 24 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + box.width / 2 - point.x, start.y + box.height / 2 - point.y, {
    steps: 6,
  });
  await page.mouse.up();
  const close = page.getByRole('button', { name: 'Close', exact: true });
  if (await close.isVisible()) await close.click();
  await settleLayout(page);
}

async function place(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(
    ([x, y]) => {
      const app = window.fnt!.app;
      const state = app.state!;
      app.adoptSave({ ...state, location: { ...state.location, pos: { x, y } } }, undefined);
    },
    [x, y] as const,
  );
  await waitForIdle(page);
}

function crop4x(src: PNG, cx: number, cy: number, w: number, h: number): PNG {
  const x0 = Math.max(0, Math.min(src.width - w, Math.round(cx - w / 2)));
  const y0 = Math.max(0, Math.min(src.height - h, Math.round(cy - h / 2)));
  const dst = new PNG({ width: w * 4, height: h * 4 });
  for (let y = 0; y < h * 4; y++)
    for (let x = 0; x < w * 4; x++) {
      const s = ((y0 + Math.floor(y / 4)) * src.width + x0 + Math.floor(x / 4)) * 4;
      const d = (y * w * 4 + x) * 4;
      for (let c = 0; c < 4; c++) dst.data[d + c] = src.data[s + c]!;
    }
  return dst;
}

/** Where the leader stands, and the tile the shot is framed on. */
const SPOTS = [
  ['southwest-house', [7, 9], [8, 11]],
  ['gao-shop', [7, 0], [7, 2]],
] as const;

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`${renderer} occlusion reveal`, async ({ page }) => {
    test.setTimeout(180_000);
    const label = process.env.FNT_REVEAL_LABEL ?? 'current';
    const folder = `${process.env.FNT_REVEAL_DIR ?? '.shots/occlusion-reveal'}/${label}/${renderer}`;
    mkdirSync(folder, { recursive: true });
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Kaya', 'Sura', 'Bo'], ['kaya', 'sura', 'bo'], 'occlusion-reveal', {
      reduceMotion: true,
    });
    await enterNode(page, 'village_explore');
    await waitForIdle(page);
    await settleLayout(page);
    expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(renderer);
    const tilePx = await zoom(page, 128);
    for (const [name, at, frame] of SPOTS) {
      await place(page, at[0], at[1]);
      await centerTile(page, frame[0], frame[1]);
      await page.waitForTimeout(800);
      const path = `${folder}/${name}.png`;
      const box = await page.locator('.map-canvas').boundingBox();
      await page.screenshot({ path, clip: box! });
      const leader = await tilePoint(page, at[0], at[1]);
      const w = Math.round(tilePx * 1.6);
      const h = Math.round(tilePx * 1.2);
      writeFileSync(
        `${folder}/${name}-4x.png`,
        PNG.sync.write(
          crop4x(PNG.sync.read(readFileSync(path)), leader.x, leader.y - tilePx * 0.55, w, h),
        ),
      );
    }
    writeFileSync(`${folder}/provenance.json`, JSON.stringify({ renderer, tilePx }, null, 1));
  });
}
