import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, startGame, takeTurn } from './helpers';
import { tileCentre } from './gallery/stage';

async function tapCombatTile(page: Page, pos: { x: number; y: number }) {
  const canvas = page.locator('.map-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('The combat board is not visible.');
  const point = await tileCentre(page, pos);
  await canvas.tap({ position: { x: point.x - box.x, y: point.y - box.y } });
}

test('a new game gets the Forest Road guide, and Skip closes it', async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Table'], ['kaya'], 'combat-guidance-new-game');
  await enterNode(page, 'battle_forest_road');
  await takeTurn(page);

  await expect(page.getByText('Choose Move, then tap a highlighted tile.')).toBeVisible();

  // Put the live actors on a clear patch to make the touch sequence repeatable.
  // Every asserted move, aim, attack and end turn below still uses the real HUD,
  // canvas pointer path and reducer command.
  const tiles = await page.evaluate(() => {
    const app = window.fnt!.app;
    const state = app.state!;
    const battle = state.battle!;
    const actor = battle.units.find(
      (unit) => unit.faction === 'party' && unit.characterId === 'kaya',
    );
    const target = battle.units.find((unit) => unit.faction === 'enemy');
    if (!actor || !target) throw new Error('Kaya and a Road ambusher are required.');
    const x = Math.max(1, Math.floor(battle.grid.width / 2) - 3);
    const y = Math.max(1, Math.floor(battle.grid.height / 2));
    const floor = battle.grid.tiles.map((tile, index) => {
      const tx = index % battle.grid.width;
      const ty = Math.floor(index / battle.grid.width);
      return tx >= x && tx <= x + 5 && ty >= y - 1 && ty <= y + 1
        ? {
            ...tile,
            terrain: 'grass' as const,
            blocked: false,
            blocksSight: false,
            cover: false,
            elevation: 0,
            surface: null,
          }
        : tile;
    });
    app.state = {
      ...state,
      battle: {
        ...battle,
        grid: { ...battle.grid, tiles: floor },
        turnIndex: battle.order.indexOf(actor.id),
        units: battle.units.map((unit) =>
          unit.id === actor.id
            ? { ...unit, pos: { x, y }, move: 2, ap: 3 }
            : unit.id === target.id
              ? { ...unit, pos: { x: x + 2, y }, hp: 80 }
              : { ...unit, hp: 0 },
        ),
      },
    };
    app.resync();
    return { move: { x: x + 1, y }, enemy: { x: x + 2, y } };
  });

  await page.getByRole('button', { name: /^Move/ }).click();
  await tapCombatTile(page, tiles.move);
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('Choose an ability, then tap an enemy.')).toBeVisible();

  await page.getByRole('button', { name: /^Fire Jab/ }).click();
  await tapCombatTile(page, tiles.enemy);
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText("When you're done, End turn.")).toBeVisible();

  await page.getByRole('button', { name: /^End turn/ }).click();
  await expect(page.getByText('Tap End turn again to finish anyway.')).toBeVisible();
  await page.getByRole('button', { name: /^End turn/ }).click();
  await expect(page.getByText('The strip above shows whose turn comes next.')).toBeVisible();
  await expect(page.locator('.turn-strip')).toHaveClass(/guidance-target/);
  await page.getByRole('button', { name: 'Skip guidance', exact: true }).click();
  await expect(page.locator('.combat-guidance')).toHaveCount(0);
  expect(
    await page.evaluate(() => window.fnt!.app.state!.flags['guidance.firstFightStage']),
  ).toBe('done');
});

test('a loaded game past the Forest Road has no first-fight coach mark', async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Table'], ['kaya'], 'combat-guidance-past-forest');
  await enterNode(page, 'battle_quarry_gate');
  await page.evaluate(() => {
    const app = window.fnt!.app;
    app.adoptSave(app.state!, app.session.toMeta());
  });
  await expect(page.locator('.combat-guidance')).toHaveCount(0);
});
