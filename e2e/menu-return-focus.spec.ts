import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { enterNode, resetStorage, startGame } from './helpers';

test.describe.configure({ retries: 0, timeout: 60_000 });

/** Supported world-conversation setup, not an earned campaign checkpoint. */
async function prepare(page: Page) {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Ava'], ['kaya'], 'settings-return-discovery');
  await enterNode(page, 'village_explore');
  await enterNode(page, 'mira_intro');
  return snapshot(page);
}

async function snapshot(page: Page) {
  return page.evaluate(() => ({
    state: structuredClone(window.fnt!.app.state!),
    session: window.fnt!.app.session.toMeta(),
  }));
}

async function activate(page: Page, control: Locator, key = 'Enter'): Promise<void> {
  await control.focus();
  await page.keyboard.press(key);
}

async function openSettings(page: Page) {
  await activate(page, page.getByRole('button', { name: 'Pause', exact: true }));
  const paused = page.getByRole('dialog', { name: 'Paused', exact: true });
  await activate(page, paused.getByRole('button', { name: 'Settings', exact: true }));
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(settings).toBeVisible();
  return { paused, settings };
}

async function toggleGrid(page: Page, settings: Locator): Promise<void> {
  const toggle = settings.getByRole('switch', { name: 'Show grid', exact: true });
  const was = await toggle.getAttribute('aria-checked');
  await activate(page, toggle, 'Space');
  await expect(toggle).toHaveAttribute('aria-checked', String(was !== 'true'));
  await expect(settings.getByRole('heading', { name: 'Settings', exact: true })).toBeFocused();
}

async function done(page: Page, settings: Locator, paused: Locator): Promise<void> {
  await activate(page, settings.getByRole('button', { name: 'Done', exact: true }));
  await expect(settings).toHaveCount(0);
  await expect(paused.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
}

async function resume(page: Page, paused: Locator): Promise<void> {
  await activate(page, paused.getByRole('button', { name: 'Resume', exact: true }));
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

// Preserve both original keyboard controls and their complete GameState equality oracle.
for (const change of [false, true]) {
  test(`Pause return focus after Settings change=${change}`, async ({ page }, info) => {
    const before = await prepare(page);
    const serializedBefore = JSON.stringify(before.state);
    const pause = page.getByRole('button', { name: 'Pause', exact: true });
    const { paused, settings } = await openSettings(page);
    if (change) await toggleGrid(page, settings);
    await done(page, settings, paused);
    await resume(page, paused);
    expect(await page.evaluate(() => JSON.stringify(window.fnt!.app.state))).toBe(serializedBefore);
    expect(await snapshot(page)).toEqual(before);
    const active = await page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      text: document.activeElement?.textContent?.slice(0, 150),
      connected: document.activeElement?.isConnected,
    }));
    const path = info.outputPath('after-settings-resume.png');
    await page.screenshot({ path });
    await info.attach('after-settings-resume', { path, contentType: 'image/png' });
    await info.attach('focus-observation', {
      body: Buffer.from(JSON.stringify({ change, active, stateUnchanged: true })),
      contentType: 'application/json',
    });
    await expect(
      pause,
      'Resume should restore focus to the same logical Pause control',
    ).toBeFocused();
  });
}

test('text size rebuild returns through Settings to the current Pause button', async ({ page }) => {
  const before = await prepare(page);
  const { paused, settings } = await openSettings(page);
  const large = settings
    .getByRole('radiogroup', { name: 'Text size', exact: true })
    .getByRole('radio', { name: 'Large', exact: true });
  await activate(page, large, 'Space');
  await expect(large).toHaveAttribute('aria-checked', 'true');
  await expect(settings.getByRole('heading', { name: 'Settings', exact: true })).toBeFocused();
  await done(page, settings, paused);
  await resume(page, paused);
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeFocused();
  expect(await snapshot(page)).toEqual(before);
});

test('changing difficulty after a header rebuild still returns focus without restoring old state', async ({
  page,
}) => {
  const before = await prepare(page);
  const { paused, settings } = await openSettings(page);
  // The grid setting detaches the original opener; difficulty then legitimately changes GameState.
  await toggleGrid(page, settings);
  const hard = settings
    .getByRole('radiogroup', { name: 'Difficulty', exact: true })
    .getByRole('radio', { name: 'Hard', exact: true });
  await activate(page, hard, 'Space');
  await expect(hard).toHaveAttribute('aria-checked', 'true');
  await expect(settings.getByRole('heading', { name: 'Settings', exact: true })).toBeFocused();
  await done(page, settings, paused);
  await resume(page, paused);
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeFocused();
  expect(await snapshot(page)).toEqual({
    ...before,
    state: { ...before.state, difficulty: 'hard' },
  });
});

test('Escape closes only the top Settings sheet before returning from Pause', async ({ page }) => {
  const before = await prepare(page);
  const { paused, settings } = await openSettings(page);
  await toggleGrid(page, settings);
  await page.keyboard.press('Escape');
  await expect(settings).toHaveCount(0);
  await expect(paused).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(paused.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeFocused();
  expect(await snapshot(page)).toEqual(before);
});

test('returning from Pause preserves focus already claimed by a connected world control', async ({
  page,
}) => {
  const before = await prepare(page);
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  const { paused, settings } = await openSettings(page);
  await done(page, settings, paused);
  // A controlled focus owner reacts to normal Dialog restoration. The App fallback must respect it.
  await pause.evaluate((node) => {
    const target = document.querySelector<HTMLElement>('[data-conversation-control="next"]');
    if (!target?.isConnected) throw new Error('No connected conversation control');
    node.addEventListener('focus', () => target.focus({ preventScroll: true }), { once: true });
  });
  await resume(page, paused);
  await expect(page.locator('[data-conversation-control="next"]')).toBeFocused();
  expect(await snapshot(page)).toEqual(before);
});

test('actual Load cancels the old header return before replacing the world scene', async ({
  page,
}) => {
  const before = await prepare(page);
  expect(await page.evaluate(() => window.fnt!.app.saveTo('slot1'))).toBe(true);
  const { paused, settings } = await openSettings(page);
  await toggleGrid(page, settings);
  await done(page, settings, paused);
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  const oldPause = await pause.elementHandle();
  if (!oldPause) throw new Error('No current rebuilt Pause button');
  const probe = await page.evaluateHandle(() => ({ oldHeaderFocusEvents: 0 }));
  await pause.evaluate((node, observed) => {
    node.addEventListener('focus', () => observed.oldHeaderFocusEvents++);
  }, probe);
  await activate(page, paused.getByRole('button', { name: 'Load game', exact: true }));
  const load = page.getByRole('dialog', { name: 'Load game', exact: true });
  await activate(
    page,
    load
      .locator('.slot')
      .filter({ hasText: 'Slot 1' })
      .getByRole('button', { name: 'Load', exact: true }),
  );
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await probe.jsonValue()).toEqual({ oldHeaderFocusEvents: 0 });
  expect(await oldPause.evaluate((node) => node.isConnected)).toBe(false);
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect(page.locator('[data-conversation-control="next"]')).toBeFocused();
  expect(await snapshot(page)).toEqual(before);
  await oldPause.dispose();
  await probe.dispose();
});
