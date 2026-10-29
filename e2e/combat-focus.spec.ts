import { expect, test } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import {
  enterNode,
  pauseClock,
  resetStorage,
  setLargeText,
  settleLayout,
  startGame,
  takeTurn,
  waitForIdle,
} from './helpers';
import { paintedTileCentre } from './projection';
import type { MapView } from '../src/render/view';

test('a fresh battle establishes the full formation before the acting-unit hand-off', async ({
  page,
}) => {
  test.setTimeout(40_000);
  // Keep the 700 ms formation hold from elapsing between two host-side polls
  // when a loaded software renderer delivers its next frame seconds later.
  await page.clock.install();
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Kaya'], ['kaya'], 'battle-opening-camera', { reduceMotion: false });
  await pauseClock(page);
  await enterNode(page, 'battle_forest_road');

  await expect
    .poll(
      async () => {
        await page.clock.runFor(50);
        return page.locator('.combat-scene').getAttribute('data-battle-opening');
      },
      { timeout: 25_000, intervals: [50] },
    )
    .toBe('hold');
  const formation = await page.evaluate(() => window.fnt!.app.rendererCamera());
  // Advance deterministic application time inside the authored hold, rather
  // than guessing how much wall time a frame took on the runner.
  await page.clock.runFor(300);
  expect(await page.locator('.combat-scene').getAttribute('data-battle-opening')).toBe('hold');
  expect(await page.evaluate(() => window.fnt!.app.rendererCamera())).toEqual(formation);

  await expect
    .poll(
      async () => {
        await page.clock.runFor(100);
        return page.locator('.combat-scene').getAttribute('data-battle-opening');
      },
      { timeout: 25_000, intervals: [50] },
    )
    .toBeNull();
  const actor = await page.evaluate(() => window.fnt!.app.rendererCamera());
  expect(actor).not.toEqual(formation);
});

