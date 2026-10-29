import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { CameraInfo } from '../src/app/App';
import { CONTENT } from '../src/content';
import { RngCursor } from '../src/core/rng';
import { occupiedCells, reachable } from '../src/core/rules/grid';
import { BattleDraft } from '../src/core/state/battleDraft';
import type { Vec2 } from '../src/core/types';
import { liftAt } from '../src/render/geometry/elevation';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import { groundPoint } from './projection';

/** A new, explicit fixture seed; the earlier full demo review did not pin one. */
const SEED = 'avatar-328-threat-overview';
const PARTY = ['kaya', 'sura', 'bo'];
const PLAYERS = ['Elias', 'Lorelai', 'Frehley'];

interface SceneProbe {
  readonly mode: unknown;
  readonly pending: Vec2 | null;
  readonly enemyOverview?: unknown;
}

interface ClickProbe {
  readonly camera: CameraInfo | null;
  readonly overview: boolean;
}

interface ProbeWindow {
  threatOverviewClick?: ClickProbe;
  detachedThreatButton?: HTMLButtonElement;
}

/** Read-only observations; no fixture writes to actors, rules, or camera state. */
async function readView(page: Page) {
  return page.evaluate(() => {
    const app = window.fnt!.app;
    const battle = app.state?.battle;
    const camera = app.rendererCamera();
    const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
    const scene = (app as unknown as { scene: SceneProbe }).scene;
    if (!battle || !camera || !canvas) throw new Error('Missing live battlefield.');
    const actor = battle.units.find((unit) => unit.id === battle.order[battle.turnIndex]);
    if (!actor) throw new Error('Missing acting unit.');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return {
      state: JSON.stringify(app.state),
      rng: app.state!.rng,
      mode: JSON.stringify(scene.mode),
      pending: scene.pending,
      overview: scene.enemyOverview != null,
      battle,
      actor,
      camera,
      backend: app.rendererBackend(),
      dpr,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      box: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      stretch: { x: rect.width / (canvas.width / dpr), y: rect.height / (canvas.height / dpr) },
    };
  });
}

type View = Awaited<ReturnType<typeof readView>>;

function projectedCentre(view: View, pos: Vec2): Vec2 {
  const point = groundPoint(view.camera, { x: pos.x + 0.5, y: pos.y + 0.5 });
  const lift = liftAt(view.battle.grid, pos, view.camera.projection) * view.camera.tilePx;
  return {
    x: view.box.x + point.x * view.stretch.x,
    y: view.box.y + (point.y - lift) * view.stretch.y,
  };
}

function expectInsideCanvas(view: View, pos: Vec2, label: string): Vec2 {
  const point = projectedCentre(view, pos);
  const margin = 4;
  expect(point.x, `${label}: left`).toBeGreaterThan(Math.max(0, view.box.x) + margin);
  expect(point.x, `${label}: right`).toBeLessThan(
    Math.min(view.viewport.width, view.box.x + view.box.width) - margin,
  );
  expect(point.y, `${label}: top`).toBeGreaterThan(Math.max(0, view.box.y) + margin);
  expect(point.y, `${label}: bottom`).toBeLessThan(
    Math.min(view.viewport.height, view.box.y + view.box.height) - margin,
  );
  return point;
}

function expectWholeDevicePixels(view: View): void {
  const scale = (view.camera.tilePx / 64) * view.dpr;
  expect(scale).toBeGreaterThanOrEqual(1);
  expect(scale).toBeCloseTo(Math.round(scale), 6);
  expect(view.camera.offsetX * view.dpr).toBeCloseTo(Math.round(view.camera.offsetX * view.dpr), 6);
  expect(view.camera.offsetY * view.dpr).toBeCloseTo(Math.round(view.camera.offsetY * view.dpr), 6);
}

function expectNavigationOnly(view: View, before: View): void {
  // Complete state equality includes the RNG, turn, AP, movement, and event log.
  expect(view.state).toBe(before.state);
  expect(view.mode).toBe(before.mode);
  expect(view.pending).toEqual(before.pending);
}

