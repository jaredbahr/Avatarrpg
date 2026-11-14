import { paintedTileCentre } from './projection';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Vec2 } from '../src/core/types';
import {
  enterNode,
  resetStorage,
  settleLayout,
  settleMapCanvas,
  startGame,
  takeTurn,
  waitForIdle,
} from './helpers';

/**
 * The camera has to measure the box the map actually got.
 *
 * The canvas is `100%` of a flexed wrapper, so its height is whatever the turn
 * strip and the HUD leave it — and both of those fill in *after* the scene
 * mounts. A camera measured once at mount is stale, and because the backing
 * store is sized from the same measurement the browser then scales the frame to
 * fit: 830 backing pixels squashed into 622 CSS ones, the last time this broke.
 * Everything the renderer computed from a pointer coordinate was drawn
 * somewhere else, further off the further down the map you went. The hover
 * highlight sat a tile or two above the cursor.
 *
 * The rest of the suite could not catch it, because it maps tile -> pixel
 * through the same camera numbers the tap handler reads: both were wrong in the
 * same direction, so the taps landed. These tests compare the camera against
 * the canvas element instead, and tap where a tile is *painted*.
 */

/** How the canvas is scaled from its backing store to its CSS box. */
async function backingStoreStretch(page: Page): Promise<{ x: number; y: number }> {
  const stretch = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return { x: rect.width / (canvas.width / dpr), y: rect.height / (canvas.height / dpr) };
  });
  expect(stretch, 'no map canvas on screen').not.toBeNull();
  return stretch ?? { x: 0, y: 0 };
}

test.describe('map viewport', () => {
  test('the canvas is never scaled away from its own box', async ({ page }) => {
    await resetStorage(page);
    await startGame(page, ['Solo'], ['kaya'], 'viewport-spec');

    // Explore first: the objective banner above the map sizes itself from text.
    await enterNode(page, 'village_explore');
    await expect(page.locator('.map-canvas')).toBeVisible();
    // Automatic WebGL selection mounts the element before its async backend.
    await page.waitForFunction(() => Boolean(window.fnt?.app.rendererCamera()));
    await settleLayout(page);
    const explore = await backingStoreStretch(page);
    expect(explore.x).toBeCloseTo(1, 2);
    expect(explore.y).toBeCloseTo(1, 2);

    await enterNode(page, 'battle_forest_road');
    await expect(page.locator('.action-bar')).toBeVisible();
    await waitForIdle(page);

    // The turn strip and the HUD are now populated; this is the measurement
    // that used to be two hundred pixels out.
    const combat = await backingStoreStretch(page);
    expect(combat.x).toBeCloseTo(1, 2);
    expect(combat.y).toBeCloseTo(1, 2);

    // The log panel is the HUD growing again, long after mount.
    await page.getByRole('button', { name: /^Log$/ }).click();
    await expect(page.locator('.log-panel')).toBeVisible();
    await settleLayout(page);
    const withLog = await backingStoreStretch(page);
    expect(withLog.x).toBeCloseTo(1, 2);
    expect(withLog.y).toBeCloseTo(1, 2);
  });

  test('tapping where a tile is painted acts on that tile', async ({ page }) => {
    await resetStorage(page);
    // Solo play, so there is no hand-off card between us and the battlefield.
    await startGame(page, ['Solo'], ['kaya'], 'viewport-tap');
    await enterNode(page, 'battle_forest_road');
    await expect(page.locator('.action-bar')).toBeVisible();
    await takeTurn(page);
    await waitForIdle(page);

    // The lowest enemy on the map: the stretch error grew with y, so this is
    // where a stale camera misses by more than half a tile.
    const target = await page.evaluate(() => {
      const battle = window.fnt?.app.state?.battle;
      const enemy = (battle?.units ?? [])
        .filter((u) => u.faction === 'enemy' && u.hp > 0 && u.size === 1)
        .sort((a, b) => b.pos.y - a.pos.y)[0];
      return enemy ? { name: enemy.name, pos: enemy.pos } : null;
    });

    expect(target, 'no single-tile enemy to tap').not.toBeNull();
    if (!target) return;
    // Top-down combat pans at a readable zoom. Bring this enemy into view
    // before testing the independent painted-pixel to tile conversion.
    await page
      .getByRole('button', { name: `Focus ${target.name}`, exact: true })
      .first()
      .click();

    // Where that tile is *painted*, which is the camera's own geometry put
    // through whatever scaling the element is applying to the backing store.
    const point = await paintedTileCentre(page, target.pos);

    expect(point, 'could not locate the painted tile').not.toBeNull();
    if (!point) return;

    // A tap on a unit in idle mode inspects it — an observable way to ask the
    // game which tile it thinks the finger landed on.
    await page.mouse.click(point.x, point.y);
    await expect(page.getByRole('dialog', { name: target.name })).toBeVisible();
  });
});

/**
 * The top-down board (ADR 0104) scrolls and draws at integer zoom, and its HUD reflows on most
 * taps: Move adds the aim hint, a pending tile adds the confirm bar (whose height follows its text),
 * and the log panel takes a slab of the screen. After each reflow the camera must again be measured
 * from the canvas element, so the hover highlight and a Move tap land on the tile painted under the
 * pointer. The probe is the lowest whole row on the canvas, where a stale height misses by most.
 */
