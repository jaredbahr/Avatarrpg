import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame } from './helpers';

for (const renderer of ['canvas', 'webgl']) {
  test(`riverside discovery, forms and campaign preservation (${renderer})`, async ({ page }) => {
    // The WebGL CI runner rasterises in software; the same gallery form
    // takes two minutes there and five seconds on Canvas.
    if (renderer === 'webgl') test.slow();
    const timeout = renderer === 'webgl' ? 30_000 : 10_000;
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Jared'], ['bo'], 'campaign-to-preserve', { reduceMotion: false });
    const before = await page.evaluate(() => {
      const app = window.fnt!.app;
      app.saveTo('slot1');
      app.saveTo('auto');
      return {
        state: JSON.stringify(app.state),
        session: JSON.stringify(app.session.toMeta()),
        storage: JSON.stringify(localStorage),
      };
    });
    await page.evaluate(() => window.fnt!.app.startVillagePreview());
    await expect(page.getByRole('button', { name: 'Water form', exact: true })).toBeVisible();
    await expect(page.locator('.village-life-canvas')).toHaveCount(1);
    await page.getByRole('button', { name: 'Meet Pebble', exact: true }).click();
    await expect(page.locator('.village-note')).toContainText('Pebble leans');
    await page.getByRole('button', { name: 'Tea break', exact: true }).click();
    await expect(page.locator('.village-note')).toContainText('jasmine tea');
    await page.getByRole('button', { name: 'Visit the shrine', exact: true }).click();
    await expect(page.locator('.dialogue-scene')).toBeVisible({ timeout });
    for (let i = 0; i < 3; i++) {
      await expect(page.locator('.line-count')).toHaveText(`${i + 1} of 3`);
      await page
        .locator('button')
        .filter({ hasText: /^(Next|Continue)$/ })
        .click();
    }
    await expect(page.locator('.village-caption')).toContainText('3/3');
    await page.getByRole('button', { name: "Dorin's drill", exact: true }).click();
    await expect(page.locator('.village-note')).toContainText('sets a rhythm');
    for (const name of ['Water form', 'Fire form', 'Water form']) {
      await page.getByRole('button', { name, exact: true }).click();
      await expect(page.getByRole('button', { name: 'Wave', exact: true })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Wave', exact: true })).toBeEnabled();
    }
    await expect(page.locator('.village-note')).toContainText('Nicely done');
    expect(await page.evaluate(() => window.fnt!.app.saveTo('slot1'))).toBe(false);
    await page.getByRole('button', { name: 'Leave preview', exact: true }).click();
    const after = await page.evaluate(() => {
      const app = window.fnt!.app;
      return {
        state: JSON.stringify(app.state),
        session: JSON.stringify(app.session.toMeta()),
        storage: JSON.stringify(localStorage),
      };
    });
    expect(after).toEqual(before);
    expect(errors).toEqual([]);
    await expect(
      page.getByRole('button', { name: 'Explore the riverside', exact: true }),
    ).toBeVisible();
  });
}

test('preview can be left through Pause after returning to the main village', async ({ page }) => {
  await resetStorage(page);
  await page.getByRole('button', { name: 'Explore the riverside', exact: true }).click();
  await page.getByRole('button', { name: 'Try a battle', exact: true }).click();
  await expect(page.locator('.combat-scene')).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Return to the riverside', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Water form', exact: true })).toBeVisible();
  await enterNode(page, 'village_explore');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save game', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Leave preview', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Explore the riverside', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.fnt!.app.previewActive)).toBe(false);
});
