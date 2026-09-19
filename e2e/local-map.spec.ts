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
  await dialog.getByRole('button', { name: 'Walk to Elder Mira', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(async () => page.evaluate(() => window.fnt?.app.state?.story.nodeId))
    .toBe('mira_intro');
  const lines = page.locator('.dialogue-panel button');
  const total = Number((await page.locator('.line-count').textContent())?.split(' of ')[1]);
  for (let line = 0; line < total; line++) await lines.click();
  await expect(page.locator('.explore-scene')).toBeVisible();
  await expect(page.locator('.explore-objective')).toContainText('take the east road');
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Local map', exact: true }).getByRole('button', {
      name: 'Walk to Elder Mira',
      exact: true,
    }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify(window.fnt?.app.state))).not.toBe(before);
});

test('a normal solo exploration dock has no phantom vertical scroll while large text keeps it available', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Explorer'], ['kaya'], 'solo-dock');
  await enterNode(page, 'village_explore');
  await settleLayout(page);
  const normal = await page.locator('.explore-dock').evaluate((dock) => {
    const roster = dock.querySelector<HTMLElement>('.roster')?.getBoundingClientRect();
    const hud = dock.querySelector<HTMLElement>('.explore-hud')?.getBoundingClientRect();
    const bounds = dock.getBoundingClientRect();
    return {
      className: dock.className,
      scrollable: dock.scrollHeight > dock.clientHeight,
      bottom: bounds.bottom,
      childrenFit: Boolean(
        roster && hud && roster.bottom <= bounds.bottom + 1 && hud.bottom <= bounds.bottom + 1,
      ),
    };
  });
  expect(normal.className).toContain('solo-party');
  expect(normal.scrollable).toBe(false);
  expect(normal.childrenFit).toBe(true);
  expect(normal.bottom).toBeLessThanOrEqual(720);

  await page.evaluate(() => window.fnt?.app.updateSettings({ largeText: 'huge' }));
  const large = await page.locator('.explore-dock').evaluate((dock) => ({
    overflowY: getComputedStyle(dock).overflowY,
  }));
  expect(large.overflowY).toBe('auto');

  await page.setViewportSize({ width: 390, height: 844 });
  await settleLayout(page);
  const narrowHuge = await page.locator('.explore-dock').evaluate((dock) => ({
    overflowY: getComputedStyle(dock).overflowY,
    bottom: dock.getBoundingClientRect().bottom,
  }));
  expect(narrowHuge.overflowY).toBe('auto');
  expect(narrowHuge.bottom).toBeLessThanOrEqual(844);

  await resetStorage(page, '?renderer=canvas');
  await startGame(
    page,
    ['A', 'B', 'C', 'D', 'E', 'F'],
    ['kaya', 'bo', 'nilak', 'nima', 'tenzo', 'lin_mei'],
    'crowded-dock',
  );
  await enterNode(page, 'village_explore');
  await settleLayout(page);
  const crowded = await page.locator('.explore-dock').evaluate((dock) => {
    const roster = dock.querySelector<HTMLElement>('.roster');
    return {
      rosterScrollable: Boolean(roster && roster.scrollWidth > roster.clientWidth),
    };
  });
  expect(crowded.rosterScrollable).toBe(true);
});
