import { PNG } from 'pngjs';
import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { CONTENT } from '../src/content';
import type { Command, GameState } from '../src/core/types';
import { createGame } from '../src/core/state/createGame';
import { apply } from '../src/core/state/reducer';
import type { Camera } from '../src/render/camera';
import type { MapView } from '../src/render/view';
import { FOOT_LINE } from '../src/render/sheets/bake';
import { liftAlong } from '../src/render/geometry/elevation';
import { allowSoftwareWebgl } from './budget';
import { pauseClock, resetStorage, settleLayout } from './helpers';

/** Reach the final action through the real rules, with the simulator's party profiles. */
function finalAction(outcome: 'victory' | 'defeat'): { state: GameState; command: Command } {
  let state = createGame(CONTENT, {
    seed: 'victory-browser',
    party: ['kaya', 'nilak', 'bo'].map((characterId) => ({ characterId })),
    startNode: 'battle_forest_road',
  });
  state = apply(CONTENT, state, { type: 'enterNode', nodeId: 'battle_forest_road' }).state;
  if (!state.battle) throw new Error('Missing the forest battle');
  state = {
    ...state,
    battle: {
      ...state.battle,
      units: state.battle.units.map((unit) =>
        unit.faction === 'party'
          ? {
              ...unit,
              ai:
                unit.element === 'water'
                  ? 'support'
                  : unit.element === 'earth'
                    ? 'cautious'
                    : 'aggressive',
            }
          : unit,
      ),
    },
  };
  for (let turn = 0; turn < 100; turn++) {
    const battle = state.battle!;
    const actor = battle.units.find((unit) => unit.id === battle.order[battle.turnIndex]);
    if (!actor) throw new Error('Missing the acting unit');
    const next = apply(
      CONTENT,
      state,
      outcome === 'defeat' && actor.faction === 'party'
        ? { type: 'endTurn', unitId: actor.id }
        : { type: 'runAiTurn' },
    );
    if (next.state.battle?.phase !== 'active') {
      if (next.state.battle?.phase !== outcome)
        throw new Error(`Fixture ended in ${next.state.battle?.phase}`);
      // Replay the final AI turn as individual legal commands. The browser
      // receives the active save immediately before its actual finishing hit,
      // without changing anyone's HP, positions, RNG, or battle phase.
      for (const event of next.events) {
        const command: Command | null =
          event.type === 'unitMoved'
            ? { type: 'move', unitId: event.unitId, path: event.path }
            : event.type === 'abilityUsed'
              ? {
                  type: 'useAbility',
                  unitId: event.unitId,
                  abilityId: event.abilityId,
                  target: event.target,
                }
              : null;
        if (!command) continue;
        const step = apply(CONTENT, state, command);
        if (step.state.battle?.phase === outcome) return { state, command };
        state = step.state;
      }
      throw new Error('Could not isolate a legal finishing action');
    }
    state = next.state;
  }
  throw new Error('The fixture did not finish within 100 turns');
}

const session = { players: [{ name: 'Explorer', unitId: 'p0' }] };
const fixtures = { victory: finalAction('victory'), defeat: finalAction('defeat') };

type RendererProbe = {
  camera: Camera;
  lastView: MapView | null;
  backend: { draw(view: MapView, camera: Camera): void; barTops: Map<string, number> };
  draw(view: MapView): void;
};
type SceneProbe = { renderer: RendererProbe; holdAi(): void };
interface FrameProbe {
  busyCards: number;
  firstIdle: null | { at: number; holding: boolean; camera: unknown; standing: string[] };
  cardAt: number | null;
}

async function readProbe(page: Page): Promise<FrameProbe> {
  return page.evaluate(() => {
    const probe = (window as Window & { victoryProbe?: FrameProbe }).victoryProbe;
    if (!probe) throw new Error('The victory frame probe was not installed');
    return probe;
  });
}

async function prepare(page: Page, renderer: string, reduceMotion = false): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await resetStorage(page, `?renderer=${renderer}`);
  await page.evaluate(
    ({ state, session, reduceMotion }) => {
      const app = window.fnt!.app;
      // The general e2e helper defaults this to true; playback is explicit here.
      app.updateSettings({ reduceMotion });
      app.adoptSave(state, session);
      (app as unknown as { scene: SceneProbe }).scene.holdAi();
    },
    { state: fixtures.victory.state, session, reduceMotion },
  );
  await page.waitForFunction(() => !window.fnt!.app.curtainBusy, undefined, { timeout: 60_000 });
  await settleLayout(page, 60_000);
  await pauseClock(page);
  expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(renderer);
}

