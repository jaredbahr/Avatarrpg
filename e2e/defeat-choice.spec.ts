import { expect, test, type Page } from '@playwright/test';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';

/** Knocks every party unit out on the open Forest Road fight, as a lost fight ends. */
async function loseTheFight(page: Page): Promise<void> {
  await page.evaluate(() => {
    const app = window.fnt!.app;
    const battle = app.state!.battle!;
    app.state = {
      ...app.state!,
      battle: {
        ...battle,
        phase: 'defeat',
        units: battle.units.map((u) => (u.faction === 'party' ? { ...u, hp: 0 } : u)),
      },
    };
    app.resync();
  });
}

async function openForestFight(page: Page, players: string[]): Promise<unknown> {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, players, ['kaya', 'sura', 'bo'].slice(0, players.length), 'defeat-choice');
  await enterNode(page, 'battle_forest_road');
  await page.waitForFunction(() => window.fnt?.app.state?.battle?.phase === 'active');
  await waitForIdle(page);
  return page.evaluate(() => window.fnt!.app.state!.battle);
}

test('Try again restarts the lost Forest Road fight from its opening board', async ({ page }) => {
  test.setTimeout(60_000);
  const opening = await openForestFight(page, ['Ana', 'Ben', 'Cal']);
  await loseTheFight(page);

  const panel = page.locator('.result-panel');
  await expect(panel.getByRole('heading', { name: 'Driven back' })).toBeVisible();
  await expect(panel.getByText(/decides\.$/)).toBeVisible();
  const retry = panel.getByRole('button', { name: 'Try again' });
  const carry = panel.getByRole('button', { name: 'Carry on' });
  await expect(retry).toBeVisible();
  await expect(carry).toBeVisible();
  const tap = await page.evaluate(() => {
    const probe = document.body.appendChild(document.createElement('div'));
    probe.style.height = 'var(--tap)';
    const px = probe.getBoundingClientRect().height;
    probe.remove();
    return px;
  });
  for (const button of [retry, carry]) {
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(tap - 0.5);
    expect(box!.width).toBeGreaterThanOrEqual(tap - 0.5);
  }

  await retry.click();
  await expect(panel).toHaveCount(0);
  await page.waitForFunction(() => window.fnt?.app.state?.battle?.phase === 'active');
  expect(await page.evaluate(() => window.fnt!.app.state!.battle)).toEqual(opening);
  expect(await page.evaluate(() => window.fnt!.app.state!.story.nodeId)).toBe('battle_forest_road');
  await expect(page.locator('.combat-scene')).toBeVisible();
  // The retry is a fight start, so Continue reopens the fresh fight.
  const saved = await page.evaluate(() => localStorage.getItem('fnt.save.auto'));
  expect(JSON.parse(saved!).state.battle).toEqual(opening);
});

test('Carry on follows the Forest Road defeat branch', async ({ page }) => {
  test.setTimeout(60_000);
  await openForestFight(page, ['Ana']);
  await loseTheFight(page);

  const panel = page.locator('.result-panel');
  await expect(panel.getByText(/decides\.$/)).toHaveCount(0);
  await panel.getByRole('button', { name: 'Carry on' }).click();
  await page.waitForFunction(() => window.fnt?.app.state?.screen !== 'combat');
  expect(await page.evaluate(() => window.fnt!.app.state!.story.visited)).toContain(
    'defeat_forest',
  );
});

test('Carry on after the Driller goes home to occupied Ba Dan, not to a game over', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Ana'], ['kaya'], 'defeat-choice-driller');
  await enterNode(page, 'battle_grumbler');
  await page.waitForFunction(() => window.fnt?.app.state?.battle?.phase === 'active');
  await waitForIdle(page);
  await loseTheFight(page);

  await page.locator('.result-panel').getByRole('button', { name: 'Carry on' }).click();
  await page.waitForFunction(() => window.fnt?.app.state?.screen === 'dialogue');
  // The escape, the night at Mira's table and the morning cart (C-02, C-16, C-32).
  await page.evaluate(() => {
    const app = window.fnt!.app;
    for (let step = 0; step < 60 && app.state?.screen === 'dialogue'; step++)
      app.dispatch({ type: 'advanceDialogue' });
  });
  const state = await page.evaluate(() => window.fnt!.app.state!);
  expect(state.screen).toBe('ended');
  expect(state.story.nodeId).toBe('act1_epilogue_lost');
  expect(state.story.visited).toContain('lost_home_pella');
  expect(state.flags.act1_lost).toBe(true);

  await page.getByRole('button', { name: 'Read summary' }).click();
  await expect(
    page.getByRole('heading', { name: 'The Quarry Keeps Running', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Continue exploring', exact: true }).click();
  await expect(page.locator('.explore-scene')).toBeVisible();
  const roam = await page.evaluate(() => window.fnt!.app.state!);
  expect(roam.story.nodeId).toBe('village_explore');
  expect(roam.location.mapId).toBe('ba_dan_village');
  await expect(page.getByText('The quarry is still held.', { exact: false }).first()).toBeVisible();
});
