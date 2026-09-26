import { expect, test } from '@playwright/test';
import { resetStorage, setLargeText, settleDialog, startGame } from './helpers';

/**
 * Largest text on a short landscape viewport is where the sheet used to lose
 * its footer: the panel scrolled as one region, so Import and Close fell below
 * the bottom edge with nothing to say the sheet went on, and the beat's note
 * ("must fit at Largest text without hiding Import or Close") was a promise the
 * layout did not keep. The slot list scrolls now and the footer is pinned, so
 * both buttons must sit inside the dialog's box and inside the viewport.
 */
test.describe('the save sheet at Largest text', () => {
  test.use({ viewport: { width: 1194, height: 834 } });

  test('keeps Import and Close inside the dialog and on screen', async ({ page }) => {
    await resetStorage(page);
    await startGame(page, ['Elias'], ['kaya'], 'largest-save-sheet');
    await page.evaluate(() => {
      const app = window.fnt?.app;
      if (!app?.saveTo('slot1')) throw new Error('Could not seed the save');
      const json = localStorage.getItem('fnt.save.slot1');
      if (!json) throw new Error('Missing seeded save');
      localStorage.setItem('fnt.save.slot2', json);
      localStorage.setItem('fnt.save.slot3', json);
    });
    await page.reload();
    await page.getByRole('button', { name: 'Load a save' }).click();
    await setLargeText(page, 'huge');

    const sheet = page.locator('.dialog');
    await expect(sheet).toBeVisible();
    await settleDialog(sheet);

    // The list is the sheet's only scroll region: a footer cannot be pushed out.
    await expect
      .poll(
        () =>
          page
            .locator('.dialog .slot-list')
            .evaluate(
              (list) =>
                list.scrollHeight > list.clientHeight &&
                ['auto', 'scroll'].includes(getComputedStyle(list).overflowY),
            ),
        { message: 'The slot list must be the scrolling region at Largest text' },
      )
      .toBe(true);

    for (const name of ['Import from file', 'Close']) {
      const control = sheet.getByRole('button', { name, exact: true });
      await expect(control).toBeVisible();
      // The frame and the button are read separately; the poll retries until
      // both come from the settled layout.
      await expect
        .poll(
          async () => {
            const frame = await sheet.boundingBox();
            const box = await control.boundingBox();
            if (!frame || !box) return { onScreen: false, inSheet: false, box, frame };
            const onScreen =
              box.x >= 0 && box.y >= 0 && box.x + box.width <= 1194 && box.y + box.height <= 834;
            const inSheet =
              box.x >= frame.x - 0.5 &&
              box.y >= frame.y - 0.5 &&
              box.x + box.width <= frame.x + frame.width + 0.5 &&
              box.y + box.height <= frame.y + frame.height + 0.5;
            return { onScreen, inSheet, box, frame };
          },
          { message: `${name} must sit inside the sheet and the viewport` },
        )
        .toMatchObject({ onScreen: true, inSheet: true });
    }
  });
});

test('full storage still allows Continue, loading and erasing existing saves', async ({ page }) => {
  await resetStorage(page);
  await startGame(page, ['Elias'], ['kaya'], 'full-storage');
  const saved = await page.evaluate(() => {
    const app = window.fnt?.app;
    if (!app?.saveTo('slot1')) throw new Error('Could not seed the save');
    const json = localStorage.getItem('fnt.save.slot1');
    if (!json) throw new Error('Missing seeded save');
    localStorage.setItem('fnt.save.slot2', json);
    localStorage.setItem('fnt.save.auto', json);
    return app.state;
  });
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    };
  });
  await page.reload();
  await expect(page.getByRole('button', { name: /^Continue$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Load a save' }).click();
  await expect(page.locator('.warn-note')).toHaveCount(0);
  const slot1 = page.locator('.slot').filter({ hasText: 'Slot 1' });
  const slot2 = page.locator('.slot').filter({ hasText: 'Slot 2' });
  await expect(slot1.getByRole('button', { name: /^Load$/ })).toBeEnabled();
  await slot2.getByRole('button', { name: 'Erase' }).click();
  await expect(slot2).toContainText('Empty');
  await slot1.getByRole('button', { name: /^Load$/ }).click();
  expect(await page.evaluate(() => window.fnt?.app.state)).toEqual(saved);
});

test('blocked slot reads leave the title and load menu usable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await resetStorage(page);
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key.startsWith('fnt.save.')) throw new DOMException('Blocked', 'SecurityError');
      return getItem.call(this, key);
    };
  });
  await page.reload();
  await page.getByRole('button', { name: 'Load a save' }).click();
  await expect(page.locator('.warn-note')).toContainText('blocking site data');
  await expect(page.locator('.slot')).toHaveCount(4);
  for (const slot of await page.locator('.slot').all()) {
    await expect(slot).toContainText('Could not read');
    await expect(slot.getByRole('button', { name: /^Load$/ })).toBeDisabled();
  }
  await page.getByRole('button', { name: /^Close$/ }).click();
  await expect(page.getByRole('button', { name: 'New game' })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('a failed erase reports the failure and keeps the occupied slot', async ({ page }) => {
  await resetStorage(page);
  await startGame(page, ['Elias'], ['kaya']);
  await page.evaluate(() => {
    if (!window.fnt?.app.saveTo('slot1')) throw new Error('Could not seed the save');
  });
  await page.addInitScript(() => {
    Storage.prototype.removeItem = () => {
      throw new DOMException('Blocked', 'SecurityError');
    };
  });
  await page.reload();
  await page.getByRole('button', { name: 'Load a save' }).click();
  const slot = page.locator('.slot').filter({ hasText: 'Slot 1' });
  await slot.getByRole('button', { name: 'Erase' }).click();
  await expect(page.locator('.toast')).toContainText('Could not erase');
  await expect(slot.getByRole('button', { name: /^Load$/ })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('fnt.save.slot1'))).not.toBeNull();
});

test('loadability comes from validation, not the words in the save summary', async ({ page }) => {
  await resetStorage(page);
  await startGame(page, ['Elias'], ['kaya']);
  await page.evaluate(() => {
    if (!window.fnt?.app.saveTo('slot1')) throw new Error('Could not seed the save');
    const json = localStorage.getItem('fnt.save.slot1');
    if (!json) throw new Error('Missing seeded save');
    const save = JSON.parse(json);
    save.summary = 'Damaged bridge';
    localStorage.setItem('fnt.save.slot1', JSON.stringify(save));
    localStorage.setItem('fnt.save.auto', JSON.stringify(save));
    save.format += 1;
    delete save.summary;
    localStorage.setItem('fnt.save.slot2', JSON.stringify(save));
  });
  await page.reload();
  await expect(page.getByRole('button', { name: /^Continue$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Load a save' }).click();
  const valid = page.locator('.slot').filter({ hasText: 'Slot 1' });
  const future = page.locator('.slot').filter({ hasText: 'Slot 2' });
  await expect(valid).toContainText('Damaged bridge');
  await expect(valid.getByRole('button', { name: /^Load$/ })).toBeEnabled();
  await expect(future).toContainText('newer version');
  await expect(future.getByRole('button', { name: /^Load$/ })).toBeDisabled();
});
