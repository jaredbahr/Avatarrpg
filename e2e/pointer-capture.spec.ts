import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CONTENT } from '../src/content';
import { previewWalk } from '../src/app/world/walking';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

interface CaptureEvent {
  readonly type: string;
  readonly id: number;
  readonly buttons: number;
  readonly trusted: boolean;
  readonly onCanvas: boolean;
}

declare global {
  interface Window {
    captureProtocol: CaptureEvent[];
  }
}

async function camera(page: Page) {
  const value = await page.evaluate(() => window.fnt!.app.rendererCamera());
  if (!value) throw new Error('No mounted map camera');
  return value;
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`lost mouse capture ends a drag and preserves the first next click on ${renderer}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Solo'], ['kaya'], 'capture-loss-proof');
    await enterNode(page, 'village_explore');
    await waitForIdle(page);
    const initialState = await page.evaluate(() => window.fnt!.app.state!);
    await page.evaluate(() => {
      const canvas = document.querySelector('.map-canvas');
      window.captureProtocol = [];
      for (const type of [
        'pointerdown',
        'pointerup',
        'pointercancel',
        'gotpointercapture',
        'lostpointercapture',
      ]) {
        document.addEventListener(
          type,
          (event) => {
            const pointer = event as PointerEvent;
            window.captureProtocol.push({
              type,
              id: pointer.pointerId,
              buttons: pointer.buttons,
              trusted: pointer.isTrusted,
              onCanvas: pointer.target === canvas,
            });
          },
          true,
        );
      }
    });
    const canvas = page.locator('.map-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('No visible map canvas');
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    expect(
      await page.evaluate(
        (point) =>
          document.elementFromPoint(point.x, point.y) === document.querySelector('.map-canvas'),
        start,
      ),
    ).toBe(true);
    const beforeDrag = await camera(page);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 40, start.y + 12);
    const afterDrag = await camera(page);
    expect(afterDrag.groundTransform).not.toEqual(beforeDrag.groundTransform);

    // Release capture for the real browser pointer while its button is held.
    // The subsequent browser events are observed, never manually dispatched.
    const pointerId = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
      const down = window.captureProtocol.find(
        (event) => event.type === 'pointerdown' && event.onCanvas,
      );
      if (!canvas || !down || !canvas.hasPointerCapture(down.id))
        throw new Error('The real mouse press did not acquire pointer capture');
      canvas.releasePointerCapture(down.id);
      return down.id;
    });
    await page.mouse.move(start.x, 5);
    await page.mouse.up();
    const afterLoss = await camera(page);
    const interrupted = await page.evaluate(
      (id) => window.captureProtocol.filter((event) => event.id === id),
      pointerId,
    );
    expect(interrupted).toEqual([
      { type: 'pointerdown', id: pointerId, buttons: 1, trusted: true, onCanvas: true },
      { type: 'gotpointercapture', id: pointerId, buttons: 1, trusted: true, onCanvas: true },
      { type: 'lostpointercapture', id: pointerId, buttons: 1, trusted: true, onCanvas: true },
      { type: 'pointerup', id: pointerId, buttons: 0, trusted: true, onCanvas: false },
    ]);
    expect(await page.evaluate(() => window.fnt!.app.state)).toEqual(initialState);

    await page.mouse.move(start.x + 120, start.y + 70);
    const afterHover = await camera(page);
    // Keep checking the first normal click even when the baseline hover pans.
    expect
      .soft(afterHover, 'hover after capture loss must not continue the drag')
      .toEqual(afterLoss);

    const target = { x: 1, y: 7 };
    const current = await page.evaluate(() => window.fnt!.app.state!);
    const preview = previewWalk(CONTENT, current, target);
    expect(preview.refusal).toBeNull();
    expect(preview.label).toBe('the path');
    expect(preview.path.at(-1)).toEqual(target);
    const point = await paintedTileCentre(page, target);
    if (!point) throw new Error('The road destination has no painted point');
    expect(
      await page.evaluate(
        (point) =>
          document.elementFromPoint(point.x, point.y) === document.querySelector('.map-canvas'),
        point,
      ),
      'the legal road target must be visible',
    ).toBe(true);
    await page.evaluate(() => {
      window.captureProtocol = [];
    });
    // One real click, with its normal capture/up/loss sequence. No recovery click.
    await page.mouse.click(point.x, point.y);
    const normal = await page.evaluate(() => window.captureProtocol);
    await test.info().attach('pointer-capture-protocol', {
      body: JSON.stringify({ interrupted, normal, afterLoss, afterHover }),
      contentType: 'application/json',
    });
    expect(normal.map((event) => event.type)).toEqual([
      'pointerdown',
      'gotpointercapture',
      'pointerup',
      'lostpointercapture',
    ]);
    expect(normal.every((event) => event.trusted && event.onCanvas)).toBe(true);
    expect(normal.find((event) => event.type === 'pointerup')?.buttons).toBe(0);
    expect(normal.find((event) => event.type === 'lostpointercapture')?.buttons).toBe(0);
    await expect
      .poll(() => page.evaluate(() => window.fnt!.app.state?.location.pos))
      .toEqual(target);
    expect(errors).toEqual([]);
  });
}
