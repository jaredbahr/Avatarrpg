import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CONTENT } from '../src/content';
import { RngCursor } from '../src/core/rng';
import { partyOfSize } from '../src/core/sim/balance';
import { createBattle, createGame } from '../src/core/state/createGame';
import { distance, occupiedCells, pathCost, posKey } from '../src/core/rules/grid';
import type { GameEvent, GameState, Vec2 } from '../src/core/types';
import type { Renderer } from '../src/render/renderer';
import type { MapView } from '../src/render/view';
import { resetStorage, settleLayout, waitForIdle } from './helpers';

interface DashProbe {
  calls: { type: string; before: { pos: Vec2; ap: number }; events: readonly GameEvent[] }[];
  frames: { now: number; pos: Vec2; busy: boolean; aiCalls: number; reduced: boolean }[];
  done: boolean;
}
type ObservedApp = { scene: { renderer: Renderer | null } };
declare global {
  interface Window {
    dashProbe?: DashProbe;
  }
}

/** The retained authored witness, with no forced unit stats, positions or turn markers. */
function forest(): GameState {
  const encounter = CONTENT.encounters.get('enc_forest_road');
  if (!encounter) throw new Error('Missing authored Forest encounter');
  const seeded = createGame(CONTENT, {
    seed: 899863172,
    startNode: '',
    party: partyOfSize(1).map((slot) => ({
      ...slot,
      level: encounter.expectedLevel,
      autoChoose: true,
    })),
  });
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(CONTENT, seeded, encounter.id, rng);
  return { ...seeded, screen: 'combat', rng: rng.state, battle };
}

