import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`default-zoom manual pan survives aim and preview reflow on ${renderer}`, async ({
    page,
  }) => {
    // CI trace: software GL spends ~2s per protocol action and ~20s on the
    // ten-step drag alone. Layout waits resolve; the complete sequence needs
    // the same slow-project allowance as other forced-WebGL regressions.
    if (renderer === 'webgl') test.slow();
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

for (const largeText of ['normal', 'huge'] as const) {
  test(`compact oblique framing stays stable through ability reflow at ${largeText} text`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await resetStorage(page, '?renderer=canvas');
    await startGame(page, ['Kaya'], ['kaya'], `compact-frame-${largeText}`);
    if (largeText === 'huge')
      await page.evaluate(() => window.fnt!.app.updateSettings({ largeText: 'huge' }));
    await enterNode(page, 'battle_forest_road');
    await takeTurn(page);
    await waitForIdle(page);
    await settleLayout(page);
    const before = await page.evaluate(() => window.fnt!.app.rendererCamera()!);
    const box = await page.locator('.map-canvas').boundingBox();
    if (!box) throw new Error('Missing battlefield geometry');
    expect(before.tilePx).toBeCloseTo(largeText === 'huge' ? 40 : 64, 5);
    expect(box.height).toBeGreaterThan(160);
    expect(await page.getByRole('button', { name: /^Focus / }).count()).toBeGreaterThan(0);

    await page.getByRole('button', { name: /^Fire Jab/ }).click();
    await settleLayout(page);
    const aiming = await page.evaluate(() => window.fnt!.app.rendererCamera()!);
    expect(aiming.tilePx).toBeCloseTo(before.tilePx, 5);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await settleLayout(page);
    const cancelled = await page.evaluate(() => window.fnt!.app.rendererCamera()!);
    expect(cancelled.tilePx).toBeCloseTo(before.tilePx, 5);
  });
}

test('iPad landscape normal text keeps the lower target inside the map', async ({ page }) => {
  await page.setViewportSize({ width: 1194, height: 834 });
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Elias'], ['bo'], 'ipad-landscape-normal-frame');
  await enterNode(page, 'battle_forest_road');
  await takeTurn(page);
  await waitForIdle(page);
  await settleLayout(page);

  const camera = await page.evaluate(() => window.fnt!.app.rendererCamera()!);
  expect(camera.tilePx).toBeCloseTo(64, 5);
  const canvas = await page.locator('.map-canvas').boundingBox();
  const target = { x: 5, y: 4 };
  const point = await paintedTileCentre(page, target);
  if (!canvas || !point) throw new Error('Missing iPad battlefield geometry');
  expect(point.x).toBeGreaterThan(canvas.x);
  expect(point.x).toBeLessThan(canvas.x + canvas.width);
  expect(point.y).toBeGreaterThan(canvas.y);
  expect(point.y).toBeLessThan(canvas.y + canvas.height);
  expect(
    await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y) === document.querySelector('.map-canvas'),
      point,
    ),
  ).toBe(true);
});

test('real viewport resize recomputes compact oblique framing', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Kaya'], ['kaya'], 'compact-frame-resize');
  await enterNode(page, 'battle_forest_road');
  await takeTurn(page);
  await waitForIdle(page);
  await settleLayout(page);
  const tall = await page.evaluate(() => window.fnt!.app.rendererCamera()!);
  expect(tall.tilePx).toBeGreaterThanOrEqual(96);

  await page.setViewportSize({ width: 1280, height: 720 });
  await settleLayout(page);
  const short = await page.evaluate(() => window.fnt!.app.rendererCamera()!);
  expect(short.tilePx).toBeCloseTo(64, 5);
});

test('Huge text on a tall viewport reserves the expanded decision panel', async ({ page }) => {
  await page.setViewportSize({ width: 1368, height: 912 });
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Kaya'], ['kaya'], 'compact-frame-tall-huge');
  await page.evaluate(() => window.fnt!.app.updateSettings({ largeText: 'huge' }));
  await enterNode(page, 'battle_forest_road');
  await takeTurn(page);
  await waitForIdle(page);
  await settleLayout(page);
  const before = await page.evaluate(() => window.fnt!.app.rendererCamera()!);
  expect(before.tilePx).toBeLessThanOrEqual(40.01);
  await page.getByRole('button', { name: /^Fire Jab/ }).click();
  await settleLayout(page);
  const aiming = await page.evaluate(() => window.fnt!.app.rendererCamera()!);
  expect(aiming.tilePx).toBeCloseTo(before.tilePx, 5);
});
