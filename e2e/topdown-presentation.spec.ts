import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { MapDef } from '../src/core/types';
import { buildGrid } from '../src/core/rules/grid';
import {
  enterNode,
  resetStorage,
  settleLayout,
  settleMapCanvas,
  startGame,
  takeTurn,
  waitForIdle,
} from './helpers';
import { paintedGroundPoint, paintedTileCentre } from './projection';

const WIDTH = 20;
const HEIGHT = 12;
const TOPDOWN_BOARD: MapDef = {
  id: 'e2e.issue456.topdown',
  name: 'Top-down presentation test board',
  kind: 'combat',
  projection: 'topdown',
  width: WIDTH,
  height: HEIGHT,
  rows: Array.from({ length: HEIGHT }, () => '.'.repeat(WIDTH)),
  legend: { '.': { terrain: 'grass' } },
  partySpawns: [{ x: 8, y: 5 }],
  npcs: [],
  props: [],
  ambience: 'forest',
  scene: {
    ground: [],
    scenery: [],
    paintExtent: { x: 0, y: 0, width: WIDTH * 40, height: HEIGHT * 40 },
  },
};
const TOPDOWN_GRID = buildGrid(TOPDOWN_BOARD);

async function waitForBoardPlayback(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const app = window.fnt?.app as unknown as {
        scene?: {
          sceneAnimator?: { busy(now: number): boolean };
          presentationClock?: { now(wallNow?: number): number };
        };
      };
      const animator = app?.scene?.sceneAnimator;
      const clock = app?.scene?.presentationClock;
      return !animator || !clock || !animator.busy(clock.now(performance.now()));
    },
    undefined,
    { timeout: 20_000 },
  );
}

async function stageTopdownEncounter(page: Page): Promise<void> {
  await page.evaluate(
    ({ map, grid }) => {
      const app = window.fnt!.app;
      const maps = app.content.maps as Map<string, MapDef>;
      maps.set(map.id, map);
      const state = app.state;
      const battle = state?.battle;
      const party = battle?.units.find((unit) => unit.faction === 'party' && unit.hp > 0);
      const enemy = battle?.units.find((unit) => unit.faction === 'enemy' && unit.hp > 0);
      if (!state || !battle || !party || !enemy) throw new Error('Missing story battle units.');
      const units = [
        { ...party, pos: { x: 8, y: 5 }, ap: Math.max(2, party.ap) },
        { ...enemy, pos: { x: 9, y: 5 }, hp: Math.max(5, enemy.hp) },
      ];
      const staged = {
        ...state,
        battle: {
          ...battle,
          mapId: map.id,
          grid,
          props: [],
          temporaryWalls: [],
          units,
          order: units.map((unit) => unit.id),
          turnIndex: 0,
        },
      };
      app.adoptSave(staged, app.session.toMeta());
      app.updateSettings({ reduceMotion: false });
    },
    { map: TOPDOWN_BOARD, grid: TOPDOWN_GRID },
  );
  await page.waitForFunction(() => window.fnt?.app.rendererCamera()?.projection === 'topdown');
  await settleMapCanvas(page);
  await settleLayout(page);
}

async function canvasCorners(page: Page) {
  const canvas = await page.locator('.map-canvas').boundingBox();
  const corners = await Promise.all([
    paintedGroundPoint(page, { x: 0, y: 0 }),
    paintedGroundPoint(page, { x: WIDTH, y: 0 }),
    paintedGroundPoint(page, { x: 0, y: HEIGHT }),
    paintedGroundPoint(page, { x: WIDTH, y: HEIGHT }),
  ]);
  if (!canvas || corners.some((point) => !point))
    throw new Error('Missing projected board corners.');
  return {
    canvas,
    corners: corners as { x: number; y: number }[],
  };
}

