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
 * it to the stop. Residents keep their own routines, so a tap can land on
 * one and start a conversation instead of a walk; the shots are taken
 * whatever happens and any dialogue is dismissed.
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
    .click({ position: await tilePoint(page, to[0], to[1]), timeout: 5_000 })
    .catch(() => undefined);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${shot}-walking.png` });
  await expect
    .poll(() => page.evaluate(() => window.fnt!.app.state!.location.pos), { timeout: 10_000 })
    .toEqual({ x: to[0], y: to[1] })
    .catch(() => undefined);
  await page.keyboard.press('Escape');
  await waitForIdle(page);
  await page
    .getByRole('button', { name: 'Follow party', exact: true })
    .click({ timeout: 3_000 })
    .catch(() => undefined);
  await settleLayout(page);
  await page.screenshot({ path: `${shot}.png` });
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
    const revision = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
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
    writeFileSync(
      `${folder}/provenance.json`,
      JSON.stringify(
        {
          revision,
          renderer,
          seed: 'ba-dan-restyle',
          tilePx: 77,
          diff: execFileSync('git', ['diff', '--stat'], { encoding: 'utf8' }),
          errors,
        },
        null,
        2,
      ),
    );
    expect(errors).toEqual([]);
  });
}
