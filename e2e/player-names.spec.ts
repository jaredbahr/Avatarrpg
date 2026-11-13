import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage } from './helpers';

/**
 * The optional names step after the suggested party (owner, 2026-11-13). A
 * name shows in one place, the combat hand-off card; Skip, or a blank seat,
 * keeps the card's "Player N" wording and starts exactly today's game.
 */

async function newTable(page: Page, size: number): Promise<void> {
  await resetStorage(page, '?renderer=canvas');
  await page.evaluate(() => window.fnt?.app.updateSettings({ reduceMotion: true }));
  await page.getByRole('button', { name: /new game/i }).click();
  await page.getByRole('button', { name: `${size} players`, exact: true }).click();
  await page.getByRole('button', { name: 'Start with the suggested party', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Who is playing?', exact: true })).toBeVisible();
}

/** Waits for the first party turn of the Forest Road fight and returns its owner's seat. */
async function firstHandoff(page: Page): Promise<number> {
  await enterNode(page, 'battle_forest_road');
  await page.waitForFunction(
    () => {
      const app = window.fnt?.app;
      const battle = app?.state?.battle;
      const id = battle?.order[battle.turnIndex];
      return (
        app &&
        !app.curtainBusy &&
        battle?.phase === 'active' &&
        battle.units.some((unit) => unit.id === id && unit.faction === 'party') &&
        !app.animator.busy(performance.now()) &&
        !document.querySelector('.combat-scene[data-battle-opening]') &&
        document.querySelector('.handoff-banner')
      );
    },
    undefined,
    { timeout: 15_000 },
  );
  return page.evaluate(() => {
    const app = window.fnt!.app;
    const battle = app.state!.battle!;
    const owner = app.session.playerFor(battle.order[battle.turnIndex]);
    return Number(owner?.participantId?.slice('player-'.length)) - 1;
  });
}

test('names typed after the suggested party appear on the hand-off card only', async ({ page }) => {
  await newTable(page, 3);
  // Skip has focus, so an iPad keeps its keyboard down for a table that skips.
  await expect(page.getByRole('button', { name: 'Skip', exact: true })).toBeFocused();
  await page.getByRole('textbox', { name: 'Player 1 name', exact: true }).fill('  Maya  ');
  await page
    .getByRole('textbox', { name: 'Player 3 name', exact: true })
    .fill('<b>Theo</b> the Tremendous');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.waitForFunction(() => window.fnt?.app.state?.story.nodeId === 'act1_open');

  const session = await page.evaluate(() => ({
    participants: window.fnt!.app.session.participants,
    players: window.fnt!.app.session.players.map((player) => player.name),
  }));
  expect(session.participants).toEqual([
    { id: 'player-1', name: 'Player 1', handoffName: 'Maya' },
    { id: 'player-2', name: 'Player 2' },
    { id: 'player-3', name: 'Player 3', handoffName: '<b>Theo</b>' },
  ]);
  // The story rotation and every other label keep the player names.
  expect(session.players).toEqual(['Player 1', 'Player 2', 'Player 3']);

  const seat = await firstHandoff(page);
  const expected = ['Maya', 'Player 2', '<b>Theo</b>'][seat];
  const banner = page.locator('.handoff-banner');
  await expect(banner.getByRole('heading')).toHaveText(expected ?? '');
  // Rendered as text: nothing typed becomes markup.
  await expect(banner.locator('b')).toHaveCount(0);
  await expect(banner).toContainText('Playing ');
});

test('Skip starts the game with the hand-off card it always had', async ({ page }) => {
  await newTable(page, 2);
  await page.getByRole('textbox', { name: 'Player 1 name', exact: true }).fill('Ignored');
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.waitForFunction(() => window.fnt?.app.state?.story.nodeId === 'act1_open');
  expect(await page.evaluate(() => window.fnt!.app.session.participants)).toEqual([
    { id: 'player-1', name: 'Player 1' },
    { id: 'player-2', name: 'Player 2' },
  ]);

  const seat = await firstHandoff(page);
  await expect(page.locator('.handoff-banner').getByRole('heading')).toHaveText(
    `Player ${seat + 1}`,
  );
});

test('Choose your own skips every name in one tap', async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await page.getByRole('button', { name: /new game/i }).click();
  await page.getByRole('button', { name: '3 players', exact: true }).click();
  await page.getByRole('button', { name: 'Choose your own', exact: true }).click();
  await page.getByRole('button', { name: "I've got it", exact: true }).click();
  await page.getByRole('button', { name: 'Skip names', exact: true }).click();
  await expect(page.locator('.setup-panel')).toContainText('Hero 1 of 3 · Player 1');
  await page.getByRole('button', { name: "I've got it", exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pick your path', exact: true })).toBeVisible();
});
