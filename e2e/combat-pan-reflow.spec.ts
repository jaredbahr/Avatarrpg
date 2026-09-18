import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`default-zoom manual pan survives aim and preview reflow on ${renderer}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1672, height: 941 });
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Kaya'], ['kaya'], 'manual-pan-reflow');
    await enterNode(page, 'battle_forest_road');
    expect(await takeTurn(page)).toBe(true);
    await waitForIdle(page);
    expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(renderer);
    const target = { x: 13, y: 5 };
    // Stage only legal battle positions. Navigation and aiming use the actual UI.
    await page.evaluate((spot) => {
      const app = window.fnt!.app;
      const state = app.state!;
      const battle = state.battle!;
      const actor = battle.order[battle.turnIndex];
      const enemy = battle.units.find((u) => u.faction === 'enemy' && u.hp > 0 && u.size === 1)!;
      app.state = {
        ...state,
        battle: {
          ...battle,
          units: battle.units.map((u) =>
            u.id === actor
              ? { ...u, pos: { x: 9, y: 4 } }
              : u.id === enemy.id
                ? { ...u, pos: spot }
                : u,
          ),
        },
      };
    }, target);
    await page.getByRole('button', { name: 'Recentre', exact: true }).click();
    await settleLayout(page);
    const initial = await page.evaluate(() => window.fnt!.app.rendererCamera()!);
    const box = await page.locator('.map-canvas').boundingBox();
    const point = await paintedTileCentre(page, target);
    if (!box || !point) throw new Error('Missing battlefield');
    const from = { x: box.x + box.width * 0.7, y: box.y + box.height * 0.7 };
    const dx = box.x + box.width / 2 - point.x;
    const dy = box.y + box.height / 2 - point.y;
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + dx, from.y + dy, { steps: 10 });
    await page.mouse.up();
    await settleLayout(page);
    const panned = await page.evaluate(() => window.fnt!.app.rendererCamera()!);
    expect(Math.abs(panned.offsetX - initial.offsetX)).toBeGreaterThan(20);
    expect(panned.tilePx).toBe(initial.tilePx);
    const state = await page.evaluate(() => JSON.stringify(window.fnt!.app.state!.battle));

    const expectPan = async () => {
      await settleLayout(page);
      const camera = await page.evaluate(() => window.fnt!.app.rendererCamera()!);
      expect(camera.tilePx).toBe(panned.tilePx);
      expect(camera.offsetX).toBeCloseTo(panned.offsetX, 3);
      expect(camera.offsetY).toBeCloseTo(panned.offsetY, 3);
    };
    await page.getByRole('button', { name: /Fire Jab/i }).click();
    await expectPan();
    const aimed = await paintedTileCentre(page, target);
    if (!aimed) throw new Error('Missing target');
    expect(
      await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y) === document.querySelector('.map-canvas'),
        aimed,
      ),
    ).toBe(true);
    await page.touchscreen.tap(aimed.x, aimed.y);
    await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeEnabled();
    await expectPan();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expectPan();
    expect(await page.evaluate(() => JSON.stringify(window.fnt!.app.state!.battle))).toBe(state);
    // Explicit window resize uses the same retained navigation policy.
    await page.setViewportSize({ width: 1672, height: 981 });
    await expectPan();
    await page.getByRole('button', { name: 'Recentre', exact: true }).click();
    await settleLayout(page);
    const recentred = await page.evaluate(() => window.fnt!.app.rendererCamera()!);
    expect(recentred.tilePx).toBe(initial.tilePx);
    expect(Math.abs(recentred.offsetX - panned.offsetX)).toBeGreaterThan(20);
  });
}
