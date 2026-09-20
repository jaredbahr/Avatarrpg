import { expect, test } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import { average, screenshotPixels } from './pixels';

/**
 * The sheet path, end to end, on both backends.
 *
 * Every unit already draws through the sheet runtime: a painter's poses baked
 * into an atlas of the real shape. The probe atlas under `public/art/test`
 * is a *loaded* one, five flat-colour frames, so this is the check that a
 * real file fetched from the site, parsed and uploaded lands on screen where
 * the unit stands, at the size the contract says, on the Canvas 2D path and
 * the WebGL one alike. It reads the pixel at the frame's centre: red or
 * green, the two idle poses, depending on the breath the clock is on.
 */
test.describe('unit sheets', () => {
  for (const renderer of ['canvas', 'webgl'] as const) {
    test(`draws a loaded atlas frame on the unit's tile on ${renderer}`, async ({ page }) => {
      test.setTimeout(120_000);
      allowSoftwareWebgl(test, renderer);

      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));

      await resetStorage(page, `?renderer=${renderer}`);
      await startGame(page, ['Elias'], ['kaya'], 'sheets-spec');
      await enterNode(page, 'battle_forest_road');
      await takeTurn(page);
      await waitForIdle(page);
      await settleLayout(page);
      expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(renderer);

      // Point the acting unit at the probe sheet, exactly as a manifest edit would.
      const pos = await page.evaluate(() => {
        const app = window.fnt?.app;
        const state = app?.state;
        const battle = state?.battle;
        if (!app || !state || !battle) return null;
        const actor = battle.units.find((u) => u.id === battle.order[battle.turnIndex]);
        if (!actor) return null;
        const units = battle.units.map((u) =>
          u.id === actor.id ? { ...u, sprite: 'unit.test.probe' } : u,
        );
        app.state = { ...state, battle: { ...battle, units } };
        app.resync();
        return actor.pos;
      });
      expect(pos, 'no acting unit to re-skin').not.toBeNull();
      if (!pos) return;

      // A 1.5-tile frame anchored 85% down the tile has its centre 0.325 tiles
      // below the tile's top edge.
      const centre = await page.evaluate((p) => {
        const camera = window.fnt?.app.rendererCamera?.();
        if (!camera) return null;
        const m = camera.groundTransform;
        const x = (p.x + 0.5) * 64,
          y = (p.y + 0.5) * 64;
        // Frame sample is upright: lift vertically from the projected foot.
        const lift = camera.projection === 'oblique' ? 0.86 - 0.325 : 0.5 - 0.325;
        return {
          x: m.a * x + m.c * y + m.tx,
          y: m.b * x + m.d * y + m.ty - camera.tilePx * lift,
        };
      }, pos);
      expect(centre).not.toBeNull();
      if (!centre) return;

      const isProbe = (c: { r: number; g: number; b: number }): boolean =>
        (c.r > 150 && c.g < 120 && c.b < 120) || (c.g > 130 && c.r < 120 && c.b < 130);

      // The atlas loads over the network; poll until the probe colour is there.
      await expect
        .poll(
          async () => {
            const pixels = await screenshotPixels(page.locator('.map-canvas'));
            return isProbe(average(pixels, centre.x, centre.y, 2));
          },
          { timeout: 30_000, message: 'the probe frame never appeared on the unit' },
        )
        .toBe(true);

      expect(errors.filter((text) => !/favicon/i.test(text))).toEqual([]);
    });
  }
});
