import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, setLargeText, settleDialog, startGame } from './helpers';

/**
 * A toast raised from inside a sheet is the sheet's answer, so it must be
 * seen: visible, the topmost thing at its centre (toBeVisible alone passes for
 * a toast buried under the overlay), clear of the sheet's title and footer, and
 * on screen. That holds for every toast the stack shows, not only the newest:
 * two answers in a row once stacked the older one up over the title.
 *
 * The stack is `pointer-events: none` so it never eats a tap, and
 * `elementFromPoint` skips such elements: without lifting that for the one
 * probe, the element under a toast is always whatever is behind it.
 */
async function expectToastOverSheet(page: Page, text: string): Promise<void> {
  await expect(page.locator('.toast').filter({ hasText: text }).last()).toBeVisible();
  await expect
    .poll(
      () =>
        page.evaluate((text) => {
          // The sheet on top: the save sheet opens over the pause sheet.
          const sheets = document.querySelectorAll('.overlay > .dialog');
          const sheet = sheets[sheets.length - 1];
          const head = sheet?.querySelector('.dialog-head')?.getBoundingClientRect();
          const footer = sheet?.querySelector('.dialog-footer')?.getBoundingClientRect();
          const problems: string[] = [];
          // The poll must not pass on an empty stack once the toasts expire.
          let seen = false;
          for (const node of document.querySelectorAll('.toasts > .toast')) {
            // A toast the stack has collapsed away draws nothing to check.
            if (node.getClientRects().length === 0) continue;
            if (node.textContent?.includes(text)) seen = true;
            const box = node.getBoundingClientRect();
            const stack = node.parentElement;
            stack?.style.setProperty('pointer-events', 'auto');
            const top = document.elementFromPoint(
              box.left + box.width / 2,
              box.top + box.height / 2,
            );
            stack?.style.removeProperty('pointer-events');
            const clear = (edge: DOMRect | undefined) =>
              !edge || box.top >= edge.bottom || box.bottom <= edge.top;
            const label = `"${node.textContent ?? ''}"`;
            if (top === null || !node.contains(top)) problems.push(`${label} is covered`);
            if (!clear(head)) problems.push(`${label} overlaps the sheet's title`);
            if (!clear(footer)) problems.push(`${label} overlaps the sheet's footer`);
            if (box.top < 0 || box.bottom > window.innerHeight) {
              problems.push(`${label} is off screen`);
            }
          }
          if (!seen) problems.push(`"${text}" is not showing`);
          return problems;
        }, text),
      { message: `The toast "${text}" and every toast with it must show over the open sheet` },
    )
    .toEqual([]);
}

/** Saves twice from the pause sheet at Largest text, the second write refused. */
async function toastsFromTheSaveSheet(page: Page, seed: string): Promise<void> {
  await resetStorage(page);
  await startGame(page, ['Elias'], ['kaya'], seed);
  await enterNode(page, 'village_explore');
  await setLargeText(page, 'huge');

  // Save from the sheet: "Game saved." is raised while the sheet stays open.
  await page.evaluate(() => window.fnt?.app.openPause());
  await page.getByRole('button', { name: 'Save game', exact: true }).click();
  const sheet = page.locator('.dialog').last();
  await settleDialog(sheet);
  await sheet
    .locator('.slot')
    .filter({ hasText: 'Slot 1' })
    .getByRole('button', { name: 'Save here', exact: true })
    .click();
  await expectToastOverSheet(page, 'Game saved.');

  // Storage refuses the write: the App's own failure toast, same sheet.
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    };
  });
  await sheet
    .locator('.slot')
    .filter({ hasText: 'Slot 2' })
    .getByRole('button', { name: 'Save here', exact: true })
    .click();
  await expect(page.locator('.toast.toast-warn')).toBeVisible();
  // Both answers are up together: the stack is two toasts deep.
  await expect(page.locator('.toast')).toHaveCount(2);
  const warning = (await page.locator('.toast.toast-warn').last().textContent()) ?? '';
  await expectToastOverSheet(page, warning);

  // Once every toast has gone the stack forgets where it was, so the next one
  // measures the sheet afresh rather than inheriting a stale lift.
  await expect(page.locator('.toast')).toHaveCount(0);
  await expect(page.locator('.toasts')).not.toHaveAttribute('data-place');
}

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
  await expectToastOverSheet(page, 'Slot erased.');
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
  await expectToastOverSheet(page, 'Could not erase');
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

test.describe('toasts raised inside the save sheet', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('show over the sheet at Largest text, clear of its title and footer', async ({ page }) => {
    await toastsFromTheSaveSheet(page, 'toast-over-sheet');
  });
});

/*
 * A phone on its side at Largest text: the sheet runs to its 88dvh cap, so the
 * foot of the screen is the sheet's own footer, Import and Close. The toast
 * has to rise above that footer rather than sit on it.
 */
test.describe('toasts raised inside the save sheet, phone landscape', () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test('stay clear of Import and Close at Largest text', async ({ page }) => {
    await toastsFromTheSaveSheet(page, 'toast-over-sheet-landscape');
  });

  // The pause sheet has no footer to rise above: it keeps its toasts at the
  // foot of the screen rather than hanging them off its top edge.
  test('stay on screen over a sheet with no footer', async ({ page }) => {
    await resetStorage(page);
    await startGame(page, ['Elias'], ['kaya'], 'toast-over-footerless-sheet');
    await enterNode(page, 'village_explore');
    await setLargeText(page, 'huge');
    await page.evaluate(() => window.fnt?.app.openPause());
    const sheet = page.locator('.dialog').last();
    await settleDialog(sheet);
    await expect(sheet.locator('.dialog-footer')).toHaveCount(0);
    await page.evaluate(() => {
      window.fnt?.app.toasts.show('First answer.');
      window.fnt?.app.toasts.show('Second answer.', 'warn');
    });
    await expectToastOverSheet(page, 'Second answer.');
  });
});
