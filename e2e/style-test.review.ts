/**
 * Review captures for the world-style figure test (art/source/style-test-world-chars): the Ba Dan demo slice at the
 * scene's default zoom with the shipped figures (FNT_STYLE=current) or the test figures (FNT_STYLE=world, which opens
 * the game with `?style=world`). Same camera, same party positions, same Canvas backend for both.
 *
 * Writes, under .shots/style-test/<style>:
 * - slice.png: the whole map canvas, the party by Gao's market table and Gao at his door;
 * - provenance.json: revision, tile px, the screen points of Gao and the party (for the 4x crops), and, with
 *   FNT_STYLE_VIDEO=1, `videoCrossingMs`: where the real-time crossing of the slice starts and ends in the recording,
 *   for cutting the load (art/source/style-test-world-chars/tools/video.sh).
 *
 * Local review fixture only: not a CI check.
 *
 * FNT_STYLE_RENDERER=webgl captures the WebGL backend instead of Canvas, and FNT_STYLE_LABEL names the output
 * folder (default the style), so a before and an after can sit side by side.
 *
 * FNT_STYLE=world FNT_STYLE_VIDEO=1 npx playwright test -c playwright.style-test.config.ts
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

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
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + box.width / 2 - point.x, start.y + box.height / 2 - point.y, {
    steps: 6,
  });
  await page.mouse.up();
  await settleLayout(page);
}

async function placeParty(page: Page, pos: { x: number; y: number }): Promise<void> {
  await page.evaluate((pos) => {
    const app = window.fnt!.app;
    const state = app.state!;
    app.adoptSave({ ...state, location: { ...state.location, pos } }, undefined);
  }, pos);
  await waitForIdle(page);
}

const STILL = { x: Number(process.env.FNT_STYLE_X ?? 7), y: Number(process.env.FNT_STYLE_Y ?? 4) };

test('world-style figure captures', async ({ page }) => {
  test.setTimeout(300_000);
  const videoStart = Date.now();
  const style = process.env.FNT_STYLE ?? 'current';
  const renderer = process.env.FNT_STYLE_RENDERER ?? 'canvas';
  const folder = `.shots/style-test/${process.env.FNT_STYLE_LABEL ?? style}`;
  mkdirSync(folder, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await resetStorage(
    page,
    style === 'world' ? `?renderer=${renderer}&style=world` : `?renderer=${renderer}`,
  );
  await startGame(page, ['Kaya', 'Sura', 'Bo'], ['kaya', 'sura', 'bo'], 'ba-dan-demo', {
    reduceMotion: false,
  });
  await enterNode(page, 'village_explore');
  await waitForIdle(page);
  await settleLayout(page);
  const provenance: Record<string, unknown> = {
    style,
    renderer,
    revision: execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim(),
    tilePx: await page.evaluate(() => window.fnt!.app.rendererCamera()!.tilePx),
    dpr: await page.evaluate(() => window.devicePixelRatio),
  };

  // The still: the party walks in to stand by the market table, Gao at his door; the camera centred between them.
  await placeParty(page, { x: 4, y: 7 });
  await centerTile(page, 6, 5.5);
  await page.locator('.map-canvas').click({ position: await tilePoint(page, STILL.x, STILL.y) });
  await expect
    .poll(() => page.evaluate(() => window.fnt!.app.state!.location.pos), { timeout: 30_000 })
    .toEqual(STILL);
  await waitForIdle(page);
  await centerTile(page, 8, 4.5);
  await page.waitForTimeout(2500);
  await page.locator('.map-canvas').screenshot({ path: `${folder}/slice.png` });
  const box = await page.locator('.map-canvas').boundingBox();
  provenance.canvas = box;
  provenance.figures = await page.evaluate(() => {
    const app = window.fnt!.app;
    const m = app.rendererCamera()!.groundTransform;
    const at = (p: { x: number; y: number }) => ({
      x: Math.round(m.a * (p.x + 0.5) * 64 + m.c * (p.y + 0.5) * 64 + m.tx),
      y: Math.round(m.b * (p.x + 0.5) * 64 + m.d * (p.y + 0.5) * 64 + m.ty),
    });
    const party = app.state!.party.map((u) => ({
      id: u.id,
      ...at(app.animator.renderPos(performance.now(), u.id) ?? app.state!.location.pos),
    }));
    return { leader: party[0], gao: at({ x: 9, y: 4 }) };
  });

  if (process.env.FNT_STYLE_VIDEO) {
    // The party crosses the slice once at the game's own pace: the road's west end to the bridge, then up to the table.
    await placeParty(page, { x: 1, y: 8 });
    await centerTile(page, 5, 6.5);
    await page.waitForTimeout(800);
    const crossing = Date.now() - videoStart;
    await page.locator('.map-canvas').click({ position: await tilePoint(page, 9, 8) });
    await expect
      .poll(() => page.evaluate(() => window.fnt!.app.state!.location.pos.x), { timeout: 30_000 })
      .toBe(9);
    await waitForIdle(page);
    await page.waitForTimeout(600);
    await centerTile(page, 8, 6);
    await page.locator('.map-canvas').click({ position: await tilePoint(page, STILL.x, STILL.y) });
    await expect
      .poll(() => page.evaluate(() => window.fnt!.app.state!.location.pos), { timeout: 30_000 })
      .toEqual(STILL);
    await waitForIdle(page);
    await page.waitForTimeout(1500);
    provenance.videoCrossingMs = [crossing, Date.now() - videoStart];
  }
  provenance.errors = errors;
  writeFileSync(`${folder}/provenance.json`, JSON.stringify(provenance, null, 2));
  expect(errors).toEqual([]);
});