test.describe('AI camera reveal at DPR 2', () => {
  test.use({ deviceScaleFactor: 2 });

  test('a distant enemy is revealed before its native AI turn starts playback', async ({
    page,
  }) => {
    await page.clock.install();
    await page.setViewportSize({ width: 390, height: 844 });
    await resetStorage(page, '?renderer=canvas');
    await startGame(page, ['Solo'], ['kaya'], 'pr353-natural-ai-evidence');
    await enterNode(page, 'battle_forest_road');
    expect(await takeTurn(page)).toBe(true);
    await waitForIdle(page);
    await page.evaluate(() => window.fnt!.app.updateSettings({ reduceMotion: false }));
    await settleLayout(page);
    await pauseClock(page);

    // Observe the application's own AI dispatch and the rendered reveal.
    // Keep the real authored battle, timer and command playback unchanged.
    const probe = await page.evaluateHandle(() => {
      const app = window.fnt!.app;
      const scene = document.querySelector('.combat-scene')!;
      const renderer = (app as unknown as { scene: { renderer: { lastView: MapView | null } } })
        .scene.renderer;
      const sample = () => {
        const battle = app.state!.battle!;
        const actor = battle.units.find((unit) => unit.id === battle.order[battle.turnIndex])!;
        const camera = app.rendererCamera()!;
        const canvas = document.querySelector('.map-canvas')!.getBoundingClientRect();
        const m = camera.groundTransform;
        const points = [0, actor.size].flatMap((dy) =>
          [0, actor.size].map((dx) => ({
            x: (m.a * (actor.pos.x + dx) + m.c * (actor.pos.y + dy)) * 64 + m.tx,
            y: (m.b * (actor.pos.x + dx) + m.d * (actor.pos.y + dy)) * 64 + m.ty,
          })),
        );
        return {
          now: performance.now(),
          activeId: actor.id,
          faction: actor.faction,
          size: actor.size,
          marker: scene.getAttribute('data-camera-glide'),
          camera,
          width: canvas.width,
          height: canvas.height,
          bounds: {
            left: Math.min(...points.map((point) => point.x)),
            right: Math.max(...points.map((point) => point.x)),
            top: Math.min(...points.map((point) => point.y)),
            bottom: Math.max(...points.map((point) => point.y)),
          },
          busy: app.animator.busy(performance.now()),
          moving: app.animator.renderPos(performance.now(), actor.id) !== undefined,
          renderedActiveId: renderer.lastView?.activeUnitId ?? null,
          battle: JSON.stringify(battle),
        };
      };
      const records = {
        revealed: null as ReturnType<typeof sample> | null,
        actions: [] as ReturnType<typeof sample>[],
      };
      const observer = new MutationObserver(() => {
        if (scene.hasAttribute('data-camera-glide') || records.revealed) return;
        records.revealed = sample();
        observer.disconnect();
      });
      observer.observe(scene, { attributes: true, attributeFilter: ['data-camera-glide'] });
      const dispatch = app.dispatch.bind(app);
      app.dispatch = (command) => {
        if (command.type === 'runAiTurn') records.actions.push(sample());
        return dispatch(command);
      };
      const battle = app.state!.battle!;
      const actor = battle.units.find((unit) => unit.id === battle.order[battle.turnIndex])!;
      dispatch({ type: 'endTurn', unitId: actor.id });
      return { initial: sample(), sample, records };
    });
    const initial = await probe.evaluate((value) => value.initial);
    expect(initial.faction).toBe('enemy');
    expect(initial.size).toBe(1);
    expect(initial.marker).toBe('active');
    expect(initial.bounds.left).toBeGreaterThan(initial.width);

    await page.clock.runFor(300);
    const waiting = await probe.evaluate((value) => ({
      current: value.sample(),
      actions: value.records.actions.length,
    }));
    expect(waiting.current.activeId).toBe(initial.activeId);
    expect(waiting.current.battle).toBe(initial.battle);
    expect(waiting.current.marker).toBe('active');
    expect(waiting.current.busy).toBe(false);
    expect(waiting.current.moving).toBe(false);
    expect(waiting.actions).toBe(0);
    expect(waiting.current.camera.offsetX).not.toBe(initial.camera.offsetX);

    await page.clock.runFor(300);
    const after = await probe.evaluate((value) => ({
      current: value.sample(),
      revealed: value.records.revealed,
      actions: value.records.actions,
    }));
    expect(after.actions).toHaveLength(1);
    const action = after.actions[0];
    if (!action || !after.revealed) throw new Error('AI acted without a rendered camera reveal.');
    expect(action.now - initial.now).toBeGreaterThanOrEqual(420);
    expect(action.activeId).toBe(initial.activeId);
    expect(action.renderedActiveId).toBe(initial.activeId);
    expect(action.marker).toBeNull();
    expect(action.busy).toBe(false);
    expect(action.moving).toBe(false);
    expect(action.bounds.left).toBeGreaterThanOrEqual(0);
    expect(action.bounds.right).toBeLessThanOrEqual(action.width);
    expect(action.bounds.top).toBeGreaterThanOrEqual(0);
    expect(action.bounds.bottom).toBeLessThanOrEqual(action.height);
    expect(action.camera).toEqual(after.revealed.camera);
    expect(action.camera.tilePx).toBe(initial.camera.tilePx);
    expect(after.revealed.now).toBeLessThanOrEqual(action.now);
    expect(after.current.activeId).not.toBe(initial.activeId);
    expect(after.current.busy).toBe(true);
    await probe.dispose();
  });
});

