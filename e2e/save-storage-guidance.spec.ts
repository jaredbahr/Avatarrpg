import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { SaveBlob } from '../src/core/save/serialize';
import { enterNode, resetStorage, settleLayout, startGame } from './helpers';

/** Simulates blocked site-data reads, without replacing import/export or the game. */
async function blockStorageReads(page: Page) {
  await page.evaluate(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException('Controlled blocked read', 'SecurityError');
    };
  });
}

async function currentGame(page: Page) {
  return page.evaluate(() => {
    const app = window.fnt?.app;
    if (!app?.state) throw new Error('Expected a running game');
    return { state: app.state, session: app.session.toMeta() };
  });
}

test('blocked title storage recommends the available Import action', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await resetStorage(page, '?renderer=canvas');
  await blockStorageReads(page);
  await page.getByRole('button', { name: 'Load a save', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Load game', exact: true });
  await expect(panel).toBeVisible();
  await settleLayout(page);
  await info.attach('title-guidance', {
    body: JSON.stringify({
      warning: await panel.locator('.warn-note').innerText(),
      buttons: await panel.locator('button').allTextContents(),
      state: await page.evaluate(() => window.fnt?.app.state),
    }),
    contentType: 'application/json',
  });
  await page.screenshot({ path: info.outputPath('blocked-title-load.png') });
  await expect(panel.getByRole('button', { name: 'Export to file', exact: true })).toHaveCount(0);
  const importButton = panel.getByRole('button', { name: 'Import from file', exact: true });
  await expect(importButton).toBeEnabled();
  const chosen = page.waitForEvent('filechooser');
  await importButton.click();
  const chooser = await chosen;
  expect(chooser.isMultiple()).toBe(false);
  // Actual chooser-created input, controlled cancellation; no physical OS chooser claim.
  await chooser.element().evaluate((input) => input.dispatchEvent(new Event('cancel')));
  await expect(panel).toBeVisible();
  expect(await page.evaluate(() => window.fnt?.app.state)).toBeNull();
  expect(errors).toEqual([]);
  await expect(panel.locator('.warn-note')).toContainText('Import a save file instead.');
  await expect(panel.locator('.warn-note')).not.toContainText('Export');
});

for (const mode of ['Save game', 'Load game'] as const) {
  test(`blocked storage during a game retains real Export in ${mode}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await resetStorage(page, '?renderer=canvas');
    await startGame(page, ['Keeper'], ['kaya'], 'save-guidance-regression');
    await enterNode(page, 'village_explore');
    await page.waitForFunction(() => !window.fnt?.app.curtainBusy);
    await blockStorageReads(page);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Paused', exact: true })
      .getByRole('button', { name: mode, exact: true })
      .click();
    const panel = page.getByRole('dialog', { name: mode, exact: true });
    await expect(panel.locator('.warn-note')).toContainText('Export to a file instead.');
    await expect(
      panel.getByRole('button', { name: 'Import from file', exact: true }),
    ).toBeEnabled();
    const exportButton = panel.getByRole('button', { name: 'Export to file', exact: true });
    await expect(exportButton).toBeEnabled();
    const before = await currentGame(page);
    await settleLayout(page);
    await page.screenshot({ path: info.outputPath('blocked-game-save.png') });
    const pending = page.waitForEvent('download');
    await exportButton.click();
    const download = await pending;
    const path = info.outputPath('real-export.json');
    await download.saveAs(path);
    expect(await download.failure()).toBeNull();
    const bytes = await readFile(path);
    expect(bytes.length).toBeGreaterThan(0);
    const blob = JSON.parse(bytes.toString('utf8')) as SaveBlob;
    expect({ state: blob.state, session: blob.session }).toEqual(before);
    expect(await currentGame(page)).toEqual(before);
    expect(errors).toEqual([]);
    await info.attach('actual-export', { path, contentType: 'application/json' });
  });
}
