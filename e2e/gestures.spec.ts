import type { CameraInfo } from '../src/app/App';
import { groundPoint, groundTile, paintedTileCentre } from './projection';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';

/**
 * Pinch, pan and Recentre.
 *
 * Playwright cannot synthesise a real two-finger pinch, so these specs
 * dispatch Pointer Events at the canvas with two pointer ids — the same events
 * the recogniser sees from a real screen — and read the camera back through
 * the app. The recogniser's own state machine is unit-tested in vitest; what
 * this covers is the wiring from a gesture to the camera to the HUD.
 */

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
  const tile = groundTile(cam, mid);
  const point = groundPoint(cam, { x: tile.x + 0.5, y: tile.y + 0.5 });
  return { point, tile };
}

async function tileAt(page: Page, point: Point): Promise<Point> {
  const cam = await camera(page);
  return groundTile(cam, point);
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

async function openFight(page: Page, node = 'battle_forest_road'): Promise<void> {
  await resetStorage(page);
  await startGame(page, ['Elias'], ['kaya'], 'gestures-spec');
  await enterNode(page, node);
  await takeTurn(page);
  await waitForIdle(page);
}

async function openWaterFight(page: Page): Promise<{ id: string; pos: Point }> {
  await resetStorage(page);
  await startGame(page, ['Elias'], ['nilak'], 'gestures-water-spec');
  await enterNode(page, 'battle_forest_road');
  await takeTurn(page);
  await waitForIdle(page);

  const target = await page.evaluate(() => {
    const app = window.fnt?.app;
    const state = app?.state;
    const battle = state?.battle;
    if (!app || !state || !battle) return null;
    const actor = battle.units.find((u) => u.id === battle.order[battle.turnIndex]);
    if (!actor) return null;

    const index = (p: Point) => p.y * battle.grid.width + p.x;
    const open = (p: Point) => {
      if (p.x < 0 || p.y < 0 || p.x >= battle.grid.width || p.y >= battle.grid.height) {
        return false;
      }
      const tile = battle.grid.tiles[index(p)];
      return tile !== undefined && !tile.blocked;
    };
    const spot = open({ x: actor.pos.x + 3, y: actor.pos.y })
      ? { x: actor.pos.x + 3, y: actor.pos.y }
      : { x: actor.pos.x - 3, y: actor.pos.y };
    if (!open(spot)) return null;

    const victim = battle.units.find((u) => u.faction === 'enemy' && u.hp > 0);
    if (!victim) return null;
    const units = battle.units.map((u) => (u.id === victim.id ? { ...u, pos: spot } : u));
    app.state = { ...state, battle: { ...battle, units } };
    return { id: victim.id, pos: spot };
  });

  if (!target) throw new Error('could not stage a water target in range');
  return target;
}

test.describe('zoom and pan', () => {
  test('a pinch zooms in around the fingers and offers Recentre', async ({ page }) => {
    await openFight(page);
    const before = await camera(page);
    expect(before.fitted).toBe(false);
    expect(before.tilePx).toBeGreaterThanOrEqual(96);
    const { point, tile } = await centreTile(page);
    const recentre = page.getByRole('button', { name: /^Recentre$/ });
    await expect(recentre).toBeVisible();

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
    expect(after.fitted).toBe(false);
    // The tile that was under the pinch is still under it.
    expect(await tileAt(page, point)).toEqual(tile);
    await expect(recentre).toBeVisible();
  });

  test('a drag pans only once the board no longer fits', async ({ page }) => {
    // Preserve the fitted orthographic contract alongside readable oblique views.
    await openFight(page, 'battle_ambush');
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

  test('Recentre restores readable oblique combat framing', async ({ page }) => {
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
    expect((await camera(page)).fitted).toBe(false);

    await recentre.click();
    const back = await camera(page);
    expect(back.fitted).toBe(false);
    expect(back.tilePx).toBeCloseTo(fitted.tilePx, 3);
    await expect(recentre).toBeVisible();
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

  test('manual zoom survives a combat log reflow', async ({ page }) => {
    await openFight(page);
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
    await page.getByRole('button', { name: /^Log$/ }).click();
    await expect(page.getByRole('button', { name: /^Hide log$/ })).toBeVisible();
    const withLog = await camera(page);
    expect(withLog.tilePx).toBeCloseTo(zoomed.tilePx, 3);
    await page.getByRole('button', { name: /^Hide log$/ }).click();
    const withoutLog = await camera(page);
    expect(withoutLog.tilePx).toBeCloseTo(zoomed.tilePx, 3);
  });

  test('fitted zoom-out keeps legal water targeting framed through footer reflow', async ({ page }) => {
    const target = await openWaterFight(page);
    // PR64's oblique camera deliberately starts at the 48px preferred tile
    // size, which is larger than the whole-board fit at 1280x720. Use a wide
    // landscape here so the regression reaches the exact fitted state on
    // both camera policies; the normal viewport coverage remains below.
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 1600) {
      await page.setViewportSize({ width: 1600, height: 900 });
      await settleLayout(page);
    }
    const { point } = await centreTile(page);

    // First establish a manual frame, then zoom back out to the whole-board
    // fit. The old `zoomed = !camera.fitted` flag forgot that the player had
    // chosen a frame as soon as this landed on the fit scale.
    await pinch(
      page,
      [
        { x: point.x - 30, y: point.y },
        { x: point.x + 30, y: point.y },
      ],
      [
        { x: point.x - 100, y: point.y },
        { x: point.x + 100, y: point.y },
      ],
    );
    await expect.poll(async () => (await camera(page)).fitted).toBe(false);
    await pinch(
      page,
      [
        { x: point.x - 100, y: point.y },
        { x: point.x + 100, y: point.y },
      ],
      [
        { x: point.x - 18, y: point.y },
        { x: point.x + 18, y: point.y },
      ],
    );
    await expect.poll(async () => (await camera(page)).fitted).toBe(true);
    const fitted = await camera(page);

    await page.getByRole('button', { name: /water whip/i }).click();
    const targetPoint = await paintedTileCentre(page, target.pos);
    expect(targetPoint).not.toBeNull();
    if (!targetPoint) return;
    await page.mouse.click(targetPoint.x, targetPoint.y);
    await expect(page.locator('.confirm-bar').filter({ hasText: /Confirm/ })).toBeVisible();
    const firstFooter = await camera(page);
    expect(firstFooter.tilePx).toBeGreaterThanOrEqual(fitted.tilePx - 0.5);

    await page.getByRole('button', { name: /^Cancel$/ }).click();
    // The cancel affordance backs out of the target but leaves the ability in
    // aim mode; toggle it off and on to model a real cancel/reselect.
    const waterWhip = page.getByRole('button', { name: /water whip/i });
    await waterWhip.click();
    await waterWhip.click();
    await settleLayout(page);
    const secondTargetPoint = await paintedTileCentre(page, target.pos);
    expect(secondTargetPoint).not.toBeNull();
    if (!secondTargetPoint) return;
    await page.mouse.click(secondTargetPoint.x, secondTargetPoint.y);
    await expect(page.locator('.confirm-bar').filter({ hasText: /Confirm/ })).toBeVisible();
    const secondFooter = await camera(page);
    expect(secondFooter.tilePx).toBeCloseTo(firstFooter.tilePx, 3);
  });

  test('partial pan keeps its scale when the active actor changes', async ({ page }) => {
    await openFight(page);
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
    await swipe(page, point, { x: point.x - 38, y: point.y - 24 });
    const panned = await camera(page);
    expect(panned.fitted).toBe(false);

    const activeBefore = await page.evaluate(() => {
      const battle = window.fnt?.app.state?.battle;
      return battle ? battle.order[battle.turnIndex] : null;
    });
    expect(activeBefore).not.toBeNull();
    await page.evaluate(() => {
      const app = window.fnt?.app;
      const battle = app?.state?.battle;
      const unit = battle?.units.find((u) => u.id === battle.order[battle.turnIndex]);
      if (app && unit) app.dispatch({ type: 'endTurn', unitId: unit.id });
    });
    await expect
      .poll(async () => page.evaluate(() => window.fnt?.app.state?.battle?.order[window.fnt?.app.state?.battle?.turnIndex ?? -1]))
      .not.toBe(activeBefore);
    const afterActorChange = await camera(page);
    expect(afterActorChange.tilePx).toBeCloseTo(panned.tilePx, 3);
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
    const corners = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ].map((p) => groundPoint(cam, { x: pos.x + p.x, y: pos.y + p.y }));
    expect(Math.min(...corners.map((p) => p.x))).toBeGreaterThanOrEqual(-0.5);
    expect(Math.min(...corners.map((p) => p.y))).toBeGreaterThanOrEqual(-0.5);
    expect(Math.max(...corners.map((p) => p.x))).toBeLessThanOrEqual(box.width + 0.5);
    expect(Math.max(...corners.map((p) => p.y))).toBeLessThanOrEqual(box.height + 0.5);
  });
});
