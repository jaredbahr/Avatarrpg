import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

/**
 * Exercise the canvas's real pointer adapter without asking Playwright to wait
 * for eight browser-composited mouse moves. Forced WebGL on CI uses software
 * rasterization, where each of those moves can take a frame or more.
 */
async function dragCanvas(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await page.evaluate(
    ({ from, to }) => {
      const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
      if (!canvas) throw new Error('Missing village canvas');
      const fire = (type: string, point: { x: number; y: number }) =>
        canvas.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            clientX: point.x,
            clientY: point.y,
            button: 0,
            buttons: type === 'pointerup' ? 0 : 1,
            bubbles: true,
            cancelable: true,
          }),
        );
      fire('pointerdown', from);
      fire('pointermove', to);
      fire('pointerup', to);
    },
    { from, to },
  );
}

for (const renderer of ['canvas', 'webgl']) {
  for (const portrait of [false, true]) {
    test(`talk restores party framing without resetting zoom on ${renderer}/${portrait ? 'portrait-huge' : 'landscape'}`, async ({
      page,
    }, testInfo) => {
      if (portrait) await page.setViewportSize({ width: 834, height: 1194 });
      await resetStorage(page, `?renderer=${renderer}`);
      await startGame(page, ['Framing review'], ['sura'], 'conversation-framing');
      if (portrait)
        await page.evaluate(() => window.fnt!.app.updateSettings({ largeText: 'huge' }));
      await enterNode(page, 'village_explore');
      // A loaded checkpoint already beside Mira: opening Talk must not rely on
      // a walk animation to repair a manually panned camera.
      const position = { x: 10, y: 5 };
      await page.evaluate((pos) => {
        const app = window.fnt!.app;
        const state = app.state!;
        app.state = { ...state, location: { ...state.location, pos } };
        app.resync();
      }, position);
      await waitForIdle(page);
      await page.getByRole('button', { name: 'Follow party', exact: true }).click();
      await settleLayout(page);
      const canvas = page.locator('.map-canvas');
      const box = await canvas.boundingBox();
      if (!box) throw new Error('Missing village canvas');
      const tilePx = await page.evaluate(() => window.fnt!.app.rendererCamera()!.tilePx);
      await dragCanvas(
        page,
        { x: box.x + box.width / 2, y: box.y + box.height - 30 },
        { x: box.x + box.width / 2, y: box.y + 30 },
      );
      const panned = await paintedTileCentre(page, position);
      expect(panned!.y - tilePx * 1.5).toBeLessThan(box.y);

      await page.getByRole('button', { name: 'Talk Elder Mira', exact: true }).click();
      await expect(page.locator('.conversation-panel-compact')).toBeVisible();
      await settleLayout(page);
      const framed = await paintedTileCentre(page, position);
      const frame = await canvas.boundingBox();
      const panel = await page.locator('.conversation-panel-compact').boundingBox();
      if (!framed || !frame || !panel) throw new Error('Missing conversation framing');
      expect(await page.evaluate(() => window.fnt!.app.rendererCamera()!.tilePx)).toBe(tilePx);
      expect(await page.evaluate(() => window.fnt!.app.state!.location.pos)).toEqual(position);
      // Keep an adult body's head and feet inside the unobscured world, rather
      // than merely proving that some part of the map remains mounted.
      expect(framed.y - tilePx * 1.5).toBeGreaterThanOrEqual(frame.y);
      expect(framed.y).toBeLessThan(panel.y);
      expect(framed.x).toBeGreaterThan(frame.x + tilePx / 2);
      expect(framed.x).toBeLessThan(frame.x + frame.width - tilePx / 2);
      await page.screenshot({ path: testInfo.outputPath('conversation-framing.png') });
    });
  }
}