async function finish(page: Page, outcome: 'victory' | 'defeat' = 'victory') {
  return page.evaluate((command) => {
    const app = window.fnt!.app;
    const renderer = (app as unknown as { scene: SceneProbe }).scene.renderer;
    const probe: FrameProbe = { busyCards: 0, firstIdle: null, cardAt: null };
    const win = window as Window & { victoryProbe?: FrameProbe };
    win.victoryProbe = probe;
    const draw = renderer.draw.bind(renderer);
    renderer.draw = (view) => {
      draw(view);
      if (app.state?.battle?.phase !== 'victory') return;
      const now = performance.now();
      const idle = !app.animator.busy(now) && now >= app.animator.finishesAt;
      const card = Boolean(document.querySelector('.result-panel'));
      if (!idle && card) probe.busyCards++;
      if (idle && !probe.firstIdle)
        probe.firstIdle = {
          at: now,
          holding:
            document.querySelector('.combat-scene')?.getAttribute('data-victory-beat') === 'active',
          camera: app.rendererCamera(),
          standing: view.units
            .filter((unit) => unit.faction === 'party' && !unit.fallen && unit.hp > 0)
            .filter(
              (unit) =>
                !unit.renderPos && !unit.bend && (!unit.clip || unit.clip.startsWith('stance')),
            )
            .map((unit) => unit.id),
        };
      if (card && probe.cardAt === null) probe.cardAt = now;
    };
    const before = app.rendererCamera();
    const events = app.dispatch(command);
    return {
      before,
      events: events.map((event) => event.type),
      phase: app.state!.battle!.phase,
      now: performance.now(),
      finishesAt: app.animator.finishesAt,
      busy: app.animator.busy(performance.now()),
    };
  }, fixtures[outcome].command);
}

async function reachIdle(page: Page, finishesAt: number) {
  // Jump the fake clock without rasterising every intermediate software-GL
  // frame, but draw and inspect the final busy frame before crossing idle.
  const remaining = await page.evaluate((end) => end - performance.now(), finishesAt);
  if (remaining > 2) await page.clock.fastForward(Math.floor(remaining - 1));
  await expect(page.locator('.result-panel')).toHaveCount(0);
  await expect(page.locator('.victory-beat-skip')).toHaveCount(0);
  const finalHitFrame = await page.evaluate(() => window.fnt!.app.rendererCamera());
  await page.clock.runFor(32);
  return finalHitFrame;
}

