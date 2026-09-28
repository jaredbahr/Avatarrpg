/**
 * Quarry props and ink review (DL-2).
 *
 * The gate, the Cutting and the Driller floor at the combat fit and close up
 * on a rubble heap and a barrel, so the heap outline, its spill, the barrel
 * lid and the ground joins can be judged at the size a table sees them. Review
 * fixtures only, not a regression gate:
 *
 *   FNT_QP_DIR=../evidence/before \
 *     npx playwright test -c playwright.quarry-props.config.ts
 */
import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';

const FOLDER = process.env.FNT_QP_DIR ?? '.shots/quarry-props';

const NODES = [
  ['battle_quarry_gate', 'gate'],
  ['battle_ambush', 'cutting'],
  ['battle_grumbler', 'floor'],
  // The same heap plate stands on the forest road's cover cells.
  ['battle_forest_road', 'forest'],
] as const;

async function zoom(page: Page, target: number): Promise<void> {
  const current = await page.evaluate(() => window.fnt?.app.rendererCamera()?.tilePx);
  const box = await page.locator('.map-canvas').boundingBox();
  if (!current || !box) throw new Error('Missing camera');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, Math.log(current / target) / 0.002);
  // The camera caps its zoom, so wait for the scale to stop moving rather than for the target.
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

/** Drags the camera until the given logical tile sits in the middle of the canvas. */
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
  // Start the drag in a corner so it does not begin on a figure and open its sheet.
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

/** The first painted rubble heap and the first barrel (or any prop) on the board. */
async function targets(
  page: Page,
): Promise<{ heap?: { x: number; y: number }; prop?: { x: number; y: number } }> {
  return page.evaluate(() => {
    const battle = window.fnt!.app.state!.battle!;
    const { width, tiles } = battle.grid;
    const index = tiles.findIndex((tile) => tile.surface?.id === 'rubble');
    const heap = index < 0 ? undefined : { x: index % width, y: Math.floor(index / width) };
    const barrel = battle.props.find((p) => p.propId === 'barrel') ?? battle.props[0];
    return { heap, prop: barrel ? { ...barrel.pos } : undefined };
  });
}

for (const [node, name] of NODES) {
  test(`${name} props and ink`, async ({ page }, info) => {
    test.setTimeout(240_000);
    const folder = `${FOLDER}/${info.project.name}`;
    mkdirSync(folder, { recursive: true });
    const renderer = info.project.name.endsWith('webgl') ? 'webgl' : 'canvas';
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Sura', 'Riko', 'Kaya'], ['sura', 'riko', 'kaya'], 'quarry-props', {
      reduceMotion: false,
    });
    await enterNode(page, node);
    await takeTurn(page);
    await waitForIdle(page);
    await settleLayout(page);
    await page.screenshot({ path: `${folder}/${name}-fit.png` });
    const { heap, prop } = await targets(page);
    await zoom(page, 96);
    for (const [label, cell] of [
      ['heap', heap],
      ['prop', prop],
    ] as const) {
      if (!cell) continue;
      await centerTile(page, cell.x, cell.y);
      await page.locator('.map-canvas').screenshot({ path: `${folder}/${name}-${label}-96.png` });
    }
  });
}