test('the top-down camera follows the canvas through HUD reflows', async ({ page }) => {
  await resetStorage(page);
  await startGame(page, ['Solo'], ['kaya'], 'viewport-topdown-reflow');
  await enterNode(page, 'battle_forest_road');
  await expect(page.locator('.action-bar')).toBeVisible();
  expect(await takeTurn(page)).toBe(true);
  await waitForIdle(page);
  expect(await page.evaluate(() => window.fnt?.app.rendererCamera()?.projection)).toBe('topdown');

  type Picks = { hover: Vec2 | null; pending: Vec2 | null };
  const picks = () =>
    page.evaluate(() => {
      const scene = (window.fnt?.app as unknown as { scene: Picks }).scene;
      return { hover: scene.hover, pending: scene.pending };
    });

  /** The camera's viewport against the canvas box, and a clear cell in the lowest whole row. */
  const measure = () =>
    page.evaluate(() => {
      const app = window.fnt?.app;
      const scene = (
        app as unknown as {
          scene?: { renderer?: { camera: { viewport: { width: number; height: number } } } };
        }
      )?.scene;
      const camera = app?.rendererCamera();
      const battle = app?.state?.battle;
      const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
      const viewport = scene?.renderer?.camera.viewport;
      if (!camera || !battle || !canvas || !viewport) throw new Error('No top-down board mounted.');
      const rect = canvas.getBoundingClientRect();
      const m = camera.groundTransform;
      const t = camera.tile;
      const point = (x: number, y: number) => ({
        x: rect.left + m.a * x * t + m.c * y * t + m.tx,
        y: rect.top + m.b * x * t + m.d * y * t + m.ty,
      });
      const occupied = (x: number, y: number) =>
        battle.units.some(
          (u) => u.hp > 0 && Math.abs(u.pos.x - x) <= 1 && Math.abs(u.pos.y - y) <= 1,
        );
      for (let y = battle.grid.height - 1; y >= 0; y--) {
        const top = point(0, y).y;
        const bottom = point(0, y + 1).y;
        if (top < rect.top || bottom > rect.bottom) continue;
        // Right of centre, so the far side of the board is in the sample too.
        for (let x = Math.floor(battle.grid.width * 0.6); x < battle.grid.width; x++) {
          const centre = point(x + 0.5, y + 0.5);
          if (occupied(x, y) || centre.x > rect.right - camera.tilePx / 2) continue;
          if (document.elementFromPoint(centre.x, centre.y) !== canvas) continue;
          return {
            viewport: { width: viewport.width, height: viewport.height },
            box: { width: rect.width, height: rect.height },
            cell: { x, y },
          };
        }
      }
      return {
        viewport: { width: viewport.width, height: viewport.height },
        box: { width: rect.width, height: rect.height },
        cell: null,
      };
    });

  /** Settle, check the camera measured this box, then point at the painted cell. */
  const pointAtLowestRow = async (label: string, tap: boolean): Promise<Vec2> => {
    await settleMapCanvas(page);
    const seen = await measure();
    expect(seen.viewport.width, `${label}: camera width`).toBeCloseTo(seen.box.width, 0);
    expect(seen.viewport.height, `${label}: camera height`).toBeCloseTo(seen.box.height, 0);
    expect(seen.cell, `${label}: no clear cell in the lowest whole row`).not.toBeNull();
    const cell = seen.cell as Vec2;
    const point = await paintedTileCentre(page, cell);
    expect(point, `${label}: no painted centre`).not.toBeNull();
    if (!point) return cell;
    await page.mouse.move(point.x, point.y);
    await expect
      .poll(async () => (await picks()).hover, { message: `${label}: hover` })
      .toEqual(cell);
    if (tap) {
      await page.mouse.click(point.x, point.y);
      await expect
        .poll(async () => (await picks()).pending, { message: `${label}: tap` })
        .toEqual(cell);
    }
    return cell;
  };

  const opening = (await measure()).box.height;
  await pointAtLowestRow('the opening frame', false);

  // Move: the aim hint fills in under the board.
  await page.getByRole('button', { name: /^Move\b/ }).click();
  await pointAtLowestRow('after Move', true);

  // A pending tile adds the confirm bar; the next tap is measured through it.
  await expect(page.locator('.confirm-bar')).toBeVisible();
  await pointAtLowestRow('with the confirm bar', true);

  // The log panel is the HUD growing again, long after mount.
  await page.getByRole('button', { name: /^Log$/ }).click();
  await expect(page.locator('.log-panel')).toBeVisible();
  await pointAtLowestRow('with the log open', true);
  const withLog = (await measure()).box.height;
  expect(withLog, 'the log panel should take height from the map').toBeLessThan(opening);

  await page.getByRole('button', { name: /^Hide log$/ }).click();
  await expect(page.locator('.log-panel')).toBeHidden();
  await pointAtLowestRow('with the log hidden again', true);
});
