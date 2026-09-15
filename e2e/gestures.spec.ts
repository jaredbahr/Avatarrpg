import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, startGame, takeTurn, waitForIdle } from './helpers';

/**
 * Pinch, pan and Recentre.
 *
 * Playwright cannot synthesise a real two-finger pinch, so these specs
 * dispatch Pointer Events at the canvas with two pointer ids — the same events
 * the recogniser sees from a real screen — and read the camera back through
 * the app. The recogniser's own state machine is unit-tested in vitest; what
 * this covers is the wiring from a gesture to the camera to the HUD.
 */

interface CameraInfo {
  tilePx: number;
  offsetX: number;
  offsetY: number;
}

interface Point {
  x: number;
  y: number;
}

async function camera(page: Page): Promise<CameraInfo> {
  const info = await page.evaluate(() => window.fnt?.app.rendererCamera() ?? null);
  expect(info, 'no map scene mounted').not.toBeNull();
  return info as CameraInfo;
}

/** Canvas-local point at the centre of the tile under the canvas's middle. */
async function centreTile(page: Page): Promise<{ point: Point; tile: Point }> {
  const cam = await camera(page);
  const box = await page.locator('.map-canvas').boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error('no canvas');
  const mid = { x: box.width / 2, y: box.height / 2 };
  const tile = {
    x: Math.floor((mid.x + cam.offsetX) / cam.tilePx),
    y: Math.floor((mid.y + cam.offsetY) / cam.tilePx),
  };
  const point = {
    x: (tile.x + 0.5) * cam.tilePx - cam.offsetX,
    y: (tile.y + 0.5) * cam.tilePx - cam.offsetY,
  };
  return { point, tile };
}

async function tileAt(page: Page, point: Point): Promise<Point> {
  const cam = await camera(page);
  return {
    x: Math.floor((point.x + cam.offsetX) / cam.tilePx),
    y: Math.floor((point.y + cam.offsetY) / cam.tilePx),
  };
}

/** Two fingers travelling from `from` to `to`, in canvas-local pixels. */
async function pinch(page: Page, from: [Point, Point], to: [Point, Point]): Promise<void> {
  await page.evaluate(
    ({ from, to }) => {
      const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
      if (!canvas) throw new Error('no canvas');
      const rect = canvas.getBoundingClientRect();
      const fire = (type: string, id: number, p: { x: number; y: number }) =>
        canvas.dispatchEvent(
          new PointerEvent(type, {
            pointerId: id,
            pointerType: 'touch',
            isPrimary: id === 1,
            clientX: rect.left + p.x,
            clientY: rect.top + p.y,
            button: 0,
            buttons: 1,
            bubbles: true,
            cancelable: true,
          }),
        );
      const lerp = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      });
      fire('pointerdown', 1, from[0]);
      fire('pointerdown', 2, from[1]);
      for (let i = 1; i <= 8; i++) {
        fire('pointermove', 1, lerp(from[0], to[0], i / 8));
        fire('pointermove', 2, lerp(from[1], to[1], i / 8));
      }
      fire('pointerup', 1, to[0]);
      fire('pointerup', 2, to[1]);
    },
    { from, to },
  );
}

/** One finger travelling from `from` to `to`. */
async function swipe(page: Page, from: Point, to: Point): Promise<void> {
  await page.evaluate(
    ({ from, to }) => {
      const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
      if (!canvas) throw new Error('no canvas');
      const rect = canvas.getBoundingClientRect();
      const fire = (type: string, p: { x: number; y: number }) =>
        canvas.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 1,
            pointerType: 'touch',
            isPrimary: true,
            clientX: rect.left + p.x,
            clientY: rect.top + p.y,
            button: 0,
            buttons: 1,
            bubbles: true,
            cancelable: true,
          }),
        );
      fire('pointerdown', from);
      for (let i = 1; i <= 6; i++) {
        fire('pointermove', {
          x: from.x + ((to.x - from.x) * i) / 6,
          y: from.y + ((to.y - from.y) * i) / 6,
        });
      }
      fire('pointerup', to);
    },
    { from, to },
  );
}

async function openFight(page: Page): Promise<void> {
  await resetStorage(page);
  await startGame(page, ['Elias'], ['kaya'], 'gestures-spec');
  await enterNode(page, 'battle_forest_road');
  await takeTurn(page);
  await waitForIdle(page);
}

