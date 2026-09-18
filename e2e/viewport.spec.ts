import { paintedTileCentre } from './projection';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';

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
    // Readable oblique combat deliberately pans. Bring this enemy into view
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
 * Independent of groundTransform and camera.project: these clicks use the
 * approved 2:1 diamond basis itself. Clicks do not follow a faulty exposed
 * affine back to the same wrong tile. Off-centre samples cover both diamond edges.
 */
for (const renderer of ['canvas', 'webgl'] as const) {
  test(`oblique village picks the expected diamond on ${renderer}`, async ({
    page,
    browserName,
  }) => {
    test.setTimeout(120_000);
    if (renderer === 'webgl' && browserName === 'webkit') test.slow();
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Explorer'], ['kaya'], 'oblique-picking');
    await enterNode(page, 'village_explore');
    await settleLayout(page);
    expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(renderer);

    for (const target of [
      { x: 4, y: 7, fx: 0.15, fy: 0.8 },
      { x: 5, y: 7, fx: 0.85, fy: 0.2 },
      { x: 6, y: 7, fx: 0.5, fy: 0.5 },
    ]) {
      if (target.x === 6) {
        await page.setViewportSize({ width: 834, height: 1194 });
        await settleLayout(page);
      }
      const view = await page.evaluate(() => {
        const app = window.fnt?.app;
        const camera = app?.rendererCamera();
        const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
        const map = app?.content.maps.get('ba_dan_village');
        if (!camera || !canvas || !map) throw new Error('No village view');
        const rect = canvas.getBoundingClientRect();
        return {
          camera,
          height: map.height,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          stretchX: rect.width / (canvas.width / devicePixelRatio),
          stretchY: rect.height / (canvas.height / devicePixelRatio),
        };
      });
      expect(view.camera.projection).toBe('oblique');
      expect(view.height).toBe(16);
      expect(view.stretchX).toBeCloseTo(1, 2);
      expect(view.stretchY).toBeCloseTo(1, 2);
      const tile = view.camera.tilePx;
      const m = view.camera.groundTransform;
      expect(m.a).toBeCloseTo(tile / 64, 8);
      expect(m.b).toBeCloseTo(tile / 128, 8);
      expect(m.c).toBeCloseTo(-tile / 64, 8);
      expect(m.d).toBeCloseTo(tile / 128, 8);
      expect(m.tx).toBeCloseTo(16 * tile - view.camera.offsetX, 6);
      expect(m.ty).toBeCloseTo(-view.camera.offsetY, 6);
      // Known basis, deliberately not the affine under test.
      const px = (16 + target.x + target.fx - target.y - target.fy) * tile - view.camera.offsetX;
      const py = ((target.x + target.fx + target.y + target.fy) * tile) / 2 - view.camera.offsetY;
      expect(px).toBeGreaterThan(0);
      expect(px).toBeLessThan(view.rect.width);
      expect(py).toBeGreaterThan(0);
      expect(py).toBeLessThan(view.rect.height);
      await page.mouse.click(view.rect.x + px * view.stretchX, view.rect.y + py * view.stretchY);
      await waitForIdle(page);
      expect(await page.evaluate(() => window.fnt?.app.state?.location.pos)).toEqual({
        x: target.x,
        y: target.y,
      });
    }
  });
}
