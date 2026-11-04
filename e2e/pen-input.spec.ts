import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CONTENT } from '../src/content';
import { previewWalk } from '../src/app/world/walking';
import { enterNode, resetStorage, startGame, takeTurn, waitForIdle } from './helpers';
import { groundPoint, paintedTileCentre } from './projection';
import type { Point } from './projection';

/** Read-only observations of the real mounted combat scene, without staging game state. */
interface ReadonlyCombatScene {
  readonly mode: { readonly kind: string };
  readonly pending: Point | null;
  readonly reachableCells: () => ReadonlyMap<
    string,
    { readonly pos: Point; readonly cost: number }
  >;
}

async function state(page: Page): Promise<string> {
  return page.evaluate(() => JSON.stringify(window.fnt!.app.state));
}

async function picks(page: Page) {
  return page.evaluate(() => {
    const scene = (window.fnt!.app as unknown as { scene: ReadonlyCombatScene }).scene;
    return { mode: scene.mode, pending: scene.pending };
  });
}

/**
 * Standards-shaped synthetic pen events exercise the canvas adapter. These
 * are browser regressions, not evidence from a physical pen or its driver.
 */
async function penPress(page: Page, tile: Point, button: 0 | 2 | 5): Promise<void> {
  const point = await paintedTileCentre(page, tile);
  expect(point, 'the tile must project onto the mounted canvas').not.toBeNull();
  if (!point) throw new Error('No painted tile point');
  await page.evaluate(
    ({ point, button }) => {
      const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
      if (!canvas) throw new Error('No map canvas');
      if (document.elementFromPoint(point.x, point.y) !== canvas)
        throw new Error('The pen target is outside the visible canvas');
      const common = {
        pointerId: 41,
        pointerType: 'pen',
        isPrimary: true,
        clientX: point.x,
        clientY: point.y,
        width: 1,
        height: 1,
        button,
        bubbles: true,
        cancelable: true,
      };
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          ...common,
          buttons: button === 5 ? 32 : button === 2 ? 2 : 1,
          pressure: button === 2 ? 0 : 0.5,
        }),
      );
      canvas.dispatchEvent(new PointerEvent('pointerup', { ...common, buttons: 0, pressure: 0 }));
    },
    { point, button },
  );
}

async function visibleExploreTarget(page: Page): Promise<Point> {
  const view = await page.evaluate(() => {
    const app = window.fnt!.app;
    const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
    if (!canvas) throw new Error('No exploration canvas');
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    return {
      state: app.state,
      camera: app.rendererCamera(),
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      backing: { width: canvas.width / dpr, height: canvas.height / dpr },
    };
  });
  if (!view.state || !view.camera) throw new Error('No exploration state or camera');
  const current = view.state;
  const camera = view.camera;
  const map = CONTENT.maps.get(current.location.mapId);
  if (!map) throw new Error('No authored exploration map');
  const candidates = map.rows
    .flatMap((row, y) =>
      [...row].flatMap((symbol, x) => {
        if (symbol !== '=') return [];
        const pos = { x, y };
        const distance =
          Math.abs(x - current.location.pos.x) + Math.abs(y - current.location.pos.y);
        if (distance < 2 || distance > 4) return [];
        const preview = previewWalk(CONTENT, current, pos);
        const stop = preview.path.at(-1);
        if (preview.refusal || preview.label !== 'the path' || stop?.x !== x || stop.y !== y)
          return [];
        const local = groundPoint(camera, { x: x + 0.5, y: y + 0.5 });
        return [
          {
            pos,
            point: {
              x: view.rect.left + (local.x * view.rect.width) / view.backing.width,
              y: view.rect.top + (local.y * view.rect.height) / view.backing.height,
            },
            distance,
          },
        ];
      }),
    )
    .sort((a, b) => a.distance - b.distance);
  // A projected road tile can still sit behind the objective or dock in
  // portrait. Pick a legal short walk whose actual page point hits the canvas.
  const target = await page.evaluate((candidates) => {
    const canvas = document.querySelector('.map-canvas');
    return (
      candidates.find(({ point }) => document.elementFromPoint(point.x, point.y) === canvas)?.pos ??
      null
    );
  }, candidates);
  expect(target, 'an authored reachable road tile must be visible').not.toBeNull();
  if (!target) throw new Error('No visible legal exploration destination');
  return target;
}