test('camera follows the moving boss and returns to the next actor with motion on', async ({
  page,
}) => {
  test.setTimeout(40_000);
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Kaya'], ['kaya'], 'boss-camera-follow', { reduceMotion: false });
  await enterNode(page, 'battle_grumbler');
  await takeTurn(page);
  await waitForIdle(page);

  await page.evaluate(() => {
    type FollowProbe = {
      animatedFrames: number;
      glideSeen: boolean;
      outside: {
        points: { x: number; y: number }[];
        viewport: { width: number; height: number };
      }[];
    };
    const win = window as Window & { bossFollowProbe?: FollowProbe };
    win.bossFollowProbe = { animatedFrames: 0, glideSeen: false, outside: [] };
    const app = window.fnt!.app;
    const scene = (
      app as unknown as {
        scene: {
          renderer: {
            camera: {
              viewport: { width: number; height: number };
              project(pos: { x: number; y: number }): { x: number; y: number };
            };
            draw(view: MapView): void;
          };
        };
      }
    ).scene;
    const combatRoot = document.querySelector('.combat-scene');
    if (!combatRoot) throw new Error('Missing combat root');
    const latchFollowGlide = () => {
      if (combatRoot.getAttribute('data-camera-glide') !== 'active') return;
      if (win.bossFollowProbe!.animatedFrames > 0) {
        win.bossFollowProbe!.glideSeen = true;
        observer.disconnect();
        return;
      }
      requestAnimationFrame(latchFollowGlide);
    };
    const observer = new MutationObserver(latchFollowGlide);
    observer.observe(combatRoot, { attributes: true, attributeFilter: ['data-camera-glide'] });
    const draw = scene.renderer.draw.bind(scene.renderer);
    scene.renderer.draw = (view) => {
      draw(view);
      const boss = view.units.find((unit) => unit.name === 'Grumbler');
      if (!boss?.renderPos) return;
      const points = [0.5, 1.5].flatMap((dy) =>
        [0.5, 1.5].map((dx) =>
          scene.renderer.camera.project({ x: boss.renderPos!.x + dx, y: boss.renderPos!.y + dy }),
        ),
      );
      const viewport = scene.renderer.camera.viewport;
      win.bossFollowProbe!.animatedFrames += 1;
      if (
        points.some(
          (point) =>
            point.x < 0 || point.y < 0 || point.x > viewport.width || point.y > viewport.height,
        )
      ) {
        win.bossFollowProbe!.outside.push({ points, viewport: { ...viewport } });
      }
    };
  });

  await page.evaluate(() => {
    const app = window.fnt!.app;
    const battle = app.state!.battle!;
    const actor = battle.units.find((unit) => unit.id === battle.order[battle.turnIndex]);
    if (!actor || actor.faction !== 'party') throw new Error('Party turn was not ready');
    app.dispatch({ type: 'endTurn', unitId: actor.id });
  });

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { bossFollowProbe?: { animatedFrames: number } }).bossFollowProbe
            ?.animatedFrames ?? 0,
      ),
    )
    .toBeGreaterThan(0);
  // The large actor owns the camera during its animation; on release the
  // follow owner hands off to the eased centre for the next actor.
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as Window & { bossFollowProbe?: { glideSeen: boolean } }).bossFollowProbe
              ?.glideSeen ?? false,
        ),
      { timeout: 20_000, intervals: [50] },
    )
    .toBe(true);
  await waitForIdle(page);
  await takeTurn(page);
  const follow = await page.evaluate(
    () =>
      (
        window as Window & {
          bossFollowProbe?: {
            animatedFrames: number;
            outside: unknown[];
          };
        }
      ).bossFollowProbe,
  );
  expect(follow?.animatedFrames).toBeGreaterThan(0);
  expect(follow?.outside).toEqual([]);

  await expect
    .poll(() =>
      page.evaluate(() => {
        const app = window.fnt!.app;
        const battle = app.state!.battle!;
        const actor = battle.units.find((unit) => unit.id === battle.order[battle.turnIndex]);
        const scene = (
          app as unknown as {
            scene: {
              renderer: {
                camera: {
                  viewport: { width: number; height: number };
                  project(pos: { x: number; y: number }): { x: number; y: number };
                };
              };
            };
          }
        ).scene;
        if (!actor || actor.faction !== 'party') return false;
        const point = scene.renderer.camera.project({ x: actor.pos.x + 0.5, y: actor.pos.y + 0.5 });
        const { width, height } = scene.renderer.camera.viewport;
        return point.x >= 0 && point.y >= 0 && point.x <= width && point.y <= height;
      }),
    )
    .toBe(true);
});

for (const renderer of ['canvas', 'webgl']) {
  test(`portrait initiative locates threats without changing actions on ${renderer}`, async ({
    page,
  }) => {
    allowSoftwareWebgl(test, renderer);
    await page.setViewportSize({ width: 820, height: 1180 });
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Kaya'], ['kaya'], 'forest-focus');
    await enterNode(page, 'battle_forest_road');
    await takeTurn(page);
    await waitForIdle(page);
    await page.getByRole('button', { name: /^Move/ }).click();
    const before = await page.evaluate(() => {
      const app = window.fnt!.app;
      const battle = app.state!.battle!;
      const actor = battle.units.find((u) => u.id === battle.order[battle.turnIndex])!;
      const enemy = battle.units.find((u) => u.faction === 'enemy' && u.hp > 0)!;
      return {
        battle: JSON.stringify(battle),
        actor: actor.pos,
        enemy: enemy.pos,
        name: enemy.name,
        tilePx: app.rendererCamera()!.tilePx,
      };
    });
    const intent = await page.locator('.action-bar').innerText();
    const focus = page.getByRole('button', { name: `Focus ${before.name}`, exact: true }).first();
    if (renderer === 'webgl') {
      await focus.focus();
      await focus.press('Enter');
    } else await focus.tap();
    await expect(page.locator('.toast')).toHaveCount(0, { timeout: 10000 });
    const box = await page.locator('.map-canvas').boundingBox();
    if (!box) throw new Error('Missing battlefield');
    const enemyPoint = await paintedTileCentre(page, before.enemy);
    if (!enemyPoint) throw new Error('Missing camera');
    expect(enemyPoint.x).toBeGreaterThan(box.x + 20);
    expect(enemyPoint.x).toBeLessThan(box.x + box.width - 20);
    expect(enemyPoint.y).toBeGreaterThan(box.y + 20);
    expect(enemyPoint.y).toBeLessThan(box.y + box.height - 20);
    await page.screenshot({ path: `.shots/forest-${renderer}-focus-enemy.png` });
    await page.getByRole('button', { name: 'Acting unit', exact: true }).click();
    const actorPoint = await paintedTileCentre(page, before.actor);
    if (!actorPoint) throw new Error('Missing camera');
    expect(actorPoint.x).toBeGreaterThan(box.x + 20);
    expect(actorPoint.x).toBeLessThan(box.x + box.width - 20);
    expect(actorPoint.y).toBeGreaterThan(box.y + 20);
    expect(actorPoint.y).toBeLessThan(box.y + box.height - 20);
    expect(await page.evaluate(() => JSON.stringify(window.fnt!.app.state!.battle))).toBe(
      before.battle,
    );
    expect(await page.evaluate(() => window.fnt!.app.rendererCamera()!.tilePx)).toBe(before.tilePx);
    expect(await page.locator('.action-bar').innerText()).toBe(intent);
    await page.screenshot({ path: `.shots/forest-${renderer}-focus-actor.png` });
  });
}

