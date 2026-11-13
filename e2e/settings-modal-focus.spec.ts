import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { enterNode, resetStorage, startGame } from './helpers';

async function gameState(page: Page): Promise<string> {
  return page.evaluate(() => JSON.stringify(window.fnt?.app.state));
}

async function openSettings(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  return page.getByRole('dialog', { name: 'Settings', exact: true });
}

async function expectModalKeyboardFocus(
  page: Page,
  settings: Locator,
  before: string,
): Promise<void> {
  await expect(settings.getByRole('heading', { name: 'Settings', exact: true })).toBeFocused();
  // Neither activation key may reach the conversation behind the modal.
  await page.keyboard.press('Enter');
  expect(await gameState(page)).toBe(before);
  await page.keyboard.press('Space');
  expect(await gameState(page)).toBe(before);
  await expect(settings).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Paused', exact: true })).toBeVisible();

  for (const key of ['Tab', 'Shift+Tab', 'Tab']) {
    await page.keyboard.press(key);
    await expect
      .poll(() => settings.evaluate((dialog) => dialog.contains(document.activeElement)))
      .toBe(true);
  }
}

async function closeSettingsAndResume(page: Page, settings: Locator): Promise<void> {
  await settings.getByRole('button', { name: 'Done', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Paused', exact: true })
    .getByRole('button', { name: 'Resume', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test.describe(`settings keep modal focus (${renderer})`, () => {
    test.beforeEach(async ({ page }) => {
      await resetStorage(page, `?renderer=${renderer}`);
      await startGame(page, ['Elias'], ['kaya']);
      await enterNode(page, 'village_explore');
    });

    test('a switch cannot advance Mira dialogue behind Settings', async ({ page }) => {
      await enterNode(page, 'mira_intro');
      await expect(page.locator('.explore-conversation')).toBeVisible();
      await expect(page.locator('.line-count')).toHaveText('1 of 4');
      const before = await gameState(page);
      const wasGrid = await page.evaluate(() => window.fnt!.app.settings.showGrid);
      const settings = await openSettings(page);

      await settings.getByRole('switch', { name: 'Show grid', exact: true }).click();

      await expect(
        settings.getByRole('switch', { name: 'Show grid', exact: true }),
      ).toHaveAttribute('aria-checked', String(!wasGrid));
      expect(await page.evaluate(() => window.fnt!.app.settings.showGrid)).toBe(!wasGrid);
      await expectModalKeyboardFocus(page, settings, before);

      await closeSettingsAndResume(page, settings);
      expect(await gameState(page)).toBe(before);
      await page.locator('[data-conversation-control="next"]').focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.line-count')).toHaveText('2 of 4');
    });

    test('a text-size radio cannot choose a response behind Settings', async ({ page }) => {
      await enterNode(page, 'plant_chair');
      await expect(page.locator('.explore-conversation .choice-panel')).toBeVisible();
      const before = await gameState(page);
      const originalFontSize = await page.evaluate(() =>
        parseFloat(getComputedStyle(document.documentElement).fontSize),
      );
      const settings = await openSettings(page);

      await settings.getByRole('radio', { name: 'Largest', exact: true }).click();

      await expect(settings.getByRole('radio', { name: 'Largest', exact: true })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(await page.evaluate(() => window.fnt!.app.settings.largeText)).toBe('huge');
      expect(
        await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize)),
      ).toBeGreaterThan(originalFontSize);
      await expectModalKeyboardFocus(page, settings, before);

      await closeSettingsAndResume(page, settings);
      expect(await gameState(page)).toBe(before);
      await page.getByRole('button', { name: /Sit down.*Take a break at the shop/ }).focus();
      await page.keyboard.press('Space');
      await expect
        .poll(() => page.evaluate(() => window.fnt!.app.state?.story.nodeId))
        .toBe('plant_chair_seat');
    });
  });
}
