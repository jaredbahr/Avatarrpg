import { paintedTileCentre } from './projection';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
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
 * A raised tile is drawn lifted a quarter tile a tier (ADR 0065), so the top of
 * its lifted diamond lies over the flat cell up and to the left of it. Pointing
 * there must still act on the raised tile, on both backends, for the hover
 * highlight and for a Move tap alike: the pick follows the lift, not the grid.
 */
for (const renderer of ['canvas', 'webgl'] as const) {
  test(`a raised tile's lifted top picks that tile on ${renderer}`, async ({ page }) => {
    allowSoftwareWebgl(test, renderer);
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Solo'], ['kaya'], 'raised-picking');
    await enterNode(page, 'battle_grumbler');
    await expect(page.locator('.action-bar')).toBeVisible();
    await takeTurn(page);
    await waitForIdle(page);
    await settleLayout(page);
    expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(renderer);

    // The Driller floor's ramp benches and gantry perches: find one whose
    // lifted top is on the canvas and not under the HUD.
    const findAim = () =>
      page.evaluate(() => {
        const app = window.fnt?.app;
        const camera = app?.rendererCamera();
        const grid = app?.state?.battle?.grid;
        const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
        if (!camera || !grid || !canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const m = camera.groundTransform;
        for (const cell of [
          { x: 8, y: 10 },
          { x: 5, y: 10 },
          { x: 12, y: 10 },
          { x: 8, y: 1 },
          { x: 5, y: 1 },
          { x: 2, y: 10 },
          { x: 17, y: 10 },
        ]) {
          const tile = grid.tiles[cell.y * grid.width + cell.x];
          if (!tile || tile.blocked || tile.elevation < 1) continue;
          // Near the far corner of the lifted top: a quarter tile a tier up the screen.
          const gx = (cell.x + 0.15) * 64;
          const gy = (cell.y + 0.15) * 64;
          const x = rect.left + m.a * gx + m.c * gy + m.tx;
          const y = rect.top + m.b * gx + m.d * gy + m.ty - camera.tilePx * 0.25 * tile.elevation;
          if (
            x < rect.left + 20 ||
            x > rect.right - 20 ||
            y < rect.top + 20 ||
            y > rect.bottom - 20
          )
            continue;
          if (document.elementFromPoint(x, y) !== canvas) continue;
          return { cell, x, y };
        }
        return null;
      });
    const aim = await findAim();
    expect(aim, 'no raised tile on screen').not.toBeNull();
    if (!aim) return;
    type Picks = {
      hover: { x: number; y: number } | null;
      pending: { x: number; y: number } | null;
    };
    const picks = () =>
      page.evaluate(() => {
        const scene = (window.fnt?.app as unknown as { scene: Picks }).scene;
        return { hover: scene.hover, pending: scene.pending };
      });

    await page.mouse.move(aim.x, aim.y);
    await expect.poll(async () => (await picks()).hover).toEqual(aim.cell);

    await page.getByRole('button', { name: /^Move/ }).click();
    // Move reflows the HUD, so recompute the raised top after the camera settles.
    await settleLayout(page);
    const settledAim = await findAim();
    expect(settledAim?.cell, 'the settled point changed tiles').toEqual(aim.cell);
    expect(settledAim, 'could not relocate the raised tile after Move').not.toBeNull();
    if (!settledAim) return;
    await page.mouse.move(settledAim.x, settledAim.y);
    await expect.poll(async () => (await picks()).hover).toEqual(aim.cell);
    await page.mouse.click(settledAim.x, settledAim.y);
    await expect.poll(async () => (await picks()).pending).toEqual(aim.cell);
  });
}

/**
 * Independent of groundTransform and camera.project: these clicks use the
 * approved 2:1 diamond basis itself. Clicks do not follow a faulty exposed
 * affine back to the same wrong tile. Off-centre samples cover both diamond edges.
 */
for (const renderer of ['canvas', 'webgl'] as const) {
  test(`oblique village picks the expected diamond on ${renderer}`, async ({ page }) => {
    test.setTimeout(120_000);
    allowSoftwareWebgl(test, renderer);
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
