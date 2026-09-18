import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

const target = { x: 13, y: 5 };

async function battleSnapshot(page: Page) {
  return page.evaluate(() => JSON.stringify(window.fnt!.app.state!.battle));
}

async function reachableButton(button: Locator) {
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  const box = await button.boundingBox();
  if (!box) throw new Error('Missing decision button');
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(
    await button.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }),
  ).toBe(true);
}

async function tapTarget(page: Page) {
  await settleLayout(page);
  const point = await paintedTileCentre(page, target);
  const box = await page.locator('.map-canvas').boundingBox();
  if (!point || !box) throw new Error('Missing battlefield geometry');
  expect(box.height).toBeGreaterThan(0);
  expect(point.x).toBeGreaterThan(box.x);
  expect(point.x).toBeLessThan(box.x + box.width);
  expect(point.y).toBeGreaterThan(box.y);
  expect(point.y).toBeLessThan(box.y + box.height);
  const hit = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return {
      canvas: element === document.querySelector('.map-canvas'),
      html: element?.outerHTML.slice(0, 250),
    };
  }, point);
  expect(hit.canvas, `Target intercepted by ${hit.html}`).toBe(true);
  await page.touchscreen.tap(point.x, point.y);
  await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeEnabled();
}

for (const renderer of ['canvas', 'webgl'] as const) {
  for (const narrow of [false, true]) {
    test(`Fire Jab target stays tappable with separate decisions on ${renderer}${narrow ? ' at huge phone text' : ' at desktop lower edge'}`, async ({
      page,
    }) => {
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
      const zoomBefore = await page.evaluate(() => window.fnt!.app.rendererCamera()!.tilePx);
      await page.locator('.map-canvas').evaluate((canvas) => {
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
      });
      const selectedZoom = await page.evaluate(() => window.fnt!.app.rendererCamera()!.tilePx);
      expect(selectedZoom).toBeGreaterThan(zoomBefore);
      await page.getByRole('button', { name: /Fire Jab/i }).click();
      await settleLayout(page);
      await expect(page.locator('.toast')).toHaveCount(0, { timeout: 10000 });
      if (!narrow) {
        // Keep the actual target near the lower map edge, where the old aim
        // guidance intercepted it. Pan through the real input adapter; do not
        // depend on fixed camera offsets or the implementation's dock classes.
        const point = await paintedTileCentre(page, target);
        const box = await page.locator('.map-canvas').boundingBox();
        if (!point || !box) throw new Error('Missing pan geometry');
        const dx = box.x + box.width * 0.67 - point.x;
        const dy = box.y + box.height - 84 - point.y;
        const from = { x: box.x + box.width * 0.3, y: box.y + 80 };
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(from.x + dx, from.y + dy, { steps: 8 });
        await page.mouse.up();
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
      expect(
        await page.evaluate(
          (id) => window.fnt!.app.state!.battle!.units.find((u) => u.id === id)!.ap,
          staged.actorId,
        ),
      ).toBe(staged.ap - staged.cost);
      expect((await page.locator('.map-canvas').boundingBox())?.height).toBeGreaterThan(0);
      if (narrow)
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          390,
        );
    });
  }
}
