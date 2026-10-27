/**
 * Review captures for the forest road at G1 (issue #284, ADR 0085): the first
 * fight, photographed the same way before and after the restyle so the two
 * line up frame for frame.
 *
 * For each backend it writes, under FNT_FOREST_G1_DIR (default
 * .shots/forest-g1/<label>/<renderer>):
 * - fit.png: the whole board at the combat fit (zoomed fully out), party and bandits;
 * - zoom96-<name>.png: the 1.5 camera (96 px tiles, 1 world px = 1.5 screen px)
 *   on fixed set pieces: the props, the NE bank and perch, the pond, the
 *   party's road mouth, the creek and the lodge;
 * - move-fit.png and move-96.png: Kaya's movement preview;
 * - aim-flask-96.png: Fire Jab aimed at the oil flask, the confirm bar naming
 *   the break;
 * - bend-NN.png, bend-oil.png: the jab landing on the flask, at fixed times
 *   after confirming, then the oil it leaves under a bandit;
 * - aim-bandit-in-oil-96.png, fire-NN.png, fire-settled.png: a second jab at
 *   that bandit lights the oil;
 * - crop-<name>-4x.png: nearest-neighbour 4x crops of the 96 px frames;
 * - provenance.json: revision, renderer, seed, errors.
 *
 * Local review fixture only: not a playthrough, not a CI check.
 *
 * FNT_FOREST_G1_LABEL=before npx playwright test -c playwright.forest-g1.config.ts
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';

const SEED = 'forest-g1';
const ZOOM = 96;

async function zoom(page: Page, target: number): Promise<void> {
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
}

/** Canvas-relative pixel centre of a tile, through the camera the tap handler reads. */
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
  // Start in a corner so the drag never begins on a figure and opens its sheet.
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

/** The canvas alone, without waiting for it to hold still (a burning tile never does). */
async function shoot(page: Page, path: string): Promise<void> {
  const box = await page.locator('.map-canvas').boundingBox();
  if (!box) throw new Error('No canvas');
  await page.screenshot({ path, clip: box });
}

function crop4x(source: string, cx: number, cy: number, w: number, h: number, out: string): void {
  const src = PNG.sync.read(readFileSync(source));
  const x0 = Math.max(0, Math.min(src.width - w, Math.round(cx - w / 2)));
  const y0 = Math.max(0, Math.min(src.height - h, Math.round(cy - h / 2)));
  const dst = new PNG({ width: w * 4, height: h * 4 });
  for (let y = 0; y < h * 4; y++)
    for (let x = 0; x < w * 4; x++) {
      const s = ((y0 + (y >> 2)) * src.width + x0 + (x >> 2)) * 4;
      const d = (y * w * 4 + x) * 4;
      for (let c = 0; c < 4; c++) dst.data[d + c] = src.data[s + c]!;
    }
  writeFileSync(out, PNG.sync.write(dst));
}

/** 96 px set pieces, by the tile each frame is centred on. */
const PIECES = [
  ['props', 13, 5],
  ['bank', 17, 3],
  ['pond', 6, 6],
  ['west-mouth', 2, 5],
  ['creek', 9, 10],
  ['lodge', 2, 1],
] as const;

