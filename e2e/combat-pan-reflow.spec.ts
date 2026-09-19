import { expect, test, type Page } from '@playwright/test';
import { CONTENT } from '../src/content';
import { RngCursor } from '../src/core/rng';
import { reachable } from '../src/core/rules/grid';
import { BattleDraft } from '../src/core/state/battleDraft';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import { groundPoint, paintedTileCentre } from './projection';

async function lowestVisibleMoveTarget(page: Page): Promise<{ x: number; y: number }> {
  const view = await page.evaluate(() => {
    const app = window.fnt?.app;
    const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
    const camera = app?.rendererCamera();
    const battle = app?.state?.battle;
    if (!app || !canvas || !camera || !battle) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      battle,
      rng: app.state?.rng ?? 0,
      camera,
      rect: { width: rect.width, height: rect.height },
    };
  });
  if (!view) throw new Error('Missing combat state for movement target.');

  const draft = new BattleDraft(CONTENT, view.battle, new RngCursor(view.rng));
  const actingId = draft.order[draft.turnIndex];
  const acting = actingId ? draft.unit(actingId) : null;
  if (!acting) throw new Error('Missing acting unit for movement target.');

  const visible = [...reachable(draft.moveContext(acting), acting.pos, acting.move).values()]
    .filter((cell) => cell.pos.x !== acting.pos.x || cell.pos.y !== acting.pos.y)
    .map((cell) => ({
      cell,
      point: groundPoint(view.camera, { x: cell.pos.x + 0.5, y: cell.pos.y + 0.5 }),
    }))
    .filter(
      ({ point }) =>
        point.x > 8 &&
        point.x < view.rect.width - 8 &&
        point.y > 8 &&
        point.y < view.rect.height - 8,
    )
    .sort((a, b) => b.point.y - a.point.y);
  const target = visible[0]?.cell.pos;
  if (!target) throw new Error('No visible legal movement target.');
  return target;
}

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
    const target = { x: 13, y: 5 };
    // Stage only legal battle positions. Navigation and aiming use the actual UI.
    const backend = await page.evaluate((spot) => {
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
      return app.rendererBackend();
    }, target);
    expect(backend).toBe(renderer);
    await page.getByRole('button', { name: 'Recentre', exact: true }).click();
    await settleLayout(page);
    const initialView = await page.evaluate((p) => {
      const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
      const camera = window.fnt?.app.rendererCamera();
      if (!canvas || !camera) return null;
      const rect = canvas.getBoundingClientRect();
      const m = camera.groundTransform;
      const x = (p.x + 0.5) * 64,
        y = (p.y + 0.5) * 64,
        dpr = window.devicePixelRatio || 1;
      return {
        camera,
        box: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
        point: {
          x: rect.left + ((m.a * x + m.c * y + m.tx) * rect.width) / (canvas.width / dpr),
          y: rect.top + ((m.b * x + m.d * y + m.ty) * rect.height) / (canvas.height / dpr),
        },
      };
    }, target);
    if (!initialView) throw new Error('Missing battlefield');
    const { camera: initial, box, point } = initialView;
    const readPanSnapshot = async (target?: { x: number; y: number }) => {
      await settleLayout(page);
      return page.evaluate((p) => {
        const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
        const camera = window.fnt?.app.rendererCamera();
        if (!canvas || !camera) return null;
        const snapshot: {
          camera: typeof camera;
          state: string;
          target?: { point: { x: number; y: number }; hitCanvas: boolean };
        } = {
          camera,
          state: JSON.stringify(window.fnt?.app.state?.battle),
        };
        if (p) {
          const m = camera.groundTransform;
          const x = (p.x + 0.5) * 64;
          const y = (p.y + 0.5) * 64;
          const rect = canvas.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          const point = {
            x: rect.left + ((m.a * x + m.c * y + m.tx) * rect.width) / (canvas.width / dpr),
            y: rect.top + ((m.b * x + m.d * y + m.ty) * rect.height) / (canvas.height / dpr),
          };
          snapshot.target = {
            point,
            hitCanvas: document.elementFromPoint(point.x, point.y) === canvas,
          };
        }
        return snapshot;
      }, target);
    };
    const from = { x: box.x + box.width * 0.7, y: box.y + box.height * 0.7 };
    const dx = box.x + box.width / 2 - point.x;
    const dy = box.y + box.height / 2 - point.y;
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    // One intermediate move is enough to exercise the real drag recognizer;
    // multi-step gesture coverage lives in gestures.spec.ts. Keeping this
    // bounded matters on software WebGL, where every input can trigger a slow
    // frame and the ten-step version consumed most of the test budget.
    await page.mouse.move(from.x + dx, from.y + dy, { steps: 2 });
    await page.mouse.up();
    const afterDrag = await readPanSnapshot();
    if (!afterDrag) throw new Error('Missing battlefield');
    const panned = afterDrag.camera;
    expect(Math.abs(panned.offsetX - initial.offsetX)).toBeGreaterThan(20);
    expect(panned.tilePx).toBe(initial.tilePx);
    const state = afterDrag.state;

    const expectPan = async (target?: { x: number; y: number }) => {
      const snapshot = await readPanSnapshot(target);
      if (!snapshot) throw new Error('Missing battlefield');
      const camera = snapshot.camera;
      expect(camera.tilePx).toBe(panned.tilePx);
      expect(camera.offsetX).toBeCloseTo(panned.offsetX, 3);
      expect(camera.offsetY).toBeCloseTo(panned.offsetY, 3);
      return snapshot;
    };
    await page.getByRole('button', { name: /Fire Jab/i }).click();
    const aimedSnapshot = await expectPan(target);
    if (!aimedSnapshot.target) throw new Error('Missing target');
    expect(aimedSnapshot.target.hitCanvas).toBe(true);
    await page.touchscreen.tap(aimedSnapshot.target.point.x, aimedSnapshot.target.point.y);
    await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeEnabled();
    await expectPan();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    const cancelledState = await expectPan();
    expect(cancelledState.state).toBe(state);
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

