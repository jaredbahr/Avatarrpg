import { expect, test } from '@playwright/test';
import {
  enterNode,
  pauseClock,
  resetStorage,
  settleLayout,
  startGame,
  takeTurn,
  waitForIdle,
} from './helpers';
import type { Page } from '@playwright/test';

async function openReadyFight(page: Page, reduceMotion: boolean): Promise<void> {
  await resetStorage(page, '?renderer=canvas');
  await startGame(
    page,
    ['Kaya', 'Nilak', 'Bo', 'Nima'],
    ['kaya', 'nilak', 'bo', 'nima'],
    'victory-beat-ui',
    { reduceMotion },
  );
  await enterNode(page, 'battle_forest_road');
  expect(await takeTurn(page)).toBe(true);
  await waitForIdle(page);
  await settleLayout(page);
}

async function sealVictory(page: Page): Promise<void> {
  const phase = await page.evaluate(() => {
    const app = window.fnt!.app;
    const state = app.state!;
    const battle = state.battle!;
    const activeId = battle.order[battle.turnIndex];
    if (!activeId) throw new Error('No active unit to end the turn.');
    app.state = {
      ...state,
      battle: {
        ...battle,
        units: battle.units.map((unit) => (unit.faction === 'enemy' ? { ...unit, hp: 0 } : unit)),
      },
    };
    app.resync();
    app.dispatch({ type: 'endTurn', unitId: activeId });
    return app.state?.battle?.phase;
  });
  expect(phase).toBe('victory');
}

test('a tap on the clear-board victory overlay skips to the unchanged result card', async ({
  page,
}) => {
  await openReadyFight(page, false);
  await pauseClock(page);
  await sealVictory(page);
  await page.clock.runFor(50);

  await expect(page.locator('.combat-scene[data-victory-beat="active"]')).toBeVisible();
  await expect(page.locator('.result-panel')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show result' }).click();

  await expect(page.locator('.result-panel')).toBeVisible();
  await expect(page.locator('.result-panel')).toContainText('The fight is won');
  await page.clock.resume();
});

test('reduced motion keeps the camera still and shows the card without a hold', async ({
  page,
}) => {
  await openReadyFight(page, true);
  const before = await page.evaluate(() => window.fnt!.app.rendererCamera());
  if (!before) throw new Error('No combat camera before victory.');
  await pauseClock(page);
  await sealVictory(page);
  await page.clock.runFor(50);

  await expect(page.locator('.result-panel')).toBeVisible();
  await expect(page.locator('.combat-scene[data-victory-beat="active"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show result' })).toHaveCount(0);
  const after = await page.evaluate(() => window.fnt!.app.rendererCamera());
  expect(after?.tilePx).toBe(before.tilePx);
  expect(after?.offsetX).toBe(before.offsetX);
  expect(after?.offsetY).toBe(before.offsetY);
  await page.clock.resume();
});
