import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { resetStorage, settleDialog } from './helpers';

const profiles = [
  { name: 'desktop', viewport: { width: 1368, height: 912 }, text: 'off' },
  { name: 'compact Largest', viewport: { width: 390, height: 844 }, text: 'huge' },
] as const;
const changes = [
  { name: 'text size', role: 'radio', label: 'Large', field: 'largeText', value: 'on' },
  { name: 'sound', role: 'radio', label: 'Off', field: 'volume', value: 0 },
  {
    name: 'reduce motion',
    role: 'switch',
    label: 'Reduce motion',
    field: 'reduceMotion',
    value: false,
  },
  {
    name: 'patterned ground',
    role: 'switch',
    label: 'Patterned ground',
    field: 'hatchSurfaces',
    value: true,
  },
  {
    name: 'contrast',
    role: 'switch',
    label: 'Higher contrast',
    field: 'highContrast',
    value: true,
  },
  { name: 'grid', role: 'switch', label: 'Show grid', field: 'showGrid', value: true },
] as const;

async function tabTo(page: Page, target: Locator) {
  await expect(target).toHaveCount(1);
  for (let step = 0; step < 40; step++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('Keyboard could not reach the Settings control');
}

async function openSettings(page: Page) {
  const opener = page.getByRole('button', { name: 'Settings', exact: true });
  await tabTo(page, opener);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await settleDialog(dialog);
  await expect(dialog.getByRole('heading', { name: 'Settings', exact: true })).toBeFocused();
  return dialog;
}

for (const profile of profiles)
  test.describe(profile.name, () => {
    test.use({ viewport: profile.viewport });
    test.beforeEach(async ({ page }) => {
      // Existing title hook holds an approved painting while testing controls.
      await resetStorage(page, '?renderer=canvas&titleArt=a&titleArtHold=0');
      await page.evaluate(
        (largeText) => window.fnt!.app.updateSettings({ largeText, reduceMotion: true }),
        profile.text,
      );
    });
    for (const close of ['Done', 'Escape'] as const) {
      for (const change of [null, ...changes])
        test(`${change?.name ?? 'unchanged settings'} returns its live opener after ${close}`, async ({
          page,
        }, info) => {
          const errors: string[] = [];
          page.on('pageerror', (error) => errors.push(error.message));
          const before = await page.evaluate(() => ({
            settings: window.fnt!.app.settings,
            state: window.fnt!.app.state,
          }));
          const dialog = await openSettings(page);
          const oldOpener = await page
            .getByRole('button', { name: 'Settings', exact: true })
            .elementHandle();
          if (!oldOpener) throw new Error('Missing original opener');
          if (change) {
            const control =
              change.field === 'volume'
                ? dialog
                    .getByRole('radiogroup', { name: 'Sound', exact: true })
                    .getByRole(change.role, { name: change.label, exact: true })
                : dialog.getByRole(change.role, { name: change.label, exact: true });
            await tabTo(page, control);
            await page.keyboard.press('Enter');
            await expect(
              dialog.getByRole('heading', { name: 'Settings', exact: true }),
            ).toBeFocused();
            expect(
              await oldOpener.evaluate((element) => element.isConnected),
              'the real title rerender replaced the opener',
            ).toBe(false);
          }
          const expected = change
            ? { ...before.settings, [change.field]: change.value }
            : before.settings;
          expect(await page.evaluate(() => window.fnt!.app.settings)).toEqual(expected);
          if (close === 'Done') {
            await tabTo(page, dialog.getByRole('button', { name: 'Done', exact: true }));
            await page.keyboard.press('Enter');
          } else await page.keyboard.press('Escape');
          await expect(dialog).toHaveCount(0);
          const opener = page.getByRole('button', { name: 'Settings', exact: true });
          await expect(opener).toBeFocused();
          await expect(opener).toBeInViewport();
          const focus = await opener.evaluate((button) => {
            const box = button.getBoundingClientRect();
            return {
              focusVisible: button.matches(':focus-visible'),
              outline: Number.parseFloat(getComputedStyle(button).outlineWidth),
              hit: button.contains(
                document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
              ),
            };
          });
          expect(focus.focusVisible).toBe(true);
          expect(focus.outline).toBeGreaterThanOrEqual(3);
          expect(focus.hit).toBe(true);
          await info.attach('restored-title-focus', {
            body: JSON.stringify({
              profile: profile.name,
              close,
              change: change?.name,
              focus,
              settings: expected,
            }),
            contentType: 'application/json',
          });
          await page.screenshot({ path: info.outputPath('restored-opener.png') });
          // No navigation or injected focus between closing and reopening.
          await page.keyboard.press('Enter');
          await expect(dialog).toBeVisible();
          await page.keyboard.press('Escape');
          await expect(opener).toBeFocused();
          expect(await page.evaluate(() => window.fnt!.app.state)).toEqual(before.state);
          await page.reload();
          await page.waitForFunction(() => Boolean(window.fnt?.app));
          expect(await page.evaluate(() => window.fnt!.app.settings)).toEqual(expected);
          expect(errors).toEqual([]);
        });
    }
    test('closing a stale title sheet does not steal connected foreground focus', async ({
      page,
    }) => {
      const dialog = await openSettings(page);
      await tabTo(page, dialog.getByRole('radio', { name: 'Large', exact: true }));
      await page.keyboard.press('Enter');
      // Isolated guard fixture: model another UI operation choosing a connected
      // foreground target while a sheet is closing. Main flows above use only Tab.
      const target = page.getByRole('button', { name: 'New game', exact: true });
      await target.focus();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(target).toBeFocused();
    });
    test('a Settings sheet cannot restore an unmounted title opener', async ({ page }) => {
      const dialog = await openSettings(page);
      await tabTo(page, dialog.getByRole('radio', { name: 'Large', exact: true }));
      await page.keyboard.press('Enter');
      // Lifecycle fixture deliberately changes scene without pretending this is
      // possible through the modal's normal navigation.
      await page.evaluate(() => window.fnt!.app.goToSetup());
      const target = page.getByRole('button', { name: '1 player', exact: true });
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
      await expect(page.locator('.title-scene')).toHaveCount(0);
      await page.keyboard.press('Tab');
      await expect(target).toBeFocused();
    });
    test('a background Settings close leaves another modal in charge', async ({ page }) => {
      const dialog = await openSettings(page);
      await tabTo(page, dialog.getByRole('radio', { name: 'Large', exact: true }));
      await page.keyboard.press('Enter');
      // Isolated lifecycle fixture: another modal has mounted while an older
      // sheet is closed programmatically. This is not a player-input proof.
      await dialog.evaluate((sheet) => {
        const other = document.createElement('div');
        other.setAttribute('role', 'dialog');
        other.setAttribute('aria-modal', 'true');
        other.setAttribute('aria-label', 'Foreground modal fixture');
        other.textContent = 'Foreground modal fixture';
        sheet.closest('.overlay-host')!.appendChild(other);
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        const done = [...sheet.querySelectorAll('button')].find(
          (button) => button.textContent === 'Done',
        );
        if (!done) throw new Error('Missing Settings close action');
        done.click();
      });
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole('dialog', { name: 'Foreground modal fixture' })).toHaveCount(1);
      expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
      await expect(page.getByRole('button', { name: 'Settings', exact: true })).not.toBeFocused();
    });
  });
