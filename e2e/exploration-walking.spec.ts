import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';

test('looking around leads to a nearby optional conversation', async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Explorer'], ['kaya']);
  await enterNode(page, 'forest_explore');
  await page.evaluate(() => {
    const app = window.fnt?.app;
    if (!app?.state) throw new Error('No game');
    app.state = { ...app.state, location: { mapId: 'forest_road', pos: { x: 1, y: 4 } } };
    app.resync();
  });
  await page.getByRole('button', { name: 'Look around', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Look around' })).toBeVisible();
  await page.getByRole('button', { name: 'Visit Dema, road keeper', exact: true }).click();
  await waitForIdle(page);
  expect(await page.evaluate(() => window.fnt?.app.state?.story.nodeId)).toBe('forest_dema');
});
