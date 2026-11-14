import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, startGame } from './helpers';

/**
 * #772: the title and the Save menu warn while the browser has not agreed to
 * keep the saves, and the first save written asks it to. The browser's answer
 * is stubbed before the game boots, because what a real browser answers
 * depends on the browser, the device and how the game was opened.
 */
async function stubStorage(page: Page, persisted: boolean, grant: boolean): Promise<void> {
  await page.addInitScript(
    ({ persisted, grant }) => {
      let kept = persisted;
      const calls = { persist: 0 };
      (window as unknown as { persistCalls: typeof calls }).persistCalls = calls;
      Object.defineProperty(navigator, 'storage', {
        configurable: true,
        value: {
          persisted: () => Promise.resolve(kept),
          persist: () => {
            calls.persist += 1;
            kept = kept || grant;
            return Promise.resolve(kept);
          },
          estimate: () => Promise.resolve({ usage: 0, quota: 0 }),
        },
      });
    },
    { persisted, grant },
  );
}

const NOTE = /may clear saves/;

test('the title warns while saves may be cleared, and a granted request after a save clears it', async ({
  page,
}) => {
  await stubStorage(page, false, true);
  await resetStorage(page, '?renderer=canvas');
  await expect(page.locator('.title-storage-note')).toHaveText(NOTE);
  await expect(page.getByRole('button', { name: 'New game', exact: true })).toBeVisible();

  await startGame(page, ['Ana'], ['kaya'], 'storage-persistence');
  await enterNode(page, 'village_explore');
  expect(await page.evaluate(() => window.fnt!.app.saveTo('slot1'))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.fnt!.app.savePersistence.warning)).toBeNull();
  // Asked once, however many saves follow.
  expect(await page.evaluate(() => window.fnt!.app.saveTo('slot2'))).toBe(true);
  expect(
    await page.evaluate(
      () => (window as unknown as { persistCalls: { persist: number } }).persistCalls.persist,
    ),
  ).toBe(1);
  await page.evaluate(() => window.fnt!.app.start());
  await expect(page.getByRole('button', { name: 'New game', exact: true })).toBeVisible();
  await expect(page.locator('.title-storage-note')).toHaveCount(0);
});

test('a declined request keeps the line on the title and in the Save menu', async ({ page }) => {
  await stubStorage(page, false, false);
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Ana'], ['kaya'], 'storage-persistence');
  await enterNode(page, 'village_explore');
  expect(await page.evaluate(() => window.fnt!.app.saveTo('slot1'))).toBe(true);
  await page.evaluate(() => window.fnt!.app.start());
  await expect(page.locator('.title-storage-note')).toHaveText(NOTE);
  await page.getByRole('button', { name: 'Load a save', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Load game' });
  await expect(menu.locator('.storage-note')).toHaveText(NOTE);
  // It is not the blocked-storage warning: the slots stay usable.
  await expect(menu.locator('.warn-note')).toHaveCount(0);
  await expect(menu.getByRole('button', { name: 'Load' }).first()).toBeEnabled();
});

test('storage the browser already keeps shows no line', async ({ page }) => {
  await stubStorage(page, true, true);
  await resetStorage(page, '?renderer=canvas');
  await expect(page.getByRole('button', { name: 'New game', exact: true })).toBeVisible();
  await expect(page.locator('.title-storage-note')).toHaveCount(0);
  await page.getByRole('button', { name: 'Load a save', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Load game' }).locator('.storage-note'),
  ).toHaveCount(0);
});

test('the Save menu opens a storage check that reads the browser, and Settings stays as it was', async ({
  page,
}) => {
  await stubStorage(page, false, false);
  await resetStorage(page, '?renderer=canvas');
  await page.getByRole('button', { name: 'Load a save', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Load game' });
  await menu.getByRole('button', { name: 'Storage check', exact: true }).click();
  const check = page.getByRole('dialog', { name: 'Storage check' });
  const answer = (label: string) =>
    check.locator('.storage-check > div').filter({ hasText: label }).locator('dd');
  await expect(answer('Opened from')).toHaveText('A browser tab');
  await expect(answer('Browser has agreed to keep saves')).toHaveText('No');
  await expect(answer('Answer when the game asked')).toHaveText(/Not asked yet/);
  await expect(answer('Saves on this device')).toHaveText('0 saves');
  await expect(answer('Storage first used')).toHaveText(/\(today\)$/);
  await expect(answer('Last copy saved to a file')).toHaveText('Never from this browser');
  await expect(check.locator('.storage-note')).toHaveText(NOTE);
  // Done returns to the Save menu, which is still open underneath.
  await check.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(check).toHaveCount(0);
  await expect(menu.getByRole('button', { name: 'Storage check', exact: true })).toBeFocused();
});