async function install(page: Page, state: GameState, positive = false) {
  const pausedState = await page.evaluate(async (state) => {
    const app = window.fnt?.app;
    if (!app) throw new Error('App not booted');
    app.updateSettings({ reduceMotion: false });
    const probe: DashProbe = { calls: [], frames: [], done: false };
    window.dashProbe = probe;
    const dispatch = app.dispatch.bind(app);
    app.dispatch = (command) => {
      const actor = app.state?.battle?.units.find((unit) => unit.id === 'e5');
      const before = actor ? { pos: { ...actor.pos }, ap: actor.ap } : null;
      const events = dispatch(command);
      if (before && (command.type === 'runAiTurn' || command.type === 'useAbility'))
        probe.calls.push({ type: command.type, before, events });
      return events;
    };
    app.adoptSave(state, { players: [{ name: 'Jared', unitId: 'p0' }] });
    // Pause through the public menu while the real scene loads, so the
    // observer sees its first activation rather than racing renderer startup.
    app.openPause();
    const pausedState = JSON.stringify(app.state);
    const scene = (app as unknown as ObservedApp).scene;
    const renderer = scene.renderer;
    if (!renderer) throw new Error('Combat renderer did not initialize');
    const draw = renderer.draw.bind(renderer);
    renderer.draw = (view: MapView) => {
      draw(view);
      const actor = view.units.find((unit) => unit.id === 'e5');
      if (actor && !probe.done)
        probe.frames.push({
          now: view.time,
          pos: { ...(actor.renderPos ?? actor.pos) },
          busy: app.animator.busy(view.time),
          aiCalls: probe.calls.filter((call) => call.type === 'runAiTurn').length,
          reduced: Boolean(view.reducedMotion),
        });
    };
    await new Promise<void>((resolve) => {
      const ready = () => {
        if (probe.frames.length >= 2) resolve();
        else requestAnimationFrame(ready);
      };
      requestAnimationFrame(ready);
    });
    return pausedState;
  }, state);
  // A facade draw can queue a view while Pixi is still initializing. Keep
  // gameplay paused while the real scene settles and presents its canvas.
  await page.waitForFunction(() => !window.fnt?.app.curtainBusy);
  await settleLayout(page);
  await test.info().attach('paused-scene-warmup', {
    body: await page.locator('.combat-scene .map-canvas').screenshot(),
    contentType: 'image/png',
  });
  const warmup = await page.evaluate(async () => {
    const probe = window.dashProbe;
    if (!probe) throw new Error('Missing observer');
    const nextDraw = probe.frames.length + 2;
    await new Promise<void>((resolve) => {
      const ready = () => {
        if (probe.frames.length >= nextDraw) resolve();
        else requestAnimationFrame(ready);
      };
      requestAnimationFrame(ready);
    });
    return {
      state: JSON.stringify(window.fnt?.app.state),
      calls: probe.calls,
      frames: probe.frames,
      camera: window.fnt?.app.rendererCamera(),
    };
  });
  await test.info().attach('paused-warmup-observer', {
    body: JSON.stringify(warmup, null, 2),
    contentType: 'application/json',
  });
  expect(warmup.state).toBe(pausedState);
  expect(warmup.calls).toEqual([]);
  expect(warmup.frames.every((frame) => !frame.busy && !frame.reduced)).toBe(true);
  expect(warmup.camera).not.toBeNull();
  return page.evaluate((positive) => {
    const app = window.fnt?.app;
    if (!app) throw new Error('App not booted');
    app.closePause();
    if (!positive) return null;
    const battle = app.state?.battle;
    const actor = battle?.units.find((unit) => unit.id === 'e5');
    if (!battle || !actor) throw new Error('Authored enemy missing');
    const before = { pos: { ...actor.pos }, ap: actor.ap, move: actor.move };
    const blockedIndex = battle.grid.tiles.findIndex(
      (tile, index) =>
        tile.blocked &&
        Math.max(
          Math.abs((index % battle.grid.width) - actor.pos.x),
          Math.abs(Math.floor(index / battle.grid.width) - actor.pos.y),
        ) <= 3,
    );
    if (blockedIndex < 0) throw new Error('No authored nearby collision witness');
    const blocked = {
      x: blockedIndex % battle.grid.width,
      y: Math.floor(blockedIndex / battle.grid.width),
    };
    const rejected = app.dispatch({
      type: 'useAbility',
      unitId: actor.id,
      abilityId: 'bandit_rush',
      target: blocked,
    });
    const afterRejected = app.state?.battle?.units.find((unit) => unit.id === actor.id);
    const rejectedResources = afterRejected
      ? {
          pos: { ...afterRejected.pos },
          ap: afterRejected.ap,
          move: afterRejected.move,
          cooldown: afterRejected.cooldowns.bandit_rush ?? 0,
        }
      : null;
    const target = { x: 16, y: 5 };
    const events = app.dispatch({
      type: 'useAbility',
      unitId: actor.id,
      abilityId: 'bandit_rush',
      target,
    });
    const after = app.state?.battle?.units.find((unit) => unit.id === actor.id);
    return {
      before,
      blocked,
      rejected,
      rejectedResources,
      target,
      events,
      after: after
        ? {
            pos: { ...after.pos },
            ap: after.ap,
            move: after.move,
            cooldown: after.cooldowns.bandit_rush ?? 0,
          }
        : null,
    };
  }, positive);
}

