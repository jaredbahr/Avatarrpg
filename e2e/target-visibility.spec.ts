import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';

const target = { x: 13, y: 5 };

async function battleSnapshot(page: Page) {
  return page.evaluate(() => JSON.stringify(window.fnt!.app.state!.battle));
}

/** Read one coherent painted frame without separate slow software-WebGL
 * round trips for projection, canvas bounds, camera and center hit testing. */
async function targetGeometry(page: Page) {
  return page.evaluate((p) => {
    const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
    const camera = window.fnt?.app.rendererCamera();
    if (!canvas || !camera) throw new Error('Missing battlefield geometry');
    const rect = canvas.getBoundingClientRect();
    const m = camera.groundTransform;
    const x = (p.x + 0.5) * 64,
      y = (p.y + 0.5) * 64;
    const dpr = window.devicePixelRatio || 1;
    // Same backing-store stretch as paintedTileCentre in projection.ts.
    const point = {
      x: rect.left + ((m.a * x + m.c * y + m.tx) * rect.width) / (canvas.width / dpr),
      y: rect.top + ((m.b * x + m.d * y + m.ty) * rect.height) / (canvas.height / dpr),
    };
    const hit = document.elementFromPoint(point.x, point.y);
    return {
      point,
      box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      camera: { x: camera.offsetX, y: camera.offsetY },
      hit: { canvas: hit === canvas, html: hit?.outerHTML.slice(0, 250) },
    };
  }, target);
}

async function reachableButton(button: Locator) {
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  const box = await button.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      width: r.width,
      height: r.height,
      centerHit: el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)),
    };
  });
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.centerHit).toBe(true);
}

async function tapTarget(page: Page) {
  await settleLayout(page);
  const { point, box, hit } = await targetGeometry(page);
  expect(box.height).toBeGreaterThan(0);
  expect(point.x).toBeGreaterThan(box.x);
  expect(point.x).toBeLessThan(box.x + box.width);
  expect(point.y).toBeGreaterThan(box.y);
  expect(point.y).toBeLessThan(box.y + box.height);
  expect(hit.canvas, `Target intercepted by ${hit.html}`).toBe(true);
  await page.touchscreen.tap(point.x, point.y);
  await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeEnabled();
}

/** Drag the canvas through the real pointer adapter without eight Playwright
 * mouse round trips; software WebGL can spend a full frame per move. Points
 * are page viewport coordinates, matching `boundingBox()` and painted hits. */
