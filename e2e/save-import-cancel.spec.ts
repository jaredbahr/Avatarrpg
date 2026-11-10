import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const app = window.fnt?.app;
    if (!app?.state) throw new Error('No game is running');
    return {
      state: app.state,
      session: app.session.toMeta(),
      camera: app.rendererCamera(),
      slots: ['slot1', 'slot2', 'slot3', 'auto'].map((id) =>
        localStorage.getItem(`fnt.save.${id}`),
      ),
    };
  });
}

async function openImportMenu(page: Page, name: 'Save game' | 'Load game') {
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Paused', exact: true })
    .getByRole('button', { name, exact: true })
    .click();
  return page.getByRole('dialog', { name, exact: true });
}

for (const name of ['Save game', 'Load game'] as const) {
  test(`${name} releases cancelled import inputs and can still import another game`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await resetStorage(page, '?renderer=canvas');
    await startGame(page, ['Older'], ['kaya'], `cancel-import-older-${name}`, {
      reduceMotion: false,
    });
    await enterNode(page, 'village_explore');
    await waitForIdle(page);
    const json = await page.evaluate(() => {
      const app = window.fnt?.app;
      if (!app?.saveTo('slot1')) throw new Error('Could not prepare the older save');
      const saved = localStorage.getItem('fnt.save.slot1');
      if (!saved) throw new Error('The older save is missing');
      return saved;
    });
    const older = await snapshot(page);

    await startGame(page, ['Current'], ['bo'], `cancel-import-current-${name}`, {
      reduceMotion: false,
    });
    await enterNode(page, 'village_explore');
    await waitForIdle(page);
    await settleLayout(page);
    const before = await snapshot(page);
    expect(before.state.seed).not.toBe(older.state.seed);
    expect(before.camera).not.toBeNull();
    const inputs = page.locator('input[type="file"]');
    await expect(inputs).toHaveCount(0);
    const observations: Array<{ cycle: number; inputsAfterCancel: number }> = [];

    try {
      const menu = await openImportMenu(page, name);
      expect(await snapshot(page)).toEqual(before);
      for (let cycle = 1; cycle <= 3; cycle += 1) {
        const waiting = page.waitForEvent('filechooser');
        await menu.getByRole('button', { name: 'Import from file', exact: true }).click();
        const chooser = await waiting;
        await expect(inputs).toHaveCount(1);
        // Controlled, untrusted DOM cancel event on the actual chooser input.
        // This does not exercise physical OS picker cancellation. setFiles([])
        // would emit change and hide the missing cancel handler on the baseline.
        await chooser.element().dispatchEvent('cancel', { bubbles: true });
        observations.push({ cycle, inputsAfterCancel: await inputs.count() });
        await expect(inputs).toHaveCount(0);
        // The real no-file answer proves the awaited import completed. Later
        // identical answers may be deduplicated by Toasts' existing 900 ms rule.
        if (cycle === 1) {
          await expect(page.locator('.toast.toast-warn')).toHaveText('No file chosen.');
        }
        await expect(menu).toBeVisible();
        await expect(
          menu.getByRole('button', { name: 'Import from file', exact: true }),
        ).toBeEnabled();
        expect(await snapshot(page)).toEqual(before);
      }
      await info.attach('cancelled-import-menu', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });

      await menu.getByRole('button', { name: 'Close', exact: true }).click();
      await page
        .getByRole('dialog', { name: 'Paused', exact: true })
        .getByRole('button', { name: 'Resume', exact: true })
        .click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(inputs).toHaveCount(0);
      expect(await snapshot(page)).toEqual(before);

      const reopened = await openImportMenu(page, name);
      const waiting = page.waitForEvent('filechooser');
      await reopened.getByRole('button', { name: 'Import from file', exact: true }).click();
      // Positive control uses the original FileReader, parser and adoption path,
      // with real App-written bytes from the distinct older campaign.
      await (
        await waiting
      ).setFiles({
        name: 'older-game.json',
        mimeType: 'application/json',
        buffer: Buffer.from(json),
      });
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(inputs).toHaveCount(0);
      await expect(page.locator('.toast').filter({ hasText: 'Game loaded.' })).toHaveText(
        'Game loaded.',
      );
      const loaded = await snapshot(page);
      expect(loaded.state).toEqual(older.state);
      expect(loaded.session).toEqual(older.session);
      expect(loaded.slots).toEqual(before.slots);
      expect(errors).toEqual([]);
    } finally {
      await info.attach('import-cancel-observations', {
        body: JSON.stringify(
          {
            cancellation: 'Controlled untrusted DOM event; physical OS cancellation untested',
            observations,
            before,
            after: await snapshot(page),
            inputsRemaining: await inputs.count(),
            errors,
          },
          null,
          2,
        ),
        contentType: 'application/json',
      });
      await info.attach('import-cancel-final', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    }
  });
}
