import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame } from './helpers';

test('the selected slinger roster keeps its authored tip after reload', async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Sura'], ['sura'], 'variant-tip-2');
  await enterNode(page, 'battle_forest_road');
  expect(await page.evaluate(() => window.fnt!.app.state!.battle!.variantId)).toBe('slingers');
  const advice =
    'Nobody up there wants to come close. Get among them — a slinger with somebody in its face is not much use.';
  await expect(page.getByRole('button', { name: 'Tip', exact: true })).toHaveAttribute(
    'title',
    advice,
  );
  await page.reload();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tip', exact: true })).toHaveAttribute(
    'title',
    advice,
  );
  await page.getByRole('button', { name: 'Tip', exact: true }).click();
  await expect(page.getByText(advice, { exact: true })).toBeVisible();
});
