import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, setLargeText, settleDialog, startGame } from './helpers';

test('a long inspector opens at its title and keeps keyboard focus inside', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Jared'], ['nima', 'kaya', 'sura', 'bo', 'wen', 'jinu']);
  await enterNode(page, 'village_explore');
  await setLargeText(page, 'huge');

  const lastHero = page.locator('.roster-row').last();
  await lastHero.scrollIntoViewIfNeeded();
  await lastHero.click();

  const dialog = page.getByRole('dialog');
  const title = dialog.getByRole('heading', { level: 2 });
  const close = dialog.getByRole('button', { name: 'Close' });
  await settleDialog(dialog);
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

for (const childName of ['Settings', 'Save game']) {
  test(`Escape closes ${childName} while keeping its parent pause open`, async ({ page }) => {
    await resetStorage(page, '?renderer=canvas');
    await startGame(page, ['Jared'], ['kaya'], `nested-pause-${childName}`);
    await enterNode(page, 'village_explore');

    const pauseButton = page.getByRole('button', { name: 'Pause', exact: true });
    await pauseButton.focus();
    await page.keyboard.press('Enter');
    const pause = page.getByRole('dialog', { name: 'Paused', exact: true });
    const opener = pause.getByRole('button', { name: childName, exact: true });
    await opener.focus();
    await page.keyboard.press('Enter');

    const child = page.getByRole('dialog', { name: childName, exact: true });
    await settleDialog(child);
    await expect(page.getByRole('dialog')).toHaveCount(2);
    await expect(child.getByRole('heading', { level: 2 })).toBeFocused();

    // Shift+Tab from the heading reaches the last control, then Tab wraps
    // inside the child rather than reaching a control in the paused sheet.
    const controls = child.locator('button:not(:disabled)');
    await page.keyboard.press('Shift+Tab');
    await expect(controls.last()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(controls.first()).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(child).toHaveCount(0);
    await expect(pause).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(opener).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(pauseButton).toBeFocused();
  });
}
