/**
 * Local whole-route visual review.
 *
 * Walks the shipped story nodes that make up the village → quarry → return
 * slice and captures each one on both backends at the two camera scales the
 * game actually uses. These are review fixtures for comparing the running game
 * with the approved player-view references; they are not a playthrough, an
 * accessibility signoff or a substitute for listening.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';

interface View {
  name: string;
  node: string;
  camera: unknown;
}

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
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + box.width / 2 - point.x, start.y + box.height / 2 - point.y, {
    steps: 6,
  });
  await page.mouse.up();
  await settleLayout(page);
}

async function partyTile(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const members = window.fnt!.app.state!.party;
    const first = members[0]!;
    return { x: first.pos.x, y: first.pos.y };
  });
}

const EXPLORATION = [
  'village_explore',
  'forest_explore',
  'quarry_descent',
  'quarry_assessment',
  'quarry_after_explore',
  'cutting_return_explore',
  'gate_return_explore',
  'forest_return_explore',
  'village_return_explore',
] as const;

const COMBAT = [
  'battle_forest_road',
  'battle_quarry_gate',
  'battle_ambush',
  'battle_grumbler',
] as const;

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`${renderer} whole-route framing`, async ({ page }) => {
    test.setTimeout(600_000);
    const revision = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
    const modified = execFileSync('git', ['diff', 'HEAD', '--name-only'], {
      encoding: 'utf8',
    }).trim();
    const build = `${revision}${modified ? '-modified' : ''}`;
    const folder = `${process.env.FNT_ROUTE_REVIEW_DIR ?? '.shots/route-review'}/${renderer}`;
    mkdirSync(folder, { recursive: true });
    const errors: string[] = [];
    const views: View[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await resetStorage(page, `?renderer=${renderer}`);
    await expect(page.locator('[aria-label^="Game version"]')).toHaveText(
      new RegExp(`build ${build}$`),
    );
    await startGame(page, ['Sura', 'Riko', 'Kaya'], ['sura', 'riko', 'kaya'], 'route-review', {
      reduceMotion: false,
    });
    // FNT_ROUTE_REVIEW_TEXT=huge reviews the same route at the largest type size.
    if (process.env.FNT_ROUTE_REVIEW_TEXT === 'huge') {
      await page.evaluate(() => window.fnt!.app.updateSettings({ largeText: 'huge' }));
    }

    for (const node of EXPLORATION) {
      await enterNode(page, node);
      await waitForIdle(page);
      const screen = await page.evaluate(() => window.fnt!.app.state!.screen);
      expect(await page.evaluate(() => window.fnt!.app.state!.story.nodeId)).toBe(node);
      await settleLayout(page);
      await page.screenshot({ path: `${folder}/${node}-entered-${screen}.png` });
      if (screen !== 'explore') continue;
      const tile = await partyTile(page);
      for (const size of [64, 96]) {
        const name = `${node}-${size}`;
        await page.screenshot({ path: `${folder}/${name}-wide.png` });
        views.push({
          name,
          node,
          camera: await page.evaluate(() => window.fnt!.app.rendererCamera()),
        });
        await zoom(page, size);
        await centerTile(page, tile.x, tile.y);
        await page.screenshot({ path: `${folder}/${name}.png` });
      }
    }

    for (const node of COMBAT) {
      await enterNode(page, node);
      await takeTurn(page);
      await waitForIdle(page);
      const screen = await page.evaluate(() => window.fnt!.app.state!.screen);
      if (screen !== 'combat') {
        await page.screenshot({ path: `${folder}/${node}-entered-${screen}.png` });
        continue;
      }
      await settleLayout(page);
      const name = `${node}-fit`;
      await page.screenshot({ path: `${folder}/${name}.png` });
      views.push({
        name,
        node,
        camera: await page.evaluate(() => window.fnt!.app.rendererCamera()),
      });
      await zoom(page, 64);
      await page.screenshot({ path: `${folder}/${node}-64.png` });
    }

    expect(errors).toEqual([]);
    writeFileSync(
      `${folder}/provenance.json`,
      JSON.stringify(
        {
          revision,
          build,
          renderer,
          views,
          errors,
          setup:
            'Seeded newGame (Sura/Riko/Kaya, route-review) and direct enterNode jumps; camera moved with a real wheel zoom and pointer drag. Review fixtures only — not a playthrough, listening test or physical-device check.',
        },
        null,
        2,
      ),
    );
  });
}