async function finish(page: Page) {
  await page.waitForFunction(() =>
    window.dashProbe?.calls.some((call) => call.type === 'runAiTurn'),
  );
  await waitForIdle(page);
  const canvas = page.locator('.combat-scene .map-canvas');
  await expect(canvas).toBeVisible();
  const probe = await page.evaluate(() => {
    const probe = window.dashProbe;
    if (!probe) throw new Error('Missing observer');
    probe.done = true;
    return {
      ...probe,
      backend: window.fnt?.app.rendererBackend(),
      camera: window.fnt?.app.rendererCamera(),
    };
  });
  await test.info().attach('rendered-command-and-motion-observer', {
    body: JSON.stringify(probe, null, 2),
    contentType: 'application/json',
  });
  await test
    .info()
    .attach('settled-combat', { body: await canvas.screenshot(), contentType: 'image/png' });
  const moving = probe.frames.filter((frame) => frame.busy);
  expect(probe.frames.every((frame) => !frame.reduced)).toBe(true);
  expect(new Set(moving.map((frame) => `${frame.pos.x},${frame.pos.y}`)).size).toBeGreaterThan(1);
  expect(
    moving.some((frame) => !Number.isInteger(frame.pos.x) || !Number.isInteger(frame.pos.y)),
  ).toBe(true);
  expect(probe.camera).not.toBeNull();
  return probe;
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`${renderer}: authored enemy activation avoids a stationary Rush`, async ({ page }) => {
    await resetStorage(page, `?renderer=${renderer}&style=topdown`);
    const state = forest();
    const battle = state.battle;
    if (!battle) throw new Error('Missing authored battle');
    const actor = battle.units.find((unit) => unit.id === 'e5');
    expect(actor?.pos).toEqual({ x: 17, y: 5 });
    expect(battle.order[battle.turnIndex]).toBe(actor?.id);
    await install(page, state);
    const probe = await finish(page);
    expect(probe.backend).toBe(renderer);
    const call = probe.calls.find((call) => call.type === 'runAiTurn');
    if (!call || !actor) throw new Error('No observed public AI activation');
    let position = actor.pos;
    let dashTarget: Vec2 | undefined;
    const blocked = new Set(
      battle.units
        .filter((unit) => unit.id !== actor.id && unit.hp > 0)
        .flatMap((unit) => occupiedCells(unit).map(posKey)),
    );
    for (const event of call.events) {
      if (
        event.type === 'abilityUsed' &&
        event.unitId === actor.id &&
        event.abilityId === 'bandit_rush'
      ) {
        expect(event.target).not.toEqual(position);
        dashTarget = event.target;
      }
      if (event.type === 'unitMoved' && event.unitId === actor.id) {
        expect(event.path.at(-1)).not.toEqual(position);
        expect(event.cost).toBeGreaterThan(0);
        if (dashTarget) {
          expect(event.path).toEqual([dashTarget]);
          expect(event.cost).toBe(distance(position, dashTarget));
          dashTarget = undefined;
        } else {
          expect(
            pathCost(
              {
                grid: battle.grid,
                surfaces: CONTENT.surfaces,
                blocked,
                size: actor.size,
                climbCost: CONTENT.tuning.climbCost,
              },
              position,
              event.path,
            ),
          ).toBe(event.cost);
        }
        position = event.path.at(-1) ?? position;
      }
    }
    expect(distance(position, actor.pos)).toBeGreaterThan(0);
    expect(call.events).toContainEqual({ type: 'turnEnded', unitId: actor.id });
  });

  test(`${renderer}: real Rush still moves and blocked landing preserves resources`, async ({
    page,
  }) => {
    await resetStorage(page, `?renderer=${renderer}&style=topdown`);
    const result = await install(page, forest(), true);
    if (!result) throw new Error('Missing direct Rush witness');
    expect(result.before).toEqual({ pos: { x: 17, y: 5 }, ap: 4, move: 4 });
    expect(result.rejectedResources).toEqual({ ...result.before, cooldown: 0 });
    expect(
      result.rejected.some((event) => event.type === 'abilityUsed' || event.type === 'unitMoved'),
    ).toBe(false);
    expect(result.after).toEqual({ pos: result.target, ap: 2, move: 4, cooldown: 2 });
    expect(result.events).toContainEqual({
      type: 'unitMoved',
      unitId: 'e5',
      path: [result.target],
      cost: 1,
    });
    const probe = await finish(page);
    expect(probe.backend).toBe(renderer);
    // AI dispatch can queue its next walk while the direct Rush is still
    // playing. Isolate the drawn 17,5 -> 16,5 segment by its geometry, before
    // any ordinary walk leaves it, rather than by the command dispatch time.
    const walkStart = probe.frames.findIndex(
      (frame) => frame.busy && (frame.pos.x < 16 || frame.pos.y !== 5),
    );
    const dashFrames = probe.frames
      .slice(0, walkStart < 0 ? undefined : walkStart)
      .filter((frame) => frame.busy);
    expect(
      new Set(dashFrames.map((frame) => `${frame.pos.x},${frame.pos.y}`)).size,
    ).toBeGreaterThan(1);
    expect(
      dashFrames.some((frame) => frame.pos.x > 16 && frame.pos.x < 17 && frame.pos.y === 5),
    ).toBe(true);
  });
}
