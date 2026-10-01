import { expect, test } from '@playwright/test';
import { allowSoftwareWebgl, SOFTWARE_WEBGL_BUDGET_MS } from './budget';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import { tileCentre } from './gallery/stage';

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`presents cloud veil and scheduled weather on ${renderer}`, async ({ page }) => {
    test.setTimeout(renderer === 'webgl' ? 90_000 : 30_000);
    allowSoftwareWebgl(test, renderer);
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Cloud reader'], ['kaya'], `obscurement-${renderer}`);
    await enterNode(page, 'battle_forest_road');
    await takeTurn(page);
    await waitForIdle(page);

    await page.evaluate(() => {
      const app = window.fnt?.app;
      const state = app?.state;
      const battle = state?.battle;
      const encounter = battle && app?.content.encounters.get(battle.encounterId);
      if (!app || !state || !battle || !encounter) throw new Error('Missing weather fixture.');
      const tiles = battle.grid.tiles.map((tile, index) =>
        index === battle.grid.width + 1
          ? { ...tile, surface: { id: 'steam' as const, duration: 3, spread: 0 } }
          : tile,
      );
      Object.assign(encounter, {
        weather: { id: 'sandstorm', schedule: [{ fromRound: 1, intensity: 2 }] },
      });
      app.state = {
        ...state,
        battle: { ...battle, round: 1, grid: { ...battle.grid, tiles } },
      };
      app.resync();
    });
    await settleLayout(page);

    await expect(page.locator('.weather-chip-full')).toHaveText('Sandstorm · long shots −10/tile');
    await expect(page.locator('.weather-chip-full')).toBeVisible();
    await expect(page.locator('.weather-chip-short')).toBeHidden();

    const original = page.viewportSize();
    await page.setViewportSize({ width: 390, height: 844 });
    await settleLayout(page);
    await expect(page.locator('.weather-chip-short')).toHaveText('Sand: long shots −10/tile');
    await expect(page.locator('.weather-chip-short')).toBeVisible();
    await expect(page.locator('.weather-chip-full')).toBeHidden();
    // Back to the project viewport: on a phone Log lives in the More drawer.
    if (original) await page.setViewportSize(original);
    await settleLayout(page);
    const read = () =>
      page.evaluate(() => {
        const scene = (
          window.fnt?.app as unknown as {
            scene?: {
              renderer?: {
                lastView?: { obscuringTiles?: unknown[]; weatherIntensity?: number };
              };
            };
          }
        )?.scene;
        return scene?.renderer?.lastView ?? null;
      });
    await expect
      .poll(read, { timeout: renderer === 'webgl' ? SOFTWARE_WEBGL_BUDGET_MS : 30_000 })
      .toMatchObject({ obscuringTiles: [{ x: 1, y: 1 }], weatherIntensity: 2 });

    // Keep the real action path but pin the tuning band to zero, so this is a
    // guaranteed miss without replacing the reducer's seeded RNG or formatter.
    await page.evaluate(() => {
      const app = window.fnt?.app;
      const state = app?.state;
      const battle = state?.battle;
      const hero = battle?.units.find((unit) => unit.faction === 'party');
      const enemy = battle?.units.find((unit) => unit.faction === 'enemy');
      if (!app || !state || !battle || !hero || !enemy) throw new Error('Missing miss fixture.');
      Object.assign(app.content.tuning, { hitChanceMin: 0, hitChanceMax: 0 });
      app.state = {
        ...state,
        battle: {
          ...battle,
          units: battle.units.map((unit) =>
            unit.id === hero.id
              ? { ...unit, pos: { x: 2, y: 2 }, ap: Math.max(2, unit.ap) }
              : unit.id === enemy.id
                ? { ...unit, pos: { x: 4, y: 2 } }
                : unit,
          ),
          turnIndex: battle.order.indexOf(hero.id),
        },
      };
      app.resync();
    });
    // The resync moved both units and the ability bar reflows the board: let the
    // camera hold still before a tile is mapped to the screen, or the tap lands
    // a tile off and Confirm never enables.
    await settleLayout(page);
    await page.getByRole('button', { name: /^Fire Jab/ }).click();
    await settleLayout(page);
    const point = await tileCentre(page, { x: 4, y: 2 });
    const canvas = page.locator('.map-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('No combat canvas.');
    await canvas.tap({ position: { x: point.x - box.x, y: point.y - box.y } });
    await page.getByRole('button', { name: /^Confirm/ }).click();
    await waitForIdle(page);
    await page.getByRole('button', { name: /^Log$/ }).click();
    await expect(page.locator('.log-lines')).toContainText('The sand takes it.');
  });
}