test('top-down Recentre fits the whole 20x12 board and speed/skip stay presentation-only', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await resetStorage(page, '?style=topdown&renderer=canvas');
  await startGame(page, ['Kaya'], ['kaya'], 'avatar456-topdown-short-fight', {
    reduceMotion: false,
  });
  await enterNode(page, 'battle_forest_road');
  expect(await takeTurn(page)).toBe(true);
  await waitForIdle(page);
  await stageTopdownEncounter(page);
  const topDownAssetsLoaded = await page.waitForFunction(() => {
    const style = new URLSearchParams(location.search).get('style');
    const resources = performance.getEntriesByType('resource').map((entry) => {
      try {
        return new URL(entry.name).pathname;
      } catch {
        return '';
      }
    });
    return (
      style === 'topdown' &&
      resources.some((path) => path.endsWith('/art/topdown/kaya.json')) &&
      resources.some((path) => path.endsWith('/art/topdown/kaya.webp'))
    );
  });
  expect(await topDownAssetsLoaded.jsonValue()).toBe(true);

  const staged = await page.evaluate(() => {
    const app = window.fnt!.app;
    const battle = app.state!.battle!;
    const map = app.content.maps.get(battle.mapId)!;
    const camera = app.rendererCamera()!;
    return {
      projection: camera.projection,
      backend: app.rendererBackend(),
      grid: { width: battle.grid.width, height: battle.grid.height },
      paintExtent: map.scene?.paintExtent,
      tilePx: camera.tilePx,
    };
  });
  expect(staged.backend).toBe('canvas');
  expect(staged.projection).toBe('topdown');
  expect(staged.grid).toEqual({ width: WIDTH, height: HEIGHT });
  expect(staged.paintExtent).toEqual({ x: 0, y: 0, width: WIDTH * 40, height: HEIGHT * 40 });
  expect(staged.tilePx).toBeGreaterThanOrEqual(40);

  const canvas = page.locator('.map-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Missing top-down map canvas.');
  await page.evaluate(
    ({ x, y }) => {
      const target = document.querySelector<HTMLCanvasElement>('.map-canvas');
      if (!target) throw new Error('Missing top-down map canvas.');
      const rect = target.getBoundingClientRect();
      const fire = (type: string, id: number, point: { x: number; y: number }) =>
        target.dispatchEvent(
          new PointerEvent(type, {
            pointerId: id,
            pointerType: 'touch',
            isPrimary: id === 1,
            clientX: rect.left + point.x,
            clientY: rect.top + point.y,
            button: 0,
            buttons: 1,
            bubbles: true,
            cancelable: true,
          }),
        );
      const from = [
        { x: x / 2 - 28, y: y / 2 },
        { x: x / 2 + 28, y: y / 2 },
      ];
      const to = [
        { x: x / 2 - 70, y: y / 2 },
        { x: x / 2 + 70, y: y / 2 },
      ];
      fire('pointerdown', 1, from[0]!);
      fire('pointerdown', 2, from[1]!);
      for (let step = 1; step <= 6; step++) {
        const t = step / 6;
        for (const id of [0, 1] as const) {
          const a = from[id]!;
          const b = to[id]!;
          fire('pointermove', id + 1, { x: a.x + (b.x - a.x) * t, y: a.y });
        }
      }
      fire('pointerup', 1, to[0]!);
      fire('pointerup', 2, to[1]!);
    },
    { x: box.width, y: box.height },
  );
  await settleLayout(page);
  await settleMapCanvas(page);
  const zoomed = await page.evaluate(() => window.fnt!.app.rendererCamera()!);
  expect(zoomed.fitted).toBe(false);
  await expect(page.getByRole('button', { name: /^Recentre$/ })).toBeVisible();

  await page.getByRole('button', { name: /^Recentre$/ }).click();
  await settleMapCanvas(page);
  const recentered = await page.evaluate(() => window.fnt!.app.rendererCamera()!);
  const fitted = await canvasCorners(page);
  expect(recentered.projection).toBe('topdown');
  expect(recentered.fitted).toBe(true);
  expect(recentered.tilePx).toBeGreaterThanOrEqual(40);
  for (const point of fitted.corners) {
    expect(point.x).toBeGreaterThanOrEqual(fitted.canvas.x - 1);
    expect(point.x).toBeLessThanOrEqual(fitted.canvas.x + fitted.canvas.width + 1);
    expect(point.y).toBeGreaterThanOrEqual(fitted.canvas.y - 1);
    expect(point.y).toBeLessThanOrEqual(fitted.canvas.y + fitted.canvas.height + 1);
  }
  await expect(page.getByRole('button', { name: /^Recentre$/ })).toBeHidden();

  const stateBeforeControls = await page.evaluate(() => {
    const { state } = window.fnt!.app;
    return JSON.stringify({ rng: state!.rng, log: state!.log, battle: state!.battle });
  });
  const cycleSpeed = async (from: number, to: number) => {
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('button', { name: `Combat speed ${from} times` }).click();
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await expect(page.getByRole('button', { name: `Combat speed ${to} times` })).toBeVisible();
  };
  await cycleSpeed(1, 2);
  await cycleSpeed(2, 3);
  await cycleSpeed(3, 1);
  expect(
    await page.evaluate(() => {
      const { state } = window.fnt!.app;
      return JSON.stringify({ rng: state!.rng, log: state!.log, battle: state!.battle });
    }),
  ).toBe(stateBeforeControls);

  await page.getByRole('button', { name: /^Fire Jab/ }).click();
  await settleMapCanvas(page);
  const target = await paintedTileCentre(page, { x: 9, y: 5 });
  if (!target) throw new Error('Missing target projection.');
  await page.mouse.click(target.x, target.y);
  await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();

  const afterFightCommand = await page.evaluate(() => {
    const { state } = window.fnt!.app;
    return JSON.stringify({ rng: state!.rng, log: state!.log, battle: state!.battle });
  });
  expect(afterFightCommand).not.toBe(stateBeforeControls);
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Skip animation', exact: true }).click();
  expect(
    await page.evaluate(() => {
      const { state } = window.fnt!.app;
      return JSON.stringify({ rng: state!.rng, log: state!.log, battle: state!.battle });
    }),
  ).toBe(afterFightCommand);
  await waitForBoardPlayback(page);
});
