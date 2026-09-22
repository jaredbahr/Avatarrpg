import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame } from './helpers';

test('a long inspector opens at its title and keeps keyboard focus inside', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Jared'], ['nima', 'kaya', 'sura', 'bo', 'wen', 'jinu']);
  await enterNode(page, 'village_explore');
  await page.evaluate(() => window.fnt?.app.updateSettings({ largeText: 'huge' }));

  const lastHero = page.locator('.roster-row').last();
  await lastHero.scrollIntoViewIfNeeded();
  await lastHero.click();

  const dialog = page.getByRole('dialog');
  const title = dialog.getByRole('heading', { level: 2 });
  const close = dialog.getByRole('button', { name: 'Close' });
  await expect(title).toBeFocused();
  // The dialog body is the scroll region (the header stays pinned above it),
  // so a long inspector overflows its body and opens with that body at the top.
  const scroll = await dialog.evaluate((panel) => {
    const body = panel.querySelector<HTMLElement>(':scope > .stack');
    if (!body) throw new Error('Missing dialog body');
    return { top: body.scrollTop, height: body.clientHeight, content: body.scrollHeight };
  });
  expect(scroll.content).toBeGreaterThan(scroll.height);
  expect(scroll.top).toBe(0);

  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(lastHero).toBeFocused();
});
