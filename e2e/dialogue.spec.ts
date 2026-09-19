import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Elias'], ['kaya']);
  await enterNode(page, 'mira_intro');
  await expect(page.locator('.explore-scene')).toBeVisible();
  await expect(page.locator('.explore-conversation')).toBeVisible();
  await expect(page.locator('.explore-dock')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
});

for (const input of ['click', 'tap', 'Enter', 'Space'] as const) {
  test(`${input} on Next advances exactly one line`, async ({ page }) => {
    const count = page.locator('.line-count');
    const total = Number((await count.textContent())?.split(' of ')[1]);
    expect(total).toBeGreaterThan(1);
    for (let line = 1; line <= total; line++) {
      await expect(count).toHaveText(`${line} of ${total}`);
      const next = page.locator('.dialogue-panel button');
      if (input === 'click') await next.click();
      else if (input === 'tap') await next.tap();
      else {
        if (line === 1) await next.focus();
        await expect(next).toBeFocused();
        await page.keyboard.press(input);
      }
    }
    await expect(page.locator('.explore-scene')).toBeVisible();
  });
}

test('the panel advances once by click or keyboard and ignores held keys', async ({ page }) => {
  const panel = page.locator('.dialogue-panel');
  await page.locator('.dialogue-line').click();
  await expect(page.locator('.line-count')).toHaveText(/^2 of /);
  await panel.focus();
  await panel.dispatchEvent('keydown', { key: 'Enter', repeat: true });
  await expect(page.locator('.line-count')).toHaveText(/^2 of /);
  await page.keyboard.press('Enter');
  await expect(page.locator('.line-count')).toHaveText(/^3 of /);
});
