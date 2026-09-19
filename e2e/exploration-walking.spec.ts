import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

/** Pointer events use the painted canvas geometry, even mid-follow and at high DPR. */
async function tapPath(page: Page, x: number, y: number) {
  await page.evaluate(
    ({ x, y }) => {
      const camera = window.fnt?.app.rendererCamera();
      const canvas = document.querySelector('canvas.map-canvas');
      if (!camera || !(canvas instanceof HTMLCanvasElement)) throw new Error('No map');
      const box = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const stretchX = box.width / (canvas.width / dpr);
      const stretchY = box.height / (canvas.height / dpr);
      const m = camera.groundTransform;
      const px = (x + 0.5) * 64,
        py = (y + 0.5) * 64;
      const position = {
        clientX: box.left + (m.a * px + m.c * py + m.tx) * stretchX,
        clientY: box.top + (m.b * px + m.d * py + m.ty) * stretchY,
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
    // Install before navigation so setup runs on the real clock. Pause only
    // after the map is settled, with enough headroom for a slow CI browser.
    await page.clock.install();
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Explorer'], ['kaya', 'bo'], 'queued-walk', { reduceMotion: false });
    await enterNode(page, 'village_explore');
    await settleLayout(page);
    await page.clock.pauseAt(Date.now() + 30_000);
    // Publish the frozen map frame before dispatching synthetic touch input.
    await page.clock.runFor(17);
    await tapPath(page, 9, 7);
    // A paused WebKit RAF needs one deterministic tick to publish feedback.
    await page.clock.runFor(17);
    await expect(page.getByRole('button', { name: /^Talk/ })).toBeDisabled();
    await expect(page.locator('.map-wrap .walk-feedback')).toHaveCount(0);
    await expect(page.locator('.explore-context .walk-feedback')).toBeVisible();
    await tapPath(page, 7, 8);
    await page.clock.runFor(17);
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
  // Keep setup on the real clock; freeze only after the settled map is ready.
  await page.clock.install();
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Explorer'], ['kaya'], 'cancel-walk', { reduceMotion: false });
  await enterNode(page, 'village_explore');
  await settleLayout(page);
  await page.clock.pauseAt(Date.now() + 30_000);
  await page.clock.runFor(17);
  await tapPath(page, 9, 7);
  await page.clock.runFor(17);
  await tapPath(page, 7, 8);
  await page.clock.runFor(17);
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
