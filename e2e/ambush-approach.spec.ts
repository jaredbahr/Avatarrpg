import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame } from './helpers';

test('reduced motion places the Cutting party at its combat spawns immediately', async ({
  page,
}) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Kaya', 'Sura', 'Bo'], ['kaya', 'sura', 'bo'], 'cutting-still', {
    reduceMotion: true,
  });
  await page.evaluate(() => {
    const app = window.fnt!.app;
    app.state = { ...app.state!, flags: { ...app.state!.flags, ruon_spared: true } };
  });
  await enterNode(page, 'cutting_explore');
  await page.evaluate(() => window.fnt!.app.dispatch({ type: 'walkTo', pos: { x: 8, y: 4 } }));
  await expect(page.locator('.combat-scene')).toBeVisible();
  expect(
    await page.evaluate(() => {
      const app = window.fnt!.app;
      const party = app.state!.battle!.units.filter((unit) => unit.faction === 'party');
      return {
        positions: party.map((unit) => unit.pos),
        moving: party.some(
          (unit) => app.animator.renderPos(performance.now(), unit.id) !== undefined,
        ),
      };
    }),
  ).toEqual({
    positions: [
      { x: 1, y: 3 },
      { x: 3, y: 4 },
      { x: 1, y: 5 },
    ],
    moving: false,
  });
});