async function expectThreatsVisible(page: Page, view: View): Promise<void> {
  const enemies = view.battle.units.filter((unit) => unit.faction === 'enemy' && unit.hp > 0);
  const props = view.battle.props.filter((prop) => prop.hp > 0);
  expect(enemies.length).toBeGreaterThan(0);
  expect(props).toHaveLength(4);
  expect(props.find((prop) => prop.propId === 'oil_flask')?.pos).toEqual({ x: 13, y: 6 });
  const points = [
    ...enemies.flatMap((unit) =>
      occupiedCells(unit).map((pos) => expectInsideCanvas(view, pos, `enemy ${unit.id}`)),
    ),
    ...props.map((prop) => expectInsideCanvas(view, prop.pos, `prop ${prop.id}`)),
  ];
  // A point inside an oversized backing store is insufficient: the actual
  // page hit target must be the canvas, clear of the header, dock and overlays.
  expect(
    await page.evaluate(
      (samples) =>
        samples.every(
          (point) =>
            document.elementFromPoint(point.x, point.y) === document.querySelector('.map-canvas'),
        ),
      points,
    ),
  ).toBe(true);
  expectWholeDevicePixels(view);
}

async function readViewControls(page: Page) {
  return page
    .getByRole('button', { name: /^(More|Show enemies)$/, includeHidden: true })
    .evaluateAll((buttons) => {
      const observe = (name: string) => {
        const button = buttons.find(
          (node) => (node.getAttribute('aria-label') ?? node.textContent)?.trim() === name,
        );
        if (!button) return null;
        const rect = button.getBoundingClientRect();
        return {
          visible:
            !button.closest('[aria-hidden="true"]') &&
            getComputedStyle(button).visibility === 'visible' &&
            rect.width > 0 &&
            rect.height > 0,
          enabled: !button.matches(':disabled') && !button.closest('[aria-disabled="true"]'),
          expanded: button.getAttribute('aria-expanded'),
        };
      };
      return { more: observe('More'), show: observe('Show enemies') };
    });
}

async function openViewMenu(page: Page) {
  const controls = await readViewControls(page);
  if (controls.more?.visible && controls.more.expanded !== 'true') {
    expect(controls.more.enabled, 'More enabled').toBe(true);
    await page.getByRole('button', { name: 'More', exact: true }).tap();
    return readViewControls(page);
  }
  return controls;
}

async function showEnemies(page: Page, keyboard = false): Promise<void> {
  const controls = await openViewMenu(page);
  const show = page.getByRole('button', { name: 'Show enemies', exact: true });
  expect(controls.show?.visible, 'Show enemies visible').toBe(true);
  expect(controls.show?.enabled, 'Show enemies enabled').toBe(true);
  if (keyboard) await show.press('Enter');
  else await show.tap();
}

async function observeNextOverviewClick(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Show enemies', exact: true }).evaluate((node) => {
    const probeWindow = window as unknown as ProbeWindow;
    delete probeWindow.threatOverviewClick;
    // Registered after the real handler: this captures its synchronous result
    // in the same click event, before a timer or animation frame can finish it.
    node.addEventListener(
      'click',
      () => {
        const app = window.fnt!.app;
        const scene = (app as unknown as { scene: SceneProbe }).scene;
        probeWindow.threatOverviewClick = {
          camera: app.rendererCamera(),
          overview: scene.enemyOverview != null,
        };
      },
      { once: true },
    );
  });
}

function visibleMoveTargets(view: View): Vec2[] {
  const draft = new BattleDraft(CONTENT, view.battle, new RngCursor(view.rng));
  const actor = draft.unit(view.actor.id);
  if (!actor) throw new Error('Missing movement actor.');
  return [...reachable(draft.moveContext(actor), actor.pos, actor.move).values()]
    .filter((cell) => cell.pos.x !== actor.pos.x || cell.pos.y !== actor.pos.y)
    .filter((cell) => liftAt(view.battle.grid, cell.pos, view.camera.projection) === 0)
    .filter((cell) => {
      const point = projectedCentre(view, cell.pos);
      return (
        point.x > view.box.x + 24 &&
        point.x < view.box.x + view.box.width - 24 &&
        point.y > view.box.y + 24 &&
        point.y < view.box.y + view.box.height - 24
      );
    })
    .sort((a, b) => a.cost - b.cost || a.pos.y - b.pos.y || a.pos.x - b.pos.x)
    .map((cell) => cell.pos);
}

async function tapTile(page: Page, view: View, pos: Vec2): Promise<void> {
  const point = projectedCentre(view, pos);
  expect(
    await page.evaluate(
      (at) => document.elementFromPoint(at.x, at.y) === document.querySelector('.map-canvas'),
      point,
    ),
  ).toBe(true);
  await page.touchscreen.tap(point.x, point.y);
}

async function capture(page: Page, info: TestInfo, label: string, view: View): Promise<void> {
  const filename = `threat-overview-${label}.png`;
  const folder = process.env.FNT_REVIEW_DIR;
  if (folder) mkdirSync(folder, { recursive: true });
  await page.screenshot({ path: folder ? join(folder, filename) : info.outputPath(filename) });
  await info.attach(`${label}-geometry`, {
    body: JSON.stringify({
      seed: SEED,
      party: PARTY,
      camera: view.camera,
      box: view.box,
      dpr: view.dpr,
    }),
    contentType: 'application/json',
  });
}