async function dragCanvas(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.evaluate(
    ({ from, to }) => {
      const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
      if (!canvas) throw new Error('Missing battlefield canvas');
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

for (const renderer of ['canvas', 'webgl'] as const) {
  for (const narrow of [false, true]) {
    test(`Fire Jab target stays tappable with separate decisions on ${renderer}${narrow ? ' at huge phone text' : ' at desktop lower edge'}`, async ({
      page,
    }) => {
      // Forced WebGL on the CI software rasterizer can spend a full frame on
      // each camera settle and pointer readback. The assertions remain the
      // same; give this renderer the same measured slow-project allowance as
      // the pan/reflow regression without relaxing the suite globally.
      if (renderer === 'webgl') test.slow();
      await page.setViewportSize(
        narrow ? { width: 390, height: 844 } : { width: 1672, height: 941 },
      );
      await resetStorage(page, `?renderer=${renderer}`);
      await startGame(page, ['Kaya'], ['kaya'], 'target-visibility');
      if (narrow) await page.evaluate(() => window.fnt!.app.updateSettings({ largeText: 'huge' }));
      await enterNode(page, 'battle_forest_road');
      expect(await takeTurn(page)).toBe(true);
      await waitForIdle(page);
      // Staged UI regression, not campaign evidence: reproduce the recorded
      // legal actor/target positions without spending turns walking there.
      const staged = await page.evaluate((spot) => {
        const app = window.fnt!.app;
        const state = app.state!;
        const battle = state.battle!;
        const actor = battle.units.find((u) => u.id === battle.order[battle.turnIndex])!;
        const enemy = battle.units.find((u) => u.faction === 'enemy' && u.hp > 0 && u.size === 1)!;
        app.state = {
          ...state,
          battle: {
            ...battle,
            units: battle.units.map((u) =>
              u.id === actor.id
                ? { ...u, pos: { x: 9, y: 4 } }
                : u.id === enemy.id
                  ? { ...u, pos: spot }
                  : u,
            ),
          },
        };
        return {
          actorId: actor.id,
          enemyName: enemy.name,
          ap: actor.ap,
          cost: app.content.abilities.get('fire_jab')!.apCost,
        };
      }, target);
      await page
        .getByRole('button', { name: `Focus ${staged.enemyName}`, exact: true })
        .first()
        .click();
      const { zoomBefore, selectedZoom } = await page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
        if (!canvas) throw new Error('Missing battlefield canvas');
        const zoomBefore = window.fnt!.app.rendererCamera()!.tilePx;
        const rect = canvas.getBoundingClientRect();
        canvas.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY: -60,
            ctrlKey: true,
            clientX: rect.x + rect.width / 2,
            clientY: rect.y + rect.height / 2,
            bubbles: true,
            cancelable: true,
          }),
        );
        return { zoomBefore, selectedZoom: window.fnt!.app.rendererCamera()!.tilePx };
      });
      expect(selectedZoom).toBeGreaterThan(zoomBefore);
      await page.getByRole('button', { name: /Fire Jab/i }).click();
      await settleLayout(page);
      await expect(page.locator('.toast')).toHaveCount(0, { timeout: 10000 });
      if (!narrow) {
        // Keep the actual target near the lower map edge, where the old aim
        // guidance intercepted it. Pan through the real input adapter; do not
        // depend on fixed camera offsets or the implementation's dock classes.
        const { point, box, camera: beforePan } = await targetGeometry(page);
        const dx = box.x + box.width * 0.67 - point.x;
        const dy = box.y + box.height - 84 - point.y;
        const from = { x: box.x + box.width * 0.3, y: box.y + 80 };
        await dragCanvas(page, from, { x: from.x + dx, y: from.y + dy });
        await settleLayout(page);
        const { point: pannedPoint, box: pannedBox, camera: afterPan } = await targetGeometry(page);
        expect(afterPan.x !== beforePan.x || afterPan.y !== beforePan.y).toBe(true);
        expect(pannedPoint.y).toBeGreaterThan(pannedBox.y + pannedBox.height - 140);
      }
      const before = await battleSnapshot(page);
      await tapTarget(page);
      expect(await battleSnapshot(page), 'A target tap must only preview').toBe(before);
      await settleLayout(page);
      expect(await page.evaluate(() => window.fnt!.app.rendererCamera()!.tilePx)).toBeCloseTo(
        selectedZoom,
        5,
      );
      const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
      await reachableButton(cancel);
      await cancel.tap();
      expect(await battleSnapshot(page), 'Cancel must not spend AP or resolve an attack').toBe(
        before,
      );
      await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);
      // Cancel retains the selected ability; recompute projection after all
      // preview/HUD reflows instead of clicking a stale painted coordinate.
      await tapTarget(page);
      expect(await battleSnapshot(page)).toBe(before);
      const confirm = page.getByRole('button', { name: 'Confirm', exact: true });
      await reachableButton(confirm);
      await confirm.tap();
      await waitForIdle(page);
      const result = await page.evaluate(
        (id) => ({
          ap: window.fnt!.app.state!.battle!.units.find((u) => u.id === id)!.ap,
          height: document.querySelector('.map-canvas')?.getBoundingClientRect().height,
          scrollWidth: document.documentElement.scrollWidth,
        }),
        staged.actorId,
      );
      expect(result.ap).toBe(staged.ap - staged.cost);
      expect(result.height).toBeGreaterThan(0);
      if (narrow) expect(result.scrollWidth).toBeLessThanOrEqual(390);
    });
  }
}