test.describe('zoom and pan', () => {
  test('a pinch zooms in around the fingers and offers Recentre', async ({ page }) => {
    await openFight(page);
    const before = await camera(page);
    const { point, tile } = await centreTile(page);
    const recentre = page.getByRole('button', { name: /^Recentre$/ });
    await expect(recentre).toBeHidden();

    await pinch(
      page,
      [
        { x: point.x - 40, y: point.y },
        { x: point.x + 40, y: point.y },
      ],
      [
        { x: point.x - 100, y: point.y },
        { x: point.x + 100, y: point.y },
      ],
    );

    const after = await camera(page);
    expect(after.tilePx).toBeGreaterThan(before.tilePx * 1.5);
    // The tile that was under the pinch is still under it.
    expect(await tileAt(page, point)).toEqual(tile);
    await expect(recentre).toBeVisible();
  });

  test('a drag pans only once the board no longer fits', async ({ page }) => {
    await openFight(page);
    const fitted = await camera(page);

    await swipe(page, { x: 200, y: 200 }, { x: 120, y: 160 });
    const still = await camera(page);
    expect(still.offsetX).toBeCloseTo(fitted.offsetX, 3);
    expect(still.offsetY).toBeCloseTo(fitted.offsetY, 3);

    const { point } = await centreTile(page);
    await pinch(
      page,
      [
        { x: point.x - 30, y: point.y },
        { x: point.x + 30, y: point.y },
      ],
      [
        { x: point.x - 90, y: point.y },
        { x: point.x + 90, y: point.y },
      ],
    );
    const zoomed = await camera(page);
    await swipe(page, { x: point.x, y: point.y }, { x: point.x - 80, y: point.y - 40 });
    const panned = await camera(page);
    expect(panned.tilePx).toBeCloseTo(zoomed.tilePx, 3);
    expect(panned.offsetX).toBeGreaterThan(zoomed.offsetX);
    expect(panned.offsetY).toBeGreaterThan(zoomed.offsetY);
  });

  test('Recentre puts the whole board back and hides itself', async ({ page }) => {
    await openFight(page);
    const fitted = await camera(page);
    const { point } = await centreTile(page);
    await pinch(
      page,
      [
        { x: point.x - 30, y: point.y },
        { x: point.x + 30, y: point.y },
      ],
      [
        { x: point.x - 90, y: point.y },
        { x: point.x + 90, y: point.y },
      ],
    );
    const recentre = page.getByRole('button', { name: /^Recentre$/ });
    await expect(recentre).toBeVisible();
    await recentre.click();
    const back = await camera(page);
    expect(back.tilePx).toBeCloseTo(fitted.tilePx, 3);
    await expect(recentre).toBeHidden();
  });

  test('a trackpad pinch (ctrl+wheel) zooms too', async ({ page }) => {
    await openFight(page);
    const before = await camera(page);
    await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
      if (!canvas) throw new Error('no canvas');
      const rect = canvas.getBoundingClientRect();
      for (let i = 0; i < 10; i++) {
        canvas.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY: -40,
            ctrlKey: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            bubbles: true,
            cancelable: true,
          }),
        );
      }
    });
    const after = await camera(page);
    expect(after.tilePx).toBeGreaterThan(before.tilePx * 1.2);
  });

  test('the fitted tile is never smaller than a fingertip and the acting unit is on screen', async ({
    page,
  }) => {
    await openFight(page);
    const cam = await camera(page);
    expect(cam.tilePx).toBeGreaterThanOrEqual(40 - 0.5);

    const box = await page.locator('.map-canvas').boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    const pos = await page.evaluate(() => {
      const battle = window.fnt?.app.state?.battle;
      const unit = battle?.units.find((u) => u.id === battle.order[battle.turnIndex]);
      return unit ? { x: unit.pos.x, y: unit.pos.y } : null;
    });
    expect(pos).not.toBeNull();
    if (!pos) return;
    const left = pos.x * cam.tilePx - cam.offsetX;
    const top = pos.y * cam.tilePx - cam.offsetY;
    expect(left).toBeGreaterThanOrEqual(-0.5);
    expect(top).toBeGreaterThanOrEqual(-0.5);
    expect(left + cam.tilePx).toBeLessThanOrEqual(box.width + 0.5);
    expect(top + cam.tilePx).toBeLessThanOrEqual(box.height + 0.5);
  });
});
