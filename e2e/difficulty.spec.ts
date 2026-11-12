import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { resetStorage } from './helpers';

/*
 * The difficulty setting (ADR 0110): picked in party setup, changed in
 * Settings, and kept by the autosave so Continue comes back at the same level.
 */

async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean(window.fnt?.app) && !window.fnt?.app.curtainBusy);
}

async function difficulty(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.fnt?.app.state?.difficulty);
}

async function autosavedDifficulty(page: Page): Promise<string | undefined> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('fnt.save.auto');
    return raw
      ? (JSON.parse(raw) as { state: { difficulty?: string } }).state.difficulty
      : undefined;
  });
}

async function expectChecked(group: Locator, name: string): Promise<void> {
  for (const label of ['Story', 'Hard']) {
    await expect(group.getByRole('radio', { name: label, exact: true })).toHaveAttribute(
      'aria-checked',
      String(label === name),
    );
  }
}

async function openSettings(page: Page): Promise<Locator> {
  await ready(page);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Paused', exact: true })
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  const panel = page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(panel).toBeVisible();
  return panel;
}

test('Hard is picked in party setup, changed in Settings, and kept by Continue', async ({
  page,
}) => {
  await resetStorage(page, '?renderer=canvas');
  await page.getByRole('button', { name: 'New game', exact: true }).click();

  // Story is the default, and the choice is a real radio group.
  const setup = page.getByRole('radiogroup', { name: 'Difficulty', exact: true });
  await expectChecked(setup, 'Story');
  const hard = setup.getByRole('radio', { name: 'Hard', exact: true });
  const box = await hard.boundingBox();
  const tap = await page.evaluate(
    () =>
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize) *
      Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tap')),
  );
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(Math.floor(tap));
  await hard.click();
  await expectChecked(setup, 'Hard');
  await expect(page.getByText(/^Hard: enemies are tougher/)).toBeVisible();

  await page.getByRole('button', { name: 'Start with the suggested party', exact: true }).click();
  await page.waitForFunction(() => window.fnt?.app.state?.screen !== undefined);
  expect(await difficulty(page)).toBe('hard');

  // Settings shows the game's difficulty and changes it straight away.
  const panel = await openSettings(page);
  const row = panel.getByRole('radiogroup', { name: 'Difficulty', exact: true });
  await expectChecked(row, 'Hard');
  await row.getByRole('radio', { name: 'Story', exact: true }).click();
  await expectChecked(row, 'Story');
  expect(await difficulty(page)).toBe('story');
  expect(await autosavedDifficulty(page)).toBe('story');
  await row.getByRole('radio', { name: 'Hard', exact: true }).click();
  await expectChecked(row, 'Hard');
  expect(await autosavedDifficulty(page)).toBe('hard');
  await panel.getByRole('button', { name: 'Done', exact: true }).click();

  // Continue after a reload comes back at Hard.
  await page.reload();
  await ready(page);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForFunction(() => window.fnt?.app.state?.difficulty !== undefined);
  expect(await difficulty(page)).toBe('hard');
});

test('Settings on the title has no difficulty row, since there is no game yet', async ({
  page,
}) => {
  await resetStorage(page, '?renderer=canvas');
  await ready(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('radiogroup', { name: 'Difficulty', exact: true })).toHaveCount(0);
});
