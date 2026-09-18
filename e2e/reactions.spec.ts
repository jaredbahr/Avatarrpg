import { paintedTileCentre } from './projection';
import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame, takeTurn, waitForIdle } from './helpers';

/**
 * The reaction system, as a player meets it.
 *
 * The unit tests prove the forecast agrees with the resolver. These prove the
 * answer actually reaches the screen: that the confirm step names the reaction
 * before you commit, and that a player who has forgotten the table can find it
 * without leaving the game.
 *
 * Expected strings are read out of the running content index rather than typed
 * here, so retuning a combo cannot leave this spec asserting a sentence the
 * game no longer says.
 */

test.describe('elemental reactions are legible', () => {
  test('the confirm step names the reaction before you commit', async ({ page }) => {
    await resetStorage(page);
    await startGame(page, ['Elias'], ['kaya'], 'reaction-spec');
    await enterNode(page, 'battle_forest_road');

    expect(await takeTurn(page)).toBe(true);
    await waitForIdle(page);

    /*
     * Both sides start twenty tiles apart and the point here is the preview,
     * not the walk, so stand a bandit on a patch of lamp oil within Fire Jab's
     * reach. Same surgery the other specs use to skip past what they are not
     * testing.
     */
    const placed = await page.evaluate(() => {
      const app = window.fnt?.app;
      const state = app?.state;
      const battle = state?.battle;
      if (!app || !state || !battle) return null;

      const actor = battle.units.find((u) => u.id === battle.order[battle.turnIndex]);
      if (!actor) return null;

      const index = (p: { x: number; y: number }) => p.y * battle.grid.width + p.x;
      const open = (p: { x: number; y: number }) => {
        if (p.x < 0 || p.y < 0 || p.x >= battle.grid.width || p.y >= battle.grid.height) {
          return false;
        }
        const tile = battle.grid.tiles[index(p)];
        return tile !== undefined && !tile.blocked;
      };

      // A tile three east of the actor, or three west if the map runs out.
      const spot = open({ x: actor.pos.x + 3, y: actor.pos.y })
        ? { x: actor.pos.x + 3, y: actor.pos.y }
        : { x: actor.pos.x - 3, y: actor.pos.y };
      if (!open(spot)) return null;

      const oil = { id: 'oil' as const, duration: -1, spread: 0 };
      const tiles = battle.grid.tiles.map((tile, i) =>
        i === index(spot) ? { ...tile, surface: oil } : tile,
      );

      const victim = battle.units.find((u) => u.faction === 'enemy' && u.hp > 0);
      if (!victim) return null;

      const units = battle.units.map((u) => (u.id === victim.id ? { ...u, pos: spot } : u));

      app.state = {
        ...state,
        battle: { ...battle, grid: { ...battle.grid, tiles }, units },
      };

      const rule = app.content.combos.find((c) => c.id === 'fire-into-oil');
      return { spot, actorId: actor.id, label: rule?.label ?? '' };
    });

    expect(placed, 'could not stage an oil tile in range').not.toBeNull();
    if (!placed) return;
    expect(placed.label).not.toBe('');

    const fireJab = page.getByRole('button', { name: /fire jab/i });
    await expect(fireJab).toBeVisible();
    await fireJab.click();

    const screenPoint = await paintedTileCentre(page, placed.spot);

    expect(screenPoint, 'could not map the oil tile to the screen').not.toBeNull();
    if (!screenPoint) return;

    await waitForIdle(page);
    await page.mouse.click(screenPoint.x, screenPoint.y);

    const confirmBar = page.locator('.confirm-bar').filter({ hasText: /Confirm/ });
    await expect(confirmBar).toBeVisible();

    // The whole point of the change: the ground gets a sentence, in the combo
    // table's own words, rather than a flat "Leaves Fire" that would have been
    // wrong here.
    const note = confirmBar.locator('.reaction-note').first();
    await expect(note).toBeVisible();
    await expect(note).toContainText(placed.label);
    // ...and it says the fire will not stay where you put it.
    await expect(note).toContainText(/spreads/i);
  });

  test('the reactions reference is reachable from the pause menu', async ({ page }) => {
    await resetStorage(page);
    await startGame(page, ['Elias'], ['kaya'], 'reference-spec');
    await enterNode(page, 'battle_forest_road');
    await waitForIdle(page);

    const expected = await page.evaluate(() => {
      const content = window.fnt?.app.content;
      const chain = content?.combos.find((c) => c.chainThroughExisting);
      return {
        chainLabel: chain?.label ?? '',
        ruleCount: content?.combos.length ?? 0,
      };
    });

    expect(expected.ruleCount).toBeGreaterThan(0);

    await page
      .getByRole('button', { name: /pause|menu/i })
      .first()
      .click();
    await page.getByRole('button', { name: /how the elements react/i }).click();

    // By role and label, because the pause menu behind it carries the same
    // words on the button that opened this.
    const dialog = page.getByRole('dialog', { name: 'How the elements react' });
    await expect(dialog).toBeVisible();

    // Every rule in the table gets a row, so the sheet cannot quietly omit one.
    await expect(dialog.locator('.reaction-row')).toHaveCount(
      expected.ruleCount + (await page.evaluate(() => window.fnt?.app.content.surfaces.size ?? 0)),
    );

    // Lightning through water is the lesson worth finding first.
    await expect(dialog).toContainText(expected.chainLabel);
  });
});
