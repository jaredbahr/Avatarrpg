import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

type Point = { x: number; y: number };

/** Read one rendered frame, keeping its CSS backing-store stretch coherent. */
async function canvasGeometry(page: Page, pos: Point) {
  return page.evaluate((p) => {
    const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
    const camera = window.fnt?.app.rendererCamera();
    if (!canvas || !camera) return null;
    const frame = canvas.getBoundingClientRect();
    const m = camera.groundTransform;
    const x = (p.x + 0.5) * 64,
      y = (p.y + 0.5) * 64;
    const dpr = window.devicePixelRatio || 1;
    return {
      point: {
        x: frame.left + ((m.a * x + m.c * y + m.tx) * frame.width) / (canvas.width / dpr),
        y: frame.top + ((m.b * x + m.d * y + m.ty) * frame.height) / (canvas.height / dpr),
      },
      frame: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
      tilePx: camera.tilePx,
    };
  }, pos);
}

/** The post-Talk assertion needs the map, panel and state from the same frame. */
async function conversationGeometry(page: Page, pos: Point) {
  return page.evaluate((p) => {
    const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
    const panel = document.querySelector<HTMLElement>('.conversation-panel-compact');
    const camera = window.fnt?.app.rendererCamera();
    const state = window.fnt?.app.state;
    if (!canvas || !panel || !camera || !state) return null;
    const frame = canvas.getBoundingClientRect();
    const panelBox = panel.getBoundingClientRect();
    const m = camera.groundTransform;
    const x = (p.x + 0.5) * 64,
      y = (p.y + 0.5) * 64;
    const dpr = window.devicePixelRatio || 1;
    return {
      point: {
        x: frame.left + ((m.a * x + m.c * y + m.tx) * frame.width) / (canvas.width / dpr),
        y: frame.top + ((m.b * x + m.d * y + m.ty) * frame.height) / (canvas.height / dpr),
      },
      frame: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
      panel: { x: panelBox.x, y: panelBox.y, width: panelBox.width, height: panelBox.height },
      tilePx: camera.tilePx,
      position: state.location.pos,
    };
  }, pos);
}

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
      // The CI trace spent about 55 seconds in ordinary software-WebGL
      // protocol actions before the drag began. Keep the extra budget scoped
      // to this forced renderer; Canvas retains the normal 60-second limit.
      if (renderer === 'webgl') test.slow();
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
      const initial = await canvasGeometry(page, position);
      if (!initial) throw new Error('Missing village canvas');
      await dragCanvas(
        page,
        {
          x: initial.frame.x + initial.frame.width / 2,
          y: initial.frame.y + initial.frame.height - 30,
        },
        { x: initial.frame.x + initial.frame.width / 2, y: initial.frame.y + 30 },
      );
      const panned = await canvasGeometry(page, position);
      if (!panned) throw new Error('Missing panned village canvas');
      expect(panned.point.y - initial.tilePx * 1.5).toBeLessThan(initial.frame.y);

      await page.getByRole('button', { name: 'Talk Elder Mira', exact: true }).click();
      await expect(page.locator('.conversation-panel-compact')).toBeVisible();
      await settleLayout(page);
      const framed = await conversationGeometry(page, position);
      if (!framed) throw new Error('Missing conversation framing');
      expect(framed.tilePx).toBe(initial.tilePx);
      expect(framed.position).toEqual(position);
      // Keep an adult body's head and feet inside the unobscured world, rather
      // than merely proving that some part of the map remains mounted.
      expect(framed.point.y - initial.tilePx * 1.5).toBeGreaterThanOrEqual(framed.frame.y);
      expect(framed.point.y).toBeLessThan(framed.panel.y);
      expect(framed.point.x).toBeGreaterThan(framed.frame.x + initial.tilePx / 2);
      expect(framed.point.x).toBeLessThan(framed.frame.x + framed.frame.width - initial.tilePx / 2);
      await page.screenshot({ path: testInfo.outputPath('conversation-framing.png') });
    });
  }
}
