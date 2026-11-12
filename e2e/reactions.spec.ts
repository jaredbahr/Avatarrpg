import { paintedTileCentre } from './projection';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import {
  enterNode,
  resetStorage,
  settleMapCanvas,
  startGame,
  takeTurn,
  waitForIdle,
} from './helpers';

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

type Staged = { spot: { x: number; y: number }; actorId: string; label: string };

/**
 * Both sides start twenty tiles apart and the point here is the preview, not
 * the walk, so stand a bandit on a patch of lamp oil within Fire Jab's reach.
 * Same surgery the other specs use to skip past what they are not testing.
 */
function stageOil(page: Page): Promise<Staged | null> {
  return page.evaluate(() => {
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

    // A tile three out from the actor, east first, then west, then the
    // diagonals: a roadside prop or the map edge can close the straight-line
    // cells, and a prop's cell is blocked ground a bandit cannot stand on.
    const offsets = [
      [3, 0],
      [-3, 0],
      [2, 1],
      [2, -1],
      [-2, 1],
      [-2, -1],
      [1, 2],
      [1, -2],
      [-1, 2],
      [-1, -2],
      [0, 3],
      [0, -3],
    ] as const;
    const spot = offsets
      .map(([dx, dy]) => ({ x: actor.pos.x + dx, y: actor.pos.y + dy }))
      .find(
        (p) => open(p) && !battle.units.some((u) => u.hp > 0 && u.pos.x === p.x && u.pos.y === p.y),
      );
    if (!spot) return null;

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
}

/** Aims Fire Jab at the staged oil and returns the confirm bar it opens. */
async function aimAtOil(page: Page, placed: Staged): Promise<Locator> {
  const fireJab = page.getByRole('button', { name: /fire jab/i });
  await expect(fireJab).toBeVisible();
  await fireJab.click();
  // Selecting the ability adds the aim hint to the toolbar, which changes the
  // map's height and moves the camera's fit. Project the tile only once that
  // has landed, or the tap reads "Nobody there." on the tile next door.
  await settleMapCanvas(page);
  const screenPoint = await paintedTileCentre(page, placed.spot);
  expect(screenPoint, 'could not map the oil tile to the screen').not.toBeNull();
  await waitForIdle(page);
  if (screenPoint) await page.mouse.click(screenPoint.x, screenPoint.y);
  const confirmBar = page.locator('.confirm-bar').filter({ hasText: /Confirm/ });
  await expect(confirmBar).toBeVisible();
  return confirmBar;
}

test.describe('elemental reactions are legible', () => {
  test('the confirm step hints at a new combo, then names it once it has happened (#622)', async ({
    page,
  }) => {
    await resetStorage(page);
    await startGame(page, ['Elias'], ['kaya'], 'reaction-spec');
    await enterNode(page, 'battle_forest_road');

    expect(await takeTurn(page)).toBe(true);
    await waitForIdle(page);

    const placed = await stageOil(page);
    expect(placed, 'could not stage an oil tile in range').not.toBeNull();
    if (!placed) return;
    expect(placed.label).not.toBe('');

    // Before anyone has seen fire meet oil, the forecast only hints.
    const hinted = await aimAtOil(page, placed);
    const hint = hinted.locator('.reaction-hint').first();
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('Something here reacts to fire.');
    await expect(hinted).not.toContainText(placed.label);

    // Seeing it happen discovers it, with a caption once the hit has played.
    await hinted.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(
      page.locator('.toast').filter({ hasText: 'New combo found: Fire + Oil!' }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.fnt?.app.state?.discoveredCombos)).toContain(
      'fire-into-oil',
    );

    // The discovery belongs to the save: it is still found after a reload.
    expect(await page.evaluate(() => window.fnt?.app.saveTo('auto'))).toBe(true);
    await page.reload();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    expect(await takeTurn(page)).toBe(true);
    await waitForIdle(page);
    expect(await page.evaluate(() => window.fnt?.app.state?.discoveredCombos)).toContain(
      'fire-into-oil',
    );

    // The whole point of the change: the ground gets a sentence, in the combo
    // table's own words, rather than a flat "Leaves Fire" that would have been
    // wrong here.
    const again = await stageOil(page);
    expect(again, 'could not stage a second oil tile in range').not.toBeNull();
    if (!again) return;
    const named = await aimAtOil(page, again);
    await expect(named.locator('.reaction-hint')).toHaveCount(0);
    const note = named.locator('.reaction-note').first();
    await expect(note).toBeVisible();
    await expect(note).toContainText(again.label);
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
    const rows =
      expected.ruleCount + (await page.evaluate(() => window.fnt?.app.content.surfaces.size ?? 0));
    await expect(dialog.locator('.reaction-row')).toHaveCount(rows);

    // Hint first (#622): nothing found yet, so every combo is ??? for now.
    await expect(dialog).toContainText(`Combos found: 0 of ${expected.ruleCount}.`);
    await expect(dialog.locator('.reaction-row-unfound')).toHaveCount(expected.ruleCount);
    await expect(dialog).not.toContainText(expected.chainLabel);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();

    // "Always show" lays the whole table open, as it was before #622.
    await page.evaluate(() => window.fnt?.app.updateSettings({ comboHints: 'show' }));
    await page.getByRole('button', { name: /how the elements react/i }).click();
    await expect(dialog.locator('.reaction-row')).toHaveCount(rows);
    await expect(dialog.locator('.reaction-row-unfound')).toHaveCount(0);
    // Lightning through water is the lesson worth finding first.
    await expect(dialog).toContainText(expected.chainLabel);
  });
});
