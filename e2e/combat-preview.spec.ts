import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import { tileCentre } from './gallery/stage';

test('touching a prop target names its break consequence before confirmation', async ({ page }) => {
  await resetStorage(page);
  await startGame(page, ['Explorer'], ['kaya'], 'combat-preview-touch');
  await enterNode(page, 'battle_quarry_gate');
  await takeTurn(page);
  await waitForIdle(page);

  await page.evaluate(() => {
    const app = window.fnt?.app;
    const state = app?.state;
    const battle = state?.battle;
    const hero = battle?.units.find((unit) => unit.faction === 'party');
    if (!app || !state || !battle || !hero) throw new Error('No quarry battle hero.');
    const turnIndex = battle.order.indexOf(hero.id);
    app.state = {
      ...state,
      battle: {
        ...battle,
        units: battle.units.map((unit) =>
          unit.id === hero.id ? { ...unit, pos: { x: 11, y: 4 } } : unit,
        ),
        turnIndex,
      },
    };
    app.resync();
  });
  await settleLayout(page);

  await page.getByRole('button', { name: /^Fire Jab/ }).click();
  const canvas = page.locator('.map-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('No combat canvas.');
  const point = await tileCentre(page, { x: 12, y: 4 });
  await canvas.tap({ position: { x: point.x - box.x, y: point.y - box.y } });

  const confirm = page.locator('.confirm-bar').filter({ hasText: 'Confirm' });
  await expect(confirm).toContainText('Oil Flask');
  await expect(confirm).toContainText('flask shatters and oil spreads');
});

test('movement confirmation warns about a possible direct attack without claiming safety', async ({
  page,
}) => {
  await resetStorage(page);
  await startGame(page, ['Explorer'], ['sura'], 'movement-threat-touch');
  await enterNode(page, 'battle_quarry_gate');
  await takeTurn(page);
  await waitForIdle(page);
  await page.evaluate(() => window.fnt?.app.updateSettings({ largeText: 'huge' }));

  await page.evaluate(() => {
    const app = window.fnt?.app;
    const state = app?.state;
    const battle = state?.battle;
    const hero = battle?.units.find((unit) => unit.faction === 'party');
    if (!app || !state || !battle || !hero) throw new Error('No quarry battle hero.');
    const turnIndex = battle.order.indexOf(hero.id);
    app.state = {
      ...state,
      battle: {
        ...battle,
        units: battle.units.map((unit) =>
          unit.id === hero.id ? { ...unit, pos: { x: 1, y: 3 } } : unit,
        ),
        turnIndex,
      },
    };
    app.resync();
  });
  await settleLayout(page);

  await page.getByRole('button', { name: /^Move/ }).click();
  const canvas = page.locator('.map-canvas');
  const tapTile = async (pos: { x: number; y: number }) => {
    // Cancel removes the forecast and resizes the canvas. Read both the camera
    // and the element bounds only after that layout change has settled.
    await settleLayout(page);
    const box = await canvas.boundingBox();
    if (!box) throw new Error('No combat canvas.');
    const point = await tileCentre(page, pos);
    await canvas.tap({ position: { x: point.x - box.x, y: point.y - box.y } });
  };

  await tapTile({ x: 5, y: 3 });
  const warning = page.locator('.movement-threat-warning');
  await expect(warning).toContainText('Fire Nation Deserter could hit here.');
  await expect(page.locator('.movement-threat-qualification')).toHaveText(
    'Based on the current battlefield. Other actions and hazards can change this.',
  );

  await page.getByRole('button', { name: /^Cancel$/ }).click();
  await tapTile({ x: 4, y: 3 });
  await expect(page.locator('.movement-threat-empty')).toHaveText(
    'No immediate direct attack found',
  );
  await expect(page.locator('.confirm-bar')).not.toContainText('safe');
});

test('player action controls are disabled during an enemy turn', async ({ page }) => {
  await resetStorage(page);
  await startGame(page, ['Reviewer'], ['kaya'], 'enemy-controls-touch');
  await enterNode(page, 'battle_quarry_gate');
  await takeTurn(page);
  await waitForIdle(page);

  await page.evaluate(() => {
    const app = window.fnt?.app;
    const state = app?.state;
    const battle = state?.battle;
    if (!app || !state || !battle) throw new Error('No battle for enemy-control fixture.');
    const turnIndex = battle.order.findIndex((id) => {
      const unit = battle.units.find((candidate) => candidate.id === id);
      return unit?.faction === 'enemy';
    });
    if (turnIndex < 0) throw new Error('Enemy turn fixture missing an enemy.');
    app.state = { ...state, battle: { ...battle, turnIndex } };
    app.resync();
  });

  const controls = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('.action-button')];
    return {
      moveDisabled: buttons.find((button) => button.textContent?.includes('Move'))?.disabled,
      endDisabled: buttons.find((button) => button.textContent?.includes('End turn'))?.disabled,
      enemyBanner: document.querySelector('.enemy-turn-banner')?.textContent ?? '',
    };
  });
  expect(controls.moveDisabled).toBe(true);
  expect(controls.endDisabled).toBe(true);
  expect(controls.enemyBanner).toContain('moving');
});
