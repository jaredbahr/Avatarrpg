/**
 * Local review captures for the Ba Dan restyle: the G party (Kaya, Sura, Bo)
 * walking the village on both backends, at the fitted view and at game zoom
 * (tile 77 px, the 1.2 camera the style study measured), past the houses, the
 * market stalls, the planters, the bridge and the outer garden. One frame is
 * taken mid-walk at every stop. Review fixtures only — not a playthrough, not
 * an accessibility or device check.
 *
 * FNT_RESTYLE_REVIEW_DIR=<folder> npx playwright test -c
 * playwright.ba-dan-restyle.config.ts
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
    .toBeCloseTo(target, 0);
  await settleLayout(page);
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

/**
 * Stand the party on `from`, tap `to`, photograph it on the way, then follow
 * it to the stop. These endpoints are deliberately clear of resident anchors:
 * a missed tap or interrupted route is a failed evidence run, not a frame we
 * silently accept.
 */
async function walk(
  page: Page,
  from: readonly [number, number],
  to: readonly [number, number],
  shot: string,
): Promise<void> {
  await page.evaluate(
    ([x, y]) => {
      const app = window.fnt!.app;
      const state = app.state!;
      app.adoptSave({ ...state, location: { ...state.location, pos: { x, y } } }, undefined);
    },
    [from[0], from[1]] as const,
  );
  await waitForIdle(page);
  await page
    .getByRole('button', { name: 'Follow party', exact: true })
    .click({ timeout: 3_000 })
    .catch(() => undefined);
  await settleLayout(page);
  await page
    .locator('.map-canvas')
    .click({ position: await tilePoint(page, to[0], to[1]), timeout: 5_000 });
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${shot}-walking.png` });
  await expect
    .poll(() => page.evaluate(() => window.fnt!.app.state!.location.pos), { timeout: 10_000 })
    .toEqual({ x: to[0], y: to[1] });
  await waitForIdle(page);
  await page
    .getByRole('button', { name: 'Follow party', exact: true })
    .click({ timeout: 3_000 })
    .catch(() => undefined);
  await settleLayout(page);
  await page.screenshot({ path: `${shot}.png` });
}

const LINEUP = [
  ['ba-dan', 'village_explore', [12, 8]],
  ['riverside', 'riverside_explore', [8, 15]],
  ['forest', 'forest_explore', [12, 8]],
  ['quarry', 'quarry_after_explore', [10, 7]],
] as const;

async function captureLineup(page: Page, folder: string): Promise<void> {
  const frames: { label: string; path: string }[] = [];
  for (const [label, node, center] of LINEUP) {
    await enterNode(page, node);
    await waitForIdle(page);
    await settleLayout(page);
    await zoom(page, 77);
    await centerTile(page, center[0], center[1]);
    const path = `${folder}/lineup-${label}.png`;
    await page.locator('.map-canvas').screenshot({ path });
    frames.push({ label, path });
  }

  const cards = frames
    .map(({ label, path }) => {
      const png = readFileSync(path).toString('base64');
      return `<figure><figcaption>${label}</figcaption><img src="data:image/png;base64,${png}"></figure>`;
    })
    .join('');
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.setContent(`<style>
    * { box-sizing: border-box } body { margin: 0; padding: 16px; background: #1b1410; color: #efe6d2; font: 22px serif }
    main { display: grid; grid-template-columns: 1fr 1fr; gap: 16px }
    figure { margin: 0; overflow: hidden; border: 2px solid #8e7049; background: #30251d }
    figcaption { padding: 8px 12px; text-transform: uppercase; letter-spacing: .08em }
    img { display: block; width: 100%; height: 460px; object-fit: cover; image-rendering: pixelated }
  </style><main>${cards}</main>`);
  await page.locator('main').screenshot({ path: `${folder}/lineup-side-by-side.png` });
}

const STOPS = [
  ['market-road', [6, 8], [11, 8]],
  ['south-houses', [11, 8], [11, 11]],
  ['east-road', [13, 7], [18, 8]],
  ['northeast-lawn', [18, 6], [20, 4]],
  ['north-court', [12, 7], [15, 5]],
  ['west-garden', [3, 8], [2, 5]],
  ['southwest-garden', [3, 9], [3, 12]],
] as const;

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`${renderer} Ba Dan restyle walk`, async ({ page }) => {
    test.setTimeout(300_000);
    const revision =
      process.env.FNT_RESTYLE_REVISION ??
      execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).trim();
    const folder = `${process.env.FNT_RESTYLE_REVIEW_DIR ?? '.shots/ba-dan-restyle'}/${renderer}`;
    mkdirSync(folder, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Kaya', 'Sura', 'Bo'], ['kaya', 'sura', 'bo'], 'ba-dan-restyle', {
      reduceMotion: false,
    });
    await enterNode(page, 'village_explore');
    await waitForIdle(page);
    await settleLayout(page);
    expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(renderer);
    await page.screenshot({ path: `${folder}/00-fit.png` });
    // The whole village and its outer garden in one frame.
    await zoom(page, 34);
    await centerTile(page, 12, 8);
    await page.screenshot({ path: `${folder}/00-wide.png` });
    await page.getByRole('button', { name: 'Follow party', exact: true }).click();
    await settleLayout(page);
    await zoom(page, 77);
    await page.screenshot({ path: `${folder}/01-spawn.png` });
    for (const [index, [name, from, to]] of STOPS.entries()) {
      await walk(page, from, to, `${folder}/${String(index + 2).padStart(2, '0')}-${name}`);
    }
    await captureLineup(page, folder);
    writeFileSync(
      `${folder}/provenance.json`,
      JSON.stringify(
        {
          revision,
          renderer,
          seed: 'ba-dan-restyle',
          tilePx: 77,
          diff:
            process.env.FNT_RESTYLE_DIFF ??
            execFileSync('git', ['diff', '--stat'], { encoding: 'utf8' }),
          errors,
        },
        null,
        2,
      ),
    );
    expect(errors).toEqual([]);
  });
}