/** Kaya stands south of the oil flask (13,6), beside the hay bale at (12,5). */
const KAYA_AT = { x: 13, y: 7 } as const;
const FLASK = { x: 13, y: 6 } as const;
/** A bandit stands in the flask's splash, so a second jab at him lights the oil. */
const BANDIT_AT = { x: 14, y: 6 } as const;

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`${renderer} forest road at G1`, async ({ page }) => {
    // WebGL on a software rasteriser (CI-like containers) draws a frame in seconds.
    test.setTimeout(1_200_000);
    const label = process.env.FNT_FOREST_G1_LABEL ?? 'current';
    const folder = `${process.env.FNT_FOREST_G1_DIR ?? '.shots/forest-g1'}/${label}/${renderer}`;
    mkdirSync(folder, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(
      page,
      ['Sura', 'Riko', 'Kaya', 'Bo', 'Nima', 'Wen'],
      ['sura', 'riko', 'kaya', 'bo', 'nima', 'wen'],
      SEED,
      { reduceMotion: false },
    );
    await enterNode(page, 'battle_forest_road');
    await page.waitForFunction(() => Boolean(window.fnt?.app.state?.battle));
    // Kaya acts first, from just south of the flask; a bandit waits beside it.
    await page.evaluate(
      ([at, bandit]) => {
        const app = window.fnt!.app;
        const state = app.state!;
        const battle = state.battle!;
        const kaya = battle.units.find((u) => u.characterId === 'kaya');
        const thug = battle.units.find((u) => u.faction !== 'party' && u.enemyId?.includes('thug'));
        if (!kaya || !thug) throw new Error('No Kaya or thug in the fight');
        app.state = {
          ...state,
          battle: {
            ...battle,
            units: battle.units.map((u) =>
              u.id === kaya.id ? { ...u, pos: at } : u.id === thug.id ? { ...u, pos: bandit } : u,
            ),
            turnIndex: battle.order.indexOf(kaya.id),
          },
        };
        app.resync();
      },
      [KAYA_AT, BANDIT_AT] as const,
    );
    await takeTurn(page);
    await waitForIdle(page);
    // The combat fit: zoom all the way out, where the camera stops at the whole board.
    await zoom(page, 20);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${folder}/fit.png` });

    await page.getByRole('button', { name: /^Move/ }).click();
    await settleLayout(page);
    await page.screenshot({ path: `${folder}/move-fit.png` });

    await zoom(page, ZOOM);
    const zoomedTilePx = await page.evaluate(() => window.fnt!.app.rendererCamera()!.tilePx);
    await centerTile(page, KAYA_AT.x, KAYA_AT.y - 1);
    await page.screenshot({ path: `${folder}/move-96.png` });
    await page.getByRole('button', { name: /^Move/ }).click();
    await settleLayout(page);

    for (const [name, tx, ty] of PIECES) {
      await centerTile(page, tx, ty);
      await page.waitForTimeout(300);
      await shoot(page, `${folder}/zoom96-${name}.png`);
    }

    // Aim Fire Jab at the flask: the reticle and the confirm bar name the break.
    await centerTile(page, FLASK.x, FLASK.y);
    await page.getByRole('button', { name: /^Fire Jab/ }).click();
    await settleLayout(page);
    const canvas = page.locator('.map-canvas');
    await canvas.click({ position: await tilePoint(page, FLASK.x, FLASK.y) });
    const confirm = page.locator('.confirm-bar').filter({ hasText: 'Confirm' });
    await expect(confirm).toContainText('Oil Flask');
    await page.screenshot({ path: `${folder}/aim-flask-96.png` });

    await confirm.getByRole('button', { name: /Confirm/ }).click();
    const start = Date.now();
    for (const [index, at] of [120, 350, 700, 1200].entries()) {
      await page.waitForTimeout(Math.max(0, at - (Date.now() - start)));
      await shoot(page, `${folder}/bend-${String(index).padStart(2, '0')}.png`);
    }
    await waitForIdle(page);
    await page.waitForTimeout(400);
    await shoot(page, `${folder}/bend-oil.png`);

    // Jab the bandit standing in the oil: it lights.
    await page.getByRole('button', { name: /^Fire Jab/ }).click();
    await settleLayout(page);
    await canvas.click({ position: await tilePoint(page, BANDIT_AT.x, BANDIT_AT.y) });
    await expect(confirm).toBeVisible();
    await page.screenshot({ path: `${folder}/aim-bandit-in-oil-96.png` });
    await confirm.getByRole('button', { name: /Confirm/ }).click();
    const lit = Date.now();
    for (const [index, at] of [150, 450, 900, 1500].entries()) {
      await page.waitForTimeout(Math.max(0, at - (Date.now() - lit)));
      await shoot(page, `${folder}/fire-${String(index).padStart(2, '0')}.png`);
    }
    await waitForIdle(page);
    await page.waitForTimeout(600);
    await shoot(page, `${folder}/fire-settled.png`);

    const box = await canvas.boundingBox();
    if (!box) throw new Error('No canvas');
    for (const [name, w, h] of [
      ['props', 240, 170],
      ['bank', 240, 170],
      ['pond', 240, 170],
      ['west-mouth', 240, 170],
    ] as const)
      crop4x(
        `${folder}/zoom96-${name}.png`,
        box.width / 2,
        box.height / 2,
        w,
        h,
        `${folder}/crop-${name}-4x.png`,
      );

    const revision = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim();
    writeFileSync(
      `${folder}/provenance.json`,
      JSON.stringify(
        {
          revision,
          renderer,
          seed: SEED,
          // Asked for, and what the camera drew at (integer zoom, ADR 0088, may differ).
          requestedTilePx: ZOOM,
          tilePx: zoomedTilePx,
          dpr: await page.evaluate(() => window.devicePixelRatio),
          errors,
        },
        null,
        2,
      ),
    );
    expect(errors).toEqual([]);
  });
}
