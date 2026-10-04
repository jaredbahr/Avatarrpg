import { expect, test } from '@playwright/test';
import { resetStorage, setLargeText } from './helpers';

test('setup portraits stay large and Confirm remains reachable at 600x900 Huge text', async ({
  page,
}) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await resetStorage(page);
  await setLargeText(page, 'huge');

  await page.getByRole('button', { name: /new game/i }).click();
  await page.getByRole('button', { name: '1 player' }).click();
  await page.getByRole('button', { name: /^Continue$/ }).click();
  await page.locator('input[type=text]').fill('Aster');
  await page.getByRole('button', { name: /^Next$/ }).click();
  await page.locator('.pick-card').first().click();
  await page.getByRole('button', { name: /^Next$/ }).click();

  const portraits = page.locator('.character-card canvas[data-asset]');
  await expect(portraits.first()).toBeVisible();
  const portraitBounds = await portraits.first().boundingBox();
  expect(portraitBounds, 'the character portrait should have a rendered box').not.toBeNull();
  if (!portraitBounds) return;
  expect(Math.min(portraitBounds.width, portraitBounds.height)).toBeGreaterThanOrEqual(120);

  await page.locator('.character-card').first().click();
  const confirm = page.getByRole('button', { name: /^Confirm$/ });
  await expect(confirm).toBeVisible();
  const confirmBounds = await confirm.boundingBox();
  expect(confirmBounds, 'Confirm should have a rendered box').not.toBeNull();
  if (!confirmBounds) return;
  expect(confirmBounds.y).toBeGreaterThanOrEqual(0);
  expect(confirmBounds.y + confirmBounds.height).toBeLessThanOrEqual(900);
});