async function enterForest(page: Page, renderer: string, reduceMotion: boolean): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await resetStorage(page, `?renderer=${renderer}`);
  await startGame(page, PLAYERS, PARTY, SEED, { reduceMotion });
  // Skip the unrelated campaign walk through the normal reducer entry path.
  // Actor positions, enemies, props, HP and camera are never staged.
  await enterNode(page, 'battle_forest_road');
  expect(await takeTurn(page)).toBe(true);
  await waitForIdle(page);
  await settleLayout(page);
}

for (const profile of [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  { name: 'portrait', viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2 },
]) {
  test.describe(`threat overview ${profile.name}`, () => {
    test.use({
      viewport: profile.viewport,
      deviceScaleFactor: profile.deviceScaleFactor,
      hasTouch: true,
    });

    for (const renderer of ['canvas', 'webgl'] as const) {
      // Four complete flows cover both motion settings without repeating eight
      // long software-renderer flows. The setting is explicit in every title.
      const reduceMotion = (profile.name === 'desktop') === (renderer === 'webgl');
      test(`shows every live threat and returns without taking an action on ${renderer}, reduced=${reduceMotion}`, async ({
        page,
      }, info) => {
        allowSoftwareWebgl(test, renderer);
        await enterForest(page, renderer, reduceMotion);
        const controls = await openViewMenu(page);
        // This is the intended first failure on unchanged main.
        expect(controls.show?.visible, 'Show enemies visible').toBe(true);

        await page.getByRole('button', { name: /^Move/ }).click();
        await settleLayout(page);
        const moveView = await readView(page);
        expect(moveView.backend).toBe(renderer);
        const targets = visibleMoveTargets(moveView);
        const first = targets[0];
        if (!first) throw new Error('Need a visible legal destination.');
        await tapTile(page, moveView, first);
        await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeEnabled();
        await settleLayout(page);
        const before = await readView(page);
        expect(before.pending).toEqual(first);

        if (reduceMotion) await observeNextOverviewClick(page);
        await showEnemies(page, renderer === 'webgl');
        await settleLayout(page);
        const overview = await readView(page);
        expect(overview.overview).toBe(true);
        expectNavigationOnly(overview, before);
        await expectThreatsVisible(page, overview);
        await expect(page.getByRole('button', { name: 'Recentre', exact: true })).toBeVisible();
        if (reduceMotion) {
          const immediate = await page.evaluate(
            () => (window as unknown as ProbeWindow).threatOverviewClick,
          );
          expect(immediate?.overview).toBe(true);
          if (!immediate?.camera) throw new Error('Missing synchronous reduced-motion frame.');
          await expectThreatsVisible(page, { ...overview, camera: immediate.camera });
        }
        await capture(page, info, `${profile.name}-${renderer}-enemies`, overview);

        // This tap returns to the actor instead of resolving/retargeting Move.
        await page.touchscreen.tap(
          overview.box.x + overview.box.width / 2,
          overview.box.y + overview.box.height / 2,
        );
        await settleLayout(page);
        const returned = await readView(page);
        expect(returned.overview).toBe(false);
        expectNavigationOnly(returned, before);
        expectInsideCanvas(returned, returned.actor.pos, 'returned actor');
        expect(returned.camera.tilePx).toBe(before.camera.tilePx);

        // Recentre must be reachable even when the overview fitted the board.
        await showEnemies(page);
        await openViewMenu(page);
        await page.getByRole('button', { name: 'Recentre', exact: true }).click();
        await settleLayout(page);
        const recentred = await readView(page);
        expect(recentred.overview).toBe(false);
        expectNavigationOnly(recentred, before);
        expectInsideCanvas(recentred, recentred.actor.pos, 'recentred actor');
        expectWholeDevicePixels(recentred);
        await capture(page, info, `${profile.name}-${renderer}-actor`, recentred);

        // The next genuine tile tap must use the restored painted projection.
        const second = visibleMoveTargets(recentred).find(
          (pos) => pos.x !== first.x || pos.y !== first.y,
        );
        if (!second) throw new Error('Need a different visible legal destination after returning.');
        await tapTile(page, recentred, second);
        await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeEnabled();
        expect((await readView(page)).pending).toEqual(second);
        await page.getByRole('button', { name: 'Confirm', exact: true }).click();
        await waitForIdle(page);
        await expect.poll(async () => (await readView(page)).actor.pos).toEqual(second);

        // Advance through the real reducer and native AI. No positions or turn
        // order are injected, and later party turns must not enter overview.
        await showEnemies(page);
        expect((await readView(page)).overview).toBe(true);
        await page.evaluate(() => {
          const app = window.fnt!.app;
          const battle = app.state!.battle!;
          const actorId = battle.order[battle.turnIndex];
          if (!actorId) throw new Error('Missing turn owner.');
          app.dispatch({ type: 'endTurn', unitId: actorId });
        });
        expect(await takeTurn(page)).toBe(true);
        await waitForIdle(page);
        await settleLayout(page);
        const next = await readView(page);
        expect(next.actor.id).not.toBe(before.actor.id);
        expect(next.overview).toBe(false);
        expectInsideCanvas(next, next.actor.pos, 'next acting unit');
        expect(next.camera.tilePx).toBe(before.camera.tilePx);
      });
    }
  });
}

