import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, startGame, takeTurn, waitForIdle } from './helpers';

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

    // Where that tile is *painted*, which is the camera's own geometry put
    // through whatever scaling the element is applying to the backing store.
    const point = await page.evaluate((pos) => {
      const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
      const camera = window.fnt?.app.rendererCamera();
      if (!canvas || !camera) return null;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const stretchX = rect.width / (canvas.width / dpr);
      const stretchY = rect.height / (canvas.height / dpr);
      const centre = camera.tilePx / 2;
      return {
        x: rect.left + (pos.x * camera.tilePx - camera.offsetX + centre) * stretchX,
        y: rect.top + (pos.y * camera.tilePx - camera.offsetY + centre) * stretchY,
      };
    }, target.pos);

    expect(point, 'could not locate the painted tile').not.toBeNull();
    if (!point) return;

    // A tap on a unit in idle mode inspects it — an observable way to ask the
    // game which tile it thinks the finger landed on.
    await page.mouse.click(point.x, point.y);
    await expect(page.getByRole('dialog', { name: target.name })).toBeVisible();
  });
});