async function visibleMoveTarget(page: Page): Promise<Point> {
  // A DOM-size check lets ResizeObserver finish the Move HUD reflow without
  // frame-time sampling or a renderer readback.
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    return (
      Math.abs(canvas.width / dpr - rect.width) < 1 &&
      Math.abs(canvas.height / dpr - rect.height) < 1
    );
  });
  const target = await page.evaluate(() => {
    const app = window.fnt!.app;
    const scene = (app as unknown as { scene: ReadonlyCombatScene }).scene;
    const battle = app.state?.battle;
    const camera = app.rendererCamera();
    const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
    if (!battle || !camera || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const m = camera.groundTransform;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    for (const cell of scene.reachableCells().values()) {
      const tile = battle.grid.tiles[cell.pos.y * battle.grid.width + cell.pos.x];
      if (cell.cost <= 0 || !tile || tile.elevation !== 0) continue;
      const x = (cell.pos.x + 0.5) * 64;
      const y = (cell.pos.y + 0.5) * 64;
      const point = {
        x: rect.left + ((m.a * x + m.c * y + m.tx) * rect.width) / (canvas.width / dpr),
        y: rect.top + ((m.b * x + m.d * y + m.ty) * rect.height) / (canvas.height / dpr),
      };
      if (document.elementFromPoint(point.x, point.y) === canvas) return cell.pos;
    }
    return null;
  });
  expect(target, 'an authored legal Move destination must be visible').not.toBeNull();
  if (!target) throw new Error('No visible legal Move destination');
  return target;
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test.describe(`primary pen input on ${renderer}`, () => {
    test.beforeEach(async ({ page }) => {
      await resetStorage(page, `?renderer=${renderer}`);
      await startGame(page, ['Solo'], ['kaya'], 'pen-primary-input');
    });

    test('eraser and barrel presses leave exploration unchanged; the tip walks', async ({
      page,
    }) => {
      await enterNode(page, 'village_explore');
      await waitForIdle(page);
      expect(await page.evaluate(() => window.fnt!.app.state?.location.pos)).toEqual({
        x: 3,
        y: 7,
      });
      const target = await visibleExploreTarget(page);
      const before = await state(page);

      for (const button of [5, 2] as const) {
        await penPress(page, target, button);
        expect(await state(page), `pen button ${button} must not walk`).toBe(before);
        await expect(page.getByRole('dialog')).toHaveCount(0);
      }

      await penPress(page, target, 0);
      await expect
        .poll(() => page.evaluate(() => window.fnt!.app.state?.location.pos))
        .toEqual(target);
      expect(await page.evaluate(() => window.fnt!.app.state?.story.nodeId)).toBe(
        'village_explore',
      );
    });

    test('eraser and barrel presses cannot target a combat move; the tip can', async ({ page }) => {
      await enterNode(page, 'battle_forest_road');
      expect(await takeTurn(page, { settleCamera: false })).toBe(true);
      await waitForIdle(page);
      await page.getByRole('button', { name: /^Move/ }).click();
      const target = await visibleMoveTarget(page);
      const before = await state(page);
      const beforePicks = await picks(page);
      expect(beforePicks).toEqual({ mode: { kind: 'move' }, pending: null });

      for (const button of [5, 2] as const) {
        await penPress(page, target, button);
        expect(await picks(page), `pen button ${button} must not select a target`).toEqual(
          beforePicks,
        );
        expect(await state(page)).toBe(before);
        await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);
      }

      await penPress(page, target, 0);
      expect(await picks(page)).toEqual({ mode: { kind: 'move' }, pending: target });
      expect(await state(page)).toBe(before);
      const confirm = page.getByRole('button', { name: 'Confirm', exact: true });
      await expect(confirm).toBeEnabled();
      await confirm.click();
      expect(
        await page.evaluate(() => {
          const battle = window.fnt!.app.state?.battle;
          return battle?.units.find((unit) => unit.id === battle.order[battle.turnIndex])?.pos;
        }),
      ).toEqual(target);
    });
  });
}