test('six-person combat keeps initiative navigation usable on a narrow screen with huge text', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Native touch-scroll injection uses the Chromium protocol.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await resetStorage(page, '?renderer=canvas');
  await startGame(
    page,
    ['Nima', 'Kaya', 'Sura', 'Bo', 'Wen', 'Tenzo'],
    ['nima', 'kaya', 'sura', 'bo', 'wen', 'tenzo'],
    'forest-six',
  );
  await setLargeText(page, 'huge');
  await enterNode(page, 'battle_forest_road');
  await takeTurn(page);
  await waitForIdle(page);
  const strip = page.locator('.turn-strip');
  expect(await strip.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  const last = strip.getByRole('button').last();
  await last.scrollIntoViewIfNeeded();
  const box = await last.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await last.tap();
  // A phone folds the header's view buttons behind More.
  await page.getByRole('button', { name: 'More', exact: true }).tap();
  await page.getByRole('button', { name: 'Acting unit', exact: true }).tap();
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 10000 });
  expect((await page.locator('.map-canvas').boundingBox())?.height).toBeGreaterThan(160);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '.shots/forest-six-huge-phone.png' });
  const beforeScroll = await page.evaluate(() => ({
    battle: JSON.stringify(window.fnt!.app.state!.battle),
    camera: window.fnt!.app.rendererCamera(),
  }));
  // Native touch scrolling exercises browser overflow, not the map's synthetic
  // pointer adapter. Scrolling the dock must never spend AP or pan the world.
  const cdp = await page.context().newCDPSession(page);
  const swipe = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
    for (let step = 1; step <= 6; step++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { x: from.x + ((to.x - from.x) * step) / 6, y: from.y + ((to.y - from.y) * step) / 6 },
        ],
      });
    }
    // Hold still before lifting, as a person does after a drag. Six instant
    // moves otherwise lift at speed and start a fling, and the browser spends
    // the next tap stopping that fling without sending a click.
    for (let hold = 0; hold < 4; hold++) {
      await page.waitForTimeout(50);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [to] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await swipe({ x: 200, y: 780 }, { x: 200, y: 590 });
  await swipe({ x: 340, y: 730 }, { x: 50, y: 730 });
  await expect
    .poll(() => page.locator('.hud').evaluate((el) => el.scrollTop + el.scrollLeft))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => JSON.stringify(window.fnt!.app.state!.battle))).toBe(
    beforeScroll.battle,
  );
  expect(await page.evaluate(() => window.fnt!.app.rendererCamera())).toEqual(beforeScroll.camera);
  const end = page.getByRole('button', { name: /^End turn/ });
  await end.scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.shots/forest-six-huge-end-turn.png' });
  await end.tap();
  await expect(page.locator('.toast')).toContainText('Tap End turn again');
  expect(await page.evaluate(() => JSON.stringify(window.fnt!.app.state!.battle))).toBe(
    beforeScroll.battle,
  );
  await end.tap();
  await expect
    .poll(() => page.evaluate(() => JSON.stringify(window.fnt!.app.state!.battle)))
    .not.toBe(beforeScroll.battle);
  await cdp.detach();
});
