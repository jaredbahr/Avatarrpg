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
    // The press and the release carry the button state the game reads. What
    // `buttons` holds on the two capture notifications is the engine's choice:
    // Chromium copies the held button, WebKit reports none. Their order, pointer
    // and target are the contract, so those are compared on every engine.
    const pressed = (event: CaptureEvent) =>
      event.type === 'pointerdown' || event.type === 'pointerup'
        ? event
        : { ...event, buttons: null };
    expect(interrupted.map(pressed)).toEqual([
      { type: 'pointerdown', id: pointerId, buttons: 1, trusted: true, onCanvas: true },
      { type: 'gotpointercapture', id: pointerId, buttons: null, trusted: true, onCanvas: true },
      { type: 'lostpointercapture', id: pointerId, buttons: null, trusted: true, onCanvas: true },
      { type: 'pointerup', id: pointerId, buttons: 0, trusted: true, onCanvas: false },
    ]);
    expect(await page.evaluate(() => window.fnt!.app.state)).toEqual(initialState);

    await page.mouse.move(start.x + 120, start.y + 70);
    const afterHover = await camera(page);
    // Keep checking the first normal click even when the baseline hover pans.
    expect
      .soft(afterHover, 'hover after capture loss must not continue the drag')
      .toEqual(afterLoss);

    // The nearest open cell a few steps away that the party can walk to and that shows on the
    // canvas. It was a fixed road cell on the old village; the rebuilt Ba Dan (#875) moved it.
    const current = await page.evaluate(() => window.fnt!.app.state!);
    const map = CONTENT.maps.get(current.location.mapId);
    if (!map) throw new Error('No exploration map');
    const from = current.location.pos;
    const cells = map.rows
      .flatMap((row, y) => [...row].map((symbol, x) => ({ symbol, pos: { x, y } })))
      .filter(({ symbol, pos }) => {
        const distance = Math.abs(pos.x - from.x) + Math.abs(pos.y - from.y);
        if (distance < 2 || distance > 5 || map.legend[symbol]?.blocked) return false;
        const preview = previewWalk(CONTENT, current, pos);
        return (
          preview.refusal === null &&
          preview.label === 'the path' &&
          preview.path.at(-1)?.x === pos.x &&
          preview.path.at(-1)?.y === pos.y
        );
      })
      .sort(
        (a, b) =>
          Math.abs(a.pos.x - from.x) +
          Math.abs(a.pos.y - from.y) -
          (Math.abs(b.pos.x - from.x) + Math.abs(b.pos.y - from.y)),
      );
    let target: { x: number; y: number } | null = null;
    let point: { x: number; y: number } | null = null;
    for (const cell of cells) {
      const painted = await paintedTileCentre(page, cell.pos);
      if (
        painted &&
        (await page.evaluate(
          (p) => document.elementFromPoint(p.x, p.y) === document.querySelector('.map-canvas'),
          painted,
        ))
      ) {
        target = cell.pos;
        point = painted;
        break;
      }
    }
    expect(target, 'a legal walk target must be visible').not.toBeNull();
    if (!target || !point) throw new Error('No visible legal walk target');
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
