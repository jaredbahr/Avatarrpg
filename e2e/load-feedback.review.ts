/** Real wait/save/load controls, with feedback observed at the load boundary. */
import { expect, test } from '@playwright/test';
import type { App } from '../src/app/App';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';

interface LoadFeedbackProbe {
  oldText: string | null;
  oldVisible: boolean;
  oldFading: boolean;
  oldConnectedAfter: boolean;
  after: string[];
}

declare global {
  interface Window {
    loadFeedbackProbe?: LoadFeedbackProbe;
  }
}

test('loading Dawn retires discarded Morning feedback and preserves the saved game', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['One'], ['kaya'], 'load-feedback-421', { reduceMotion: false });
  await enterNode(page, 'village_explore');
  await waitForIdle(page);
  await page.getByRole('button', { name: 'Look around', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Look around', exact: true })
    .getByRole('button', { name: /Sit and wait/ })
    .click();
  await waitForIdle(page);
  const seat = page.getByRole('button', { name: "Wait Mira's table", exact: true });
  const wait = page.getByRole('dialog', { name: 'Wait until…', exact: true });
  await seat.click();
  await wait.getByRole('button', { name: 'Evening Later today', exact: true }).click();
  await seat.click();
  await wait.getByRole('button', { name: 'Dawn Tomorrow', exact: true }).click();
  const saved = await page.evaluate(() => window.fnt!.app.state);
  expect(saved?.world.clock).toEqual({ day: 2, phase: 'dawn' });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const save = page.getByRole('dialog', { name: 'Save game', exact: true });
  await save.getByRole('button', { name: 'Save here', exact: true }).first().click();
  await save.getByRole('button', { name: 'Close', exact: true }).click();

  await page.evaluate(() => {
    const app = window.fnt!.app;
    const adopt = app.adoptSave;
    app.adoptSave = function (...args: Parameters<App['adoptSave']>) {
      const old = [...document.querySelectorAll<HTMLElement>('.toasts .toast')].find(
        (node) => node.textContent === 'Morning arrives.',
      );
      const before = {
        oldText: old?.textContent ?? null,
        oldVisible: !!old && old.getBoundingClientRect().height > 0,
        oldFading: !!old?.classList.contains('toast-out'),
      };
      adopt.apply(this, args);
      window.loadFeedbackProbe = {
        ...before,
        oldConnectedAfter: !!old?.isConnected,
        after: [...document.querySelectorAll('.toasts .toast')].map(
          (node) => node.textContent ?? '',
        ),
      };
    };
  });
  await seat.click();
  // Activate real controls in one browser task. A software renderer cannot
  // consume the toast's lifetime between automation round trips. No game or
  // timer mutation; the wrapper records whether it was visible and unfaded.
  await page.evaluate(() => {
    const click = (root: ParentNode, label: string) => {
      const button = [...root.querySelectorAll<HTMLButtonElement>('button')].find(
        (candidate) => candidate.textContent?.trim() === label,
      );
      if (!button || button.disabled) throw new Error(`Missing enabled ${label}`);
      button.click();
    };
    const morning = [...document.querySelectorAll<HTMLButtonElement>('.wait-options button')].find(
      (button) => button.querySelector('strong')?.textContent === 'Morning',
    );
    if (!morning || morning.disabled) throw new Error('Missing real Morning wait offer');
    morning.click();
    click(document, 'Pause');
    click(document, 'Load game');
    const slot = [...document.querySelectorAll('.dialog .slot')].find(
      (row) => row.querySelector('strong')?.textContent === 'Slot 1',
    );
    if (!slot) throw new Error('Missing real saved Slot 1');
    click(slot, 'Load');
  });
  const boundary = await page.evaluate(() => window.loadFeedbackProbe);
  await info.attach('load-feedback-boundary', {
    body: JSON.stringify(boundary),
    contentType: 'application/json',
  });
  expect(boundary?.oldText).toBe('Morning arrives.');
  expect(boundary?.oldVisible, 'old feedback must still be visible at the load boundary').toBe(
    true,
  );
  expect(boundary?.oldFading, 'natural expiry must not mask the result').toBe(false);
  expect(boundary?.oldConnectedAfter).toBe(false);
  expect(boundary?.after).toEqual(['Game loaded.']);
  expect(await page.evaluate(() => window.fnt!.app.state)).toEqual(saved);
  await page.getByRole('button', { name: 'Travel journal', exact: true }).click();
  const journal = page.getByRole('dialog', { name: 'Travel journal', exact: true });
  await expect(journal.locator('.explore-phase')).toHaveText('Dawn');
  await journal.getByRole('button', { name: 'Close journal', exact: true }).click();
  await seat.click();
  await wait.getByRole('button', { name: 'Morning Later today', exact: true }).click();
  await expect(
    page.locator('.toasts .toast').filter({ hasText: 'Morning arrives.' }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.fnt!.app.state?.world.clock)).toEqual({
    day: 2,
    phase: 'morning',
  });
  await page.screenshot({ path: info.outputPath('fresh-morning-feedback.png') });
  expect(errors).toEqual([]);
});
