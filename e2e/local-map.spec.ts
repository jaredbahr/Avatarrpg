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
  await expect(dialog.locator('.local-npc-label').filter({ hasText: 'Elder Mira' })).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Walk to Elder Mira', exact: true }),
  ).toBeEnabled();
  await expect(
    dialog.getByRole('button', { name: 'East road → Forest Road', exact: true }),
  ).toBeEnabled();
  await dialog.getByRole('button', { name: 'Follow party', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify(window.fnt?.app.state))).toBe(before);
});

test('a normal solo exploration dock has no phantom vertical scroll while large text keeps it available', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Explorer'], ['kaya'], 'solo-dock');
  await enterNode(page, 'village_explore');
  await settleLayout(page);
  const normal = await page.locator('.explore-dock').evaluate((dock) => ({
    className: dock.className,
    overflowY: getComputedStyle(dock).overflowY,
    scrollable: dock.scrollHeight > dock.clientHeight,
  }));
  expect(normal.className).toContain('solo-party');
  expect(normal.overflowY).toBe('hidden');
  expect(normal.scrollable).toBe(false);

  await page.evaluate(() => window.fnt?.app.updateSettings({ largeText: 'huge' }));
  const large = await page
    .locator('.explore-dock')
    .evaluate((dock) => getComputedStyle(dock).overflowY);
  expect(large).toBe('auto');
});
