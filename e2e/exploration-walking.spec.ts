import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';

/** Pointer events use the live camera in the same browser task, even mid-follow. */
async function tapPath(page: Page, x: number, y: number) {
  await page.evaluate(
    ({ x, y }) => {
      const camera = window.fnt?.app.rendererCamera();
      const canvas = document.querySelector('canvas.map-canvas');
      if (!camera || !(canvas instanceof HTMLCanvasElement)) throw new Error('No map');
      const box = canvas.getBoundingClientRect();
      const position = {
        clientX: box.left + camera.offsetX + (x + 0.5) * camera.tilePx,
        clientY: box.top + camera.offsetY + (y + 0.5) * camera.tilePx,
        bubbles: true,
        pointerId: 19,
        pointerType: 'touch',
        isPrimary: true,
      };
      canvas.dispatchEvent(new PointerEvent('pointerdown', { ...position, buttons: 1 }));
      canvas.dispatchEvent(new PointerEvent('pointerup', { ...position, buttons: 0 }));
    },
    { x, y },
  );
}

for (const renderer of ['canvas', 'webgl']) {
  test(`a second ground tap queues one visible walk on ${renderer}`, async ({ page }) => {
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Explorer'], ['kaya', 'bo'], 'queued-walk', { reduceMotion: false });
    await enterNode(page, 'village_explore');
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await tapPath(page, 9, 7);
    await tapPath(page, 7, 8);
    await expect(page.locator('.walk-feedback')).toContainText('Next:');
    expect(await page.evaluate(() => window.fnt?.app.state?.location.pos)).toEqual({ x: 9, y: 7 });
    await page.clock.resume();
    await expect
      .poll(() => page.evaluate(() => window.fnt?.app.state?.location.pos))
      .toEqual({ x: 7, y: 8 });
    await waitForIdle(page);
    await expect(page.locator('.walk-feedback')).toBeHidden();
  });
}

test('cancel and pause discard queued walking without teleporting the current walk', async ({
  page,
}) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Explorer'], ['kaya'], 'cancel-walk', { reduceMotion: false });
  await enterNode(page, 'village_explore');
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await tapPath(page, 9, 7);
  await tapPath(page, 7, 8);
  await page.getByRole('button', { name: 'Cancel next walk' }).dispatchEvent('click');
  await expect(page.locator('.walk-feedback')).toContainText('Following the path');
  await tapPath(page, 7, 8);
  await page.getByRole('button', { name: 'Pause', exact: true }).dispatchEvent('click');
  await page.clock.resume();
  await expect(page.getByRole('button', { name: 'Cancel next walk' })).toBeHidden();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await waitForIdle(page);
  expect(await page.evaluate(() => window.fnt?.app.state?.location.pos)).toEqual({ x: 9, y: 7 });
});

test('looking around leads to a nearby optional conversation', async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Explorer'], ['kaya']);
  await enterNode(page, 'forest_explore');
  await page.evaluate(() => {
    const app = window.fnt?.app;
    if (!app?.state) throw new Error('No game');
    app.state = { ...app.state, location: { mapId: 'forest_road', pos: { x: 1, y: 4 } } };
    app.resync();
  });
  await page.getByRole('button', { name: 'Look around', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Look around' })).toBeVisible();
  await page.getByRole('button', { name: 'Visit Dema, road keeper', exact: true }).click();
  await waitForIdle(page);
  expect(await page.evaluate(() => window.fnt?.app.state?.story.nodeId)).toBe('forest_dema');
});