test.describe('threat overview phone controls and loaded scene', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });

  test('More exposes an accessible view action and loading clears its retained ownership', async ({
    page,
  }, info) => {
    await enterForest(page, 'canvas', true);
    const more = page.getByRole('button', { name: 'More', exact: true });
    const show = page.getByRole('button', { name: 'Show enemies', exact: true });
    await expect(more).toBeVisible();
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await expect(show).toBeHidden();
    await more.focus();
    await more.press('Enter');
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(show).toBeVisible();
    await expect(show).toBeEnabled();
    const control = await show.evaluate((node) => {
      const root = getComputedStyle(document.documentElement);
      const rect = node.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        tap: parseFloat(root.getPropertyValue('--tap')) * parseFloat(root.fontSize),
        mark: Boolean(node.querySelector('svg[aria-hidden="true"]')),
      };
    });
    expect(control.width).toBeGreaterThanOrEqual(control.tap - 0.5);
    expect(control.height).toBeGreaterThanOrEqual(control.tap - 0.5);
    expect(control.mark).toBe(true);
    const before = await readView(page);
    expect(before.backend).toBe('canvas');
    await show.press('Enter');
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await expect(more).toBeFocused();
    await settleLayout(page);
    const overview = await readView(page);
    expect(overview.overview).toBe(true);
    expectNavigationOnly(overview, before);
    await expectThreatsVisible(page, overview);
    await capture(page, info, 'phone-canvas-enemies', overview);

    await openViewMenu(page);
    const recentre = page.getByRole('button', { name: 'Recentre', exact: true });
    await expect(recentre).toBeVisible();
    await recentre.focus();
    await recentre.press('Enter');
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await expect(more).toBeFocused();
    await settleLayout(page);
    const returned = await readView(page);
    expect(returned.overview).toBe(false);
    expectNavigationOnly(returned, before);
    expectInsideCanvas(returned, returned.actor.pos, 'phone acting unit');

    await openViewMenu(page);
    await show.evaluate((node) => {
      (window as unknown as ProbeWindow).detachedThreatButton = node as HTMLButtonElement;
    });
    await show.tap();
    expect((await readView(page)).overview).toBe(true);
    // Adopt the genuine state through the existing load API. No terminal phase,
    // positions or camera values are manufactured for this lifecycle check.
    const loaded = await page.evaluate(() => {
      const app = window.fnt!.app;
      const battle = JSON.stringify(app.state!.battle);
      app.adoptSave(structuredClone(app.state!), app.session.toMeta());
      return {
        battle,
        after: JSON.stringify(app.state!.battle),
        opening: document.querySelector('.combat-scene')?.getAttribute('data-battle-opening'),
      };
    });
    expect(loaded.after).toBe(loaded.battle);
    expect(loaded.opening).toBeNull();
    expect(await takeTurn(page)).toBe(true);
    await waitForIdle(page);
    await settleLayout(page);
    const adopted = await readView(page);
    expect(adopted.overview).toBe(false);
    expectInsideCanvas(adopted, adopted.actor.pos, 'loaded acting unit');
    const stale = await page.evaluate(() => {
      const app = window.fnt!.app;
      const button = (window as unknown as ProbeWindow).detachedThreatButton;
      if (!button) throw new Error('Missing retained old control.');
      const beforeState = JSON.stringify(app.state);
      const beforeCamera = JSON.stringify(app.rendererCamera());
      button.click();
      return {
        detached: !button.isConnected,
        sameState: JSON.stringify(app.state) === beforeState,
        sameCamera: JSON.stringify(app.rendererCamera()) === beforeCamera,
      };
    });
    expect(stale).toEqual({ detached: true, sameState: true, sameCamera: true });
  });
});
