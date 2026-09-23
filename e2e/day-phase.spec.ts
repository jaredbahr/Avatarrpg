import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';

/**
 * The time of day in the interface (ADR 0047 W7): the phase label in the
 * header and the journal, the "Wait until…" control at Mira's table and the
 * riverside porch, and a refused wait showing its reason. Night is a label
 * only (D1), so everything here reads text, not pixels.
 */

async function openActivities(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: 'Activities', exact: true });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
}

const clock = (page: Page) => page.evaluate(() => window.fnt!.app.state?.world.clock);

test('the title preview enters in the afternoon and says so', async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await page.getByRole('button', { name: 'Explore the riverside', exact: true }).click();
  await expect(page.locator('.explore-phase')).toHaveText('Afternoon');
  await expect(page.locator('.village-note')).toContainText('Afternoon by the river.');
  expect(await clock(page)).toEqual({ day: 1, phase: 'afternoon' });
  await page.getByRole('button', { name: 'Travel journal', exact: true }).click();
  const journal = page.getByRole('dialog', { name: 'Travel journal', exact: true });
  await expect(journal.locator('.explore-phase')).toHaveText('Afternoon');
  await expect(journal).toContainText('Wait at the tea porch to pass the time.');
});

test('waiting at Mira’s table moves the day on and relabels it', async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Jared'], ['kaya', 'sura'], 'wait-at-the-table');
  await enterNode(page, 'village_explore');
  await expect(page.locator('.explore-phase')).toHaveText('Midday');
  // Away from the table the hotbar keeps Look around.
  await expect(page.getByRole('button', { name: /^Look around/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Wait until…/ })).toHaveCount(0);

  await page.evaluate(() => window.fnt!.app.dispatch({ type: 'walkTo', pos: { x: 10, y: 6 } }));
  await waitForIdle(page);
  const wait = page.getByRole('button', { name: /^Wait until…/ });
  await expect(wait).toContainText("Mira's table");
  await wait.click();
  const dialog = page.getByRole('dialog', { name: 'Wait a while', exact: true });
  const options = dialog.locator('.choice-option');
  // The next five phases, in clock order, the last two tomorrow.
  await expect(options).toHaveCount(5);
  await expect(options.locator('strong')).toHaveText([
    'Afternoon',
    'Evening',
    'Night',
    'Dawn',
    'Morning',
  ]);
  await expect(options.nth(3)).toContainText('Tomorrow');
  await expect(dialog.locator('.is-locked')).toHaveCount(0);
  await options.nth(1).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.explore-phase')).toHaveText('Evening');
  await expect(page.locator('.toast').filter({ hasText: 'Evening falls.' })).toBeVisible();
  expect(await clock(page)).toEqual({ day: 1, phase: 'evening' });

  // Past night the day turns over.
  await page.getByRole('button', { name: /^Wait until…/ }).click();
  await page.getByRole('dialog').locator('.choice-option').filter({ hasText: 'Morning' }).click();
  await expect(page.locator('.explore-phase')).toHaveText('Morning');
  expect(await clock(page)).toEqual({ day: 2, phase: 'morning' });
  await page.getByRole('button', { name: 'Travel journal', exact: true }).click();
  const journal = page.getByRole('dialog', { name: 'Travel journal', exact: true });
  await expect(journal.locator('.explore-phase')).toHaveText('Morning');
  await expect(journal).toContainText("Wait at Mira's table to pass the time.");
});

test('a refused wait shows why and changes nothing', async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await page.getByRole('button', { name: 'Explore the riverside', exact: true }).click();
  await openActivities(page);
  await page.getByRole('button', { name: 'Wait until…', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Wait a while', exact: true });
  // Away from the porch every option is locked for the same reason, said once.
  await expect(dialog.locator('.locked-hint')).toHaveText(['You can wait only at the tea porch.']);
  await expect(dialog.locator('.choice-option.is-locked')).toHaveCount(5);
  for (const option of await dialog.locator('.choice-option').all())
    await expect(option).toBeDisabled();
  await dialog.getByRole('button', { name: 'Back to the path', exact: true }).click();
  expect(await clock(page)).toEqual({ day: 1, phase: 'afternoon' });
  await expect(page.locator('.explore-phase')).toHaveText('Afternoon');
});
