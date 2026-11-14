import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, startGame, takeTurn, waitForIdle } from './helpers';
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
  expect(await page.evaluate(() => window.fnt!.app.state!.flags['guidance.firstFightStage'])).toBe(
    'done',
  );
});

test('the guide points at End turn while no enemy is in reach (#697)', async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['A', 'B', 'C'], ['kaya', 'sura', 'bo'], 'combat-guidance-reach');
  await enterNode(page, 'battle_forest_road');
  await takeTurn(page);
  await expect(page.getByText('Choose Move, then tap a highlighted tile.')).toBeVisible();

  // The real opening, untouched: the bandits wait at the far end of the road.
  const kaya = await page.evaluate(() => {
    const battle = window.fnt!.app.state!.battle!;
    const unit = battle.units.find((u) => u.id === battle.order[battle.turnIndex])!;
    return { id: unit.id, pos: unit.pos };
  });
  const step = { x: kaya.pos.x + 2, y: kaya.pos.y };
  await page.getByRole('button', { name: /^Move/ }).click();
  await tapCombatTile(page, step);
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await waitForIdle(page);
  expect(
    await page.evaluate(
      (id) => window.fnt!.app.state!.battle!.units.find((u) => u.id === id)!.pos,
      kaya.id,
    ),
  ).toEqual(step);

  const cue = 'No enemy is in reach yet. Move closer, or End turn.';
  await expect(page.getByText(cue)).toBeVisible();
  await expect(page.getByText('Choose an ability, then tap an enemy.')).toHaveCount(0);
  // Clear of the fence, Kaya can still walk on east with the move she has left.
  await page.getByRole('button', { name: /^Move/ }).click();
  await tapCombatTile(page, { x: step.x + 2, y: step.y });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: /^Move/ }).click();
  await expect(page.getByText(cue)).toBeVisible();
  await expect(page.locator('.action-button.end-turn')).toHaveClass(/guidance-target/);

  // One tap ends the turn: the guide asked for it, so there is no spare-AP nudge.
  await page.getByRole('button', { name: /^End turn/ }).click();
  await expect(page.getByText('Tap End turn again to finish anyway.')).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const battle = window.fnt!.app.state!.battle!;
        return battle.order[battle.turnIndex];
      }),
    )
    .not.toBe(kaya.id);

  // The next hero gets the same honest cue, and the guide still waits for a hit.
  expect(await takeTurn(page)).toBe(true);
  await expect(page.getByText(cue)).toBeVisible();
  expect(await page.evaluate(() => window.fnt!.app.state!.flags['guidance.firstFightStage'])).toBe(
    1,
  );
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
