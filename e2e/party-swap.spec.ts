import { expect, test } from '@playwright/test';
import { resetStorage } from './helpers';

/**
 * Setup is forgiving: a hero someone else holds can be swapped for, names
 * survive, and "Pick for me" lands on a hero nobody has.
 */
test.describe('party setup swaps', () => {
  test('swapping a taken hero keeps both names; Pick for me avoids taken heroes', async ({
    page,
  }) => {
    await resetStorage(page);
    await page.getByRole('button', { name: /new game/i }).click();
    await page.getByRole('button', { name: '2 players' }).click();
    await page.getByRole('button', { name: 'Choose your own', exact: true }).click();
    for (const name of ['Frehley', 'Violet']) {
      await page.getByRole('button', { name: /I've got it/i }).click();
      await page.locator('input[type=text]').fill(name);
      await page.getByRole('button', { name: /^Next$/ }).click();
    }
    // Frehley takes the first firebender.
    await page.getByRole('button', { name: /I've got it/i }).click();
    await page.locator('.pick-card.element-fire').click();
    await page.getByRole('button', { name: /^Next$/ }).click();
    const first = (await page.locator('.pick-card h3').first().textContent()) ?? '';
    await page.locator('.pick-card').first().click();
    await page.getByRole('button', { name: /^Confirm$/ }).click();

    // Violet wants the same one and swaps for it.
    await page.getByRole('button', { name: /I've got it/i }).click();
    await page.locator('.pick-card.element-fire').click();
    await page.getByRole('button', { name: /^Next$/ }).click();
    await page.locator('.pick-card.taken').click();
    await page.locator('#confirm-swap').click();
    await expect(page.locator('.pick-card.selected h3')).toHaveText(first);
    await page.getByRole('button', { name: /^Confirm$/ }).click();

    // Third hero: Pick for me gives someone nobody holds.
    await page.getByRole('button', { name: /I've got it/i }).click();
    await page.locator('#pick-for-me').click();
    const picked = (await page.locator('.pick-card.selected h3').textContent()) ?? '';
    expect(picked).not.toBe('');
    expect(picked).not.toBe(first);
    await page.getByRole('button', { name: /^Confirm$/ }).click();

    // Summary: names are still there, and Violet holds the hero she swapped for.
    const cards = page.locator('.party-summary-card');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toContainText('Frehley');
    await expect(cards.nth(1)).toContainText('Violet');
    await expect(cards.nth(1).locator('h3')).toHaveText(first);
    await expect(cards.nth(0).locator('h3')).not.toHaveText(first);
  });
});