for (const renderer of ['canvas', 'webgl'] as const) {
  for (const largeText of ['normal', 'large', 'huge'] as const) {
    test(`reveals a legal lower move through confirmation reflow on ${renderer}/${largeText}`, async ({
      page,
    }) => {
      if (renderer === 'webgl') test.slow();
      await page.setViewportSize({ width: 1280, height: 720 });
      await resetStorage(page, `?renderer=${renderer}`);
      await startGame(page, ['Sura'], ['sura'], `move-reveal-${renderer}-${largeText}`);
      if (largeText !== 'normal')
        await page.evaluate(
          (text) => window.fnt!.app.updateSettings({ largeText: text === 'huge' ? 'huge' : 'on' }),
          largeText,
        );
      await enterNode(page, 'battle_forest_road');
      expect(await takeTurn(page)).toBe(true);
      await waitForIdle(page);
      await settleLayout(page);

      // Start from the real acting-unit focus so the target is near the lower
      // edge of the 1280x720 battlefield, as it is in the compact UI.
      await page.getByRole('button', { name: 'Focus Sura', exact: true }).click();
      await settleLayout(page);
      await page.getByRole('button', { name: /^Move/ }).click();
      await settleLayout(page);

      const target = await lowestVisibleMoveTarget(page);
      const before = await page.evaluate(() => window.fnt!.app.rendererCamera()!);
      const canvas = page.locator('.map-canvas');
      const beforeBox = await canvas.boundingBox();
      const beforePoint = await paintedTileCentre(page, target);
      if (!beforeBox || !beforePoint) throw new Error('Missing compact movement geometry.');
      expect(beforePoint.x).toBeGreaterThan(beforeBox.x);
      expect(beforePoint.x).toBeLessThan(beforeBox.x + beforeBox.width);
      expect(beforePoint.y).toBeGreaterThan(beforeBox.y);
      expect(beforePoint.y).toBeLessThan(beforeBox.y + beforeBox.height);

      await page.mouse.click(beforePoint.x, beforePoint.y);
      await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeVisible();
      await settleLayout(page);

      const after = await page.evaluate(() => window.fnt!.app.rendererCamera()!);
      const afterBox = await canvas.boundingBox();
      const afterPoint = await paintedTileCentre(page, target);
      if (!afterBox || !afterPoint) throw new Error('Missing reflowed movement geometry.');
      expect(afterPoint.x).toBeGreaterThan(afterBox.x + 4);
      expect(afterPoint.x).toBeLessThan(afterBox.x + afterBox.width - 4);
      expect(afterPoint.y).toBeGreaterThan(afterBox.y + 4);
      expect(afterPoint.y).toBeLessThan(afterBox.y + afterBox.height - 4);
      expect(
        await page.evaluate(
          ({ x, y }) => document.elementFromPoint(x, y) === document.querySelector('.map-canvas'),
          afterPoint,
        ),
      ).toBe(true);
      expect(after.tilePx).toBeCloseTo(before.tilePx, 5);

      const compactMetrics = await page.evaluate(() => {
        const body = document.querySelector<HTMLElement>('.confirm-dialog > .confirm-body');
        const dialog = document.querySelector<HTMLElement>('.confirm-dialog');
        const controls = [
          ...document.querySelectorAll<HTMLButtonElement>('.confirm-dialog button'),
        ];
        return {
          dialogClass: dialog?.className ?? '',
          bodyOverflow: body ? body.scrollWidth > body.clientWidth : true,
          dialogHeight: dialog?.getBoundingClientRect().height ?? 0,
          controls: controls.map((control) => {
            const box = control.getBoundingClientRect();
            return { width: box.width, height: box.height };
          }),
        };
      });
      expect(compactMetrics.dialogClass).toContain('confirm-dialog');
      expect(compactMetrics.bodyOverflow).toBe(false);
      expect(
        compactMetrics.controls.every(({ width, height }) => width >= 44 && height >= 44),
      ).toBe(true);
      if (largeText === 'normal') expect(afterBox.height).toBeGreaterThan(300);
      if (largeText === 'large') expect(afterBox.height).toBeGreaterThan(230);

      if (process.env.FNT_REVIEW_DIR)
        await page.screenshot({
          path: `${process.env.FNT_REVIEW_DIR}/move-reveal-${renderer}-${largeText}.png`,
        });

      await page.getByRole('button', { name: 'Confirm', exact: true }).click();
      await waitForIdle(page);
      await expect
        .poll(() =>
          page.evaluate(() => {
            const battle = window.fnt!.app.state!.battle!;
            const unit = battle.units.find((candidate) => candidate.characterId === 'sura');
            return unit?.pos ?? null;
          }),
        )
        .toEqual(target);
    });
  }
}