/** Actual backend pixels, read synchronously before WebGL discards its buffer. */
async function paintedParty(page: Page, info: TestInfo): Promise<void> {
  const shot = await page.evaluate((footLine) => {
    const app = window.fnt!.app;
    const renderer = (app as unknown as { scene: SceneProbe }).scene.renderer;
    const view = renderer.lastView;
    const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
    if (!view || !canvas) throw new Error('The victory frame has not been painted');
    const { camera, backend } = renderer;
    const party = view.units.filter(
      (unit) => unit.faction === 'party' && !unit.fallen && unit.hp > 0,
    );
    backend.draw(view, camera);
    const withParty = canvas.toDataURL('image/png');
    const bodies = party.map((unit) => {
      const box = camera.spriteBox(unit.pos, unit.size, true);
      // barTops is measured from the actual loaded cel, including its headroom.
      const measuredTop = backend.barTops.get(unit.id);
      if (measuredTop === undefined) throw new Error(`No painted silhouette for ${unit.id}`);
      // Canvas measures in CSS pixels; Pixi builds upright art in world
      // coordinates, then applies its layer's scale and offset.
      const top =
        app.rendererBackend() === 'webgl'
          ? measuredTop * camera.scale - camera.offsetY
          : measuredTop;
      const width = box.size * unit.size;
      const scale = unit.scale ?? 1;
      return {
        id: unit.id,
        left: box.x + (width - width * scale) / 2,
        right: box.x + (width + width * scale) / 2,
        top,
        bottom: box.y + footLine * box.size,
        pos: unit.pos,
        tilePx: box.size,
      };
    });
    backend.draw({ ...view, units: view.units.filter((unit) => unit.faction !== 'party') }, camera);
    const withoutParty = canvas.toDataURL('image/png');
    backend.draw(view, camera);
    return {
      withParty,
      withoutParty,
      bodies,
      viewport: camera.viewport,
      scale: camera.scale,
      dpr: canvas.width / canvas.getBoundingClientRect().width,
      canvas: { width: canvas.width, height: canvas.height },
    };
  }, FOOT_LINE);
  const decode = (data: string) => PNG.sync.read(Buffer.from(data.split(',')[1]!, 'base64'));
  const withParty = decode(shot.withParty),
    withoutParty = decode(shot.withoutParty);
  const changed = (i: number) =>
    [0, 1, 2].some(
      (channel) => Math.abs(withParty.data[i + channel]! - withoutParty.data[i + channel]!) > 12,
    );
  let totalDiff = 0;
  for (let i = 0; i < withParty.data.length; i += 4) if (changed(i)) totalDiff++;
  const samples = shot.bodies.map((body) => {
    const lift = liftAlong(fixtures.victory.state.battle!.grid, body.pos, 'oblique') * body.tilePx;
    const bottom = body.bottom - lift;
    let inked = 0;
    for (
      let y = Math.max(0, Math.ceil(body.top * shot.dpr));
      y < Math.min(withParty.height, Math.floor(bottom * shot.dpr));
      y++
    )
      for (
        let x = Math.max(0, Math.ceil(body.left * shot.dpr));
        x < Math.min(withParty.width, Math.floor(body.right * shot.dpr));
        x++
      )
        if (changed((y * withParty.width + x) * 4)) inked++;
    return { ...body, bottom, inked };
  });
  // Save diagnostics before assertions, including when a backend crop fails.
  await info.attach('standing-party-victory-frame', {
    body: PNG.sync.write(withParty),
    contentType: 'image/png',
  });
  await info.attach('victory-frame-without-party', {
    body: PNG.sync.write(withoutParty),
    contentType: 'image/png',
  });
  await info.attach('victory-body-pixels', {
    body: JSON.stringify(
      {
        viewport: shot.viewport,
        scale: shot.scale,
        dpr: shot.dpr,
        canvas: shot.canvas,
        totalDiff,
        samples,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  // The natural fixture keeps all three allies alive and spread across the board.
  expect(samples.map((body) => body.id).sort()).toEqual(['p0', 'p1', 'p2']);
  expect(shot.scale * shot.viewport.dpr).toBeCloseTo(Math.round(shot.scale * shot.viewport.dpr), 6);
  expect(withParty.width).toBe(shot.canvas.width);
  expect(withParty.height).toBe(shot.canvas.height);
  for (const body of samples) {
    expect(body.left, `${body.id} left`).toBeGreaterThanOrEqual(0);
    expect(body.right, `${body.id} right`).toBeLessThanOrEqual(shot.viewport.width);
    expect(body.top, `${body.id} head`).toBeGreaterThanOrEqual(0);
    expect(body.bottom, `${body.id} feet`).toBeLessThanOrEqual(shot.viewport.height);
    expect(body.inked, `${body.id} must contribute visible body pixels`).toBeGreaterThan(
      24 * shot.dpr * shot.dpr,
    );
  }
}

for (const surface of [
  { name: 'Surface', viewport: { width: 1368, height: 912 }, deviceScaleFactor: 1 },
  { name: 'compact DPR2', viewport: { width: 820, height: 640 }, deviceScaleFactor: 2 },
]) {
  test.describe(surface.name, () => {
    test.use({ viewport: surface.viewport, deviceScaleFactor: surface.deviceScaleFactor });
    for (const renderer of ['canvas', 'webgl']) {
      test(`a legal final hit waits for idle, then holds the standing party for a second on ${renderer}`, async ({
        page,
      }, info) => {
        allowSoftwareWebgl(test, renderer);
        await prepare(page, renderer);
        const ending = await finish(page);
        expect(ending.phase).toBe('victory');
        expect(ending.events).toEqual(
          expect.arrayContaining(['abilityUsed', 'damaged', 'unitDied', 'battleEnded']),
        );
        expect(ending.busy).toBe(true);
        await expect(page.locator('.result-panel')).toHaveCount(0);
        expect(await reachIdle(page, ending.finishesAt)).toEqual(ending.before);
        await expect(page.locator('.combat-scene')).toHaveAttribute('data-victory-beat', 'active');
        const first = (await readProbe(page)).firstIdle;
        expect(first?.holding).toBe(true);
        expect(first?.standing.sort()).toEqual(['p0', 'p1', 'p2']);
        expect(first?.camera).toEqual(await page.evaluate(() => window.fnt!.app.rendererCamera()));
        await page.clock.runFor(16);
        await info.attach('victory-beat-on-screen', {
          body: await page.screenshot({ scale: 'device' }),
          contentType: 'image/png',
        });
        await paintedParty(page, info);
        await page.clock.fastForward(900);
        await expect(page.locator('.result-panel')).toHaveCount(0);
        await expect(
          page.getByRole('button', { name: 'Show victory result', exact: true }),
        ).toBeVisible();
        await page.clock.runFor(150);
        await expect(
          page.getByRole('heading', { name: 'The fight is won', exact: true }),
        ).toBeVisible();
        await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
        const probe = await readProbe(page);
        expect(probe.busyCards).toBe(0);
        expect(probe.cardAt! - probe.firstIdle!.at).toBeGreaterThanOrEqual(1000);
        expect(probe.cardAt! - probe.firstIdle!.at).toBeLessThan(1100);
      });
    }
  });
}

test('the named skip consumes its tap, and a terminal save shows the result without replay', async ({
  page,
}) => {
  await prepare(page, 'canvas');
  const ending = await finish(page);
  await reachIdle(page, ending.finishesAt);
  const skip = page.getByRole('button', { name: 'Show victory result', exact: true });
  await expect(skip).toBeVisible();
  const before = await page.evaluate(() => JSON.stringify(window.fnt!.app.state));
  const box = await skip.boundingBox();
  if (!box) throw new Error('Missing victory skip surface');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  expect(
    await skip.evaluate((button) => ({
      background: getComputedStyle(button).backgroundColor,
      transform: getComputedStyle(button).transform,
    })),
  ).toEqual({ background: 'rgba(0, 0, 0, 0)', transform: 'none' });
  await page.mouse.up();
  await expect(page.locator('.result-panel')).toHaveCount(1);
  expect(await page.evaluate(() => JSON.stringify(window.fnt!.app.state))).toBe(before);
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
  // Save while terminal, then replace the mounted scene through the real save path.
  await page.evaluate(() => {
    const app = window.fnt!.app;
    if (!app.saveTo('slot1')) throw new Error('Could not save the terminal battle');
    const saved = JSON.parse(localStorage.getItem('fnt.save.slot1')!);
    app.adoptSave(saved.state, saved.session);
  });
  await expect(page.locator('.result-panel')).toHaveCount(1);
  await expect(page.locator('.victory-beat-skip')).toHaveCount(0);
  await expect(page.locator('.combat-scene')).not.toHaveAttribute('data-victory-beat');
  await page.clock.fastForward(1500);
  expect(await page.evaluate(() => JSON.stringify(window.fnt!.app.state))).toBe(before);
  await expect(page.locator('.result-panel')).toHaveCount(1);
});

test('reduced motion retains the final hit frame and reveals the result on the first idle frame; defeat stays immediate', async ({
  page,
}) => {
  await prepare(page, 'canvas', true);
  const ending = await finish(page);
  const frame = await page.evaluate(() => window.fnt!.app.rendererCamera());
  expect(frame).toEqual(ending.before);
  await reachIdle(page, ending.finishesAt);
  await expect(page.locator('.result-panel')).toHaveCount(1);
  await expect(page.locator('.victory-beat-skip')).toHaveCount(0);
  await expect(page.locator('.combat-scene')).not.toHaveAttribute('data-victory-beat');
  expect(await page.evaluate(() => window.fnt!.app.rendererCamera())).toEqual(frame);
  const probe = await readProbe(page);
  expect(probe.firstIdle?.holding).toBe(false);
  expect(probe.cardAt).toBe(probe.firstIdle?.at);
  expect(probe.busyCards).toBe(0);

  await page.evaluate(
    ({ state, session }) => {
      const app = window.fnt!.app;
      app.updateSettings({ reduceMotion: false });
      app.adoptSave(state, session);
      (app as unknown as { scene: SceneProbe }).scene.holdAi();
    },
    { state: fixtures.defeat.state, session },
  );
  const defeat = await finish(page, 'defeat');
  expect(defeat.phase).toBe('defeat');
  expect(defeat.busy).toBe(true);
  await expect(page.getByRole('heading', { name: 'Driven back', exact: true })).toBeVisible();
  await expect(page.locator('.victory-beat-skip')).toHaveCount(0);
  await expect(page.locator('.combat-scene')).not.toHaveAttribute('data-victory-beat');
});
