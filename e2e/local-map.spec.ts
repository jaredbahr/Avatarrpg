import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

test('local map tracks a real walk and preserves the campaign when opened', async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Explorer'], ['kaya', 'bo'], 'local-map');
  await enterNode(page, 'village_explore');
  await settleLayout(page);
  const party = page.locator('.explore-map-corner .local-party');
  await expect(party).toHaveCount(2);
  const start = await party.first().getAttribute('cx');
  await page.evaluate(() => window.fnt?.app.dispatch({ type: 'walkTo', pos: { x: 8, y: 7 } }));
  await waitForIdle(page);
  await expect(party.first()).toHaveAttribute('cx', '8.5');
  await expect(party.first()).toHaveAttribute('cy', '7.5');
  expect(start).not.toBe('8.5');
  const before = await page.evaluate(() => JSON.stringify(window.fnt?.app.state));
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Local map', exact: true });
  await expect(dialog.getByRole('navigation', { name: 'Routes from this area' })).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'East road → Forest Road', exact: true }),
  ).toBeEnabled();
  await dialog.getByRole('button', { name: 'Follow party', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify(window.fnt?.app.state))).toBe(before);
});
