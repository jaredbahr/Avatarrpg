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
