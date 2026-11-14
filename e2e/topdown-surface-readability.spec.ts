import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { PNG } from 'pngjs';
import { CONTENT } from '../src/content';
import { apply } from '../src/core/state/reducer';
import type { Command, GameEvent, GameState, Vec2 } from '../src/core/types';
import type { MapView } from '../src/render/view';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

// Owner-requested reference viewport; retain each project's actual DPR and engine.
test.use({ viewport: { width: 1280, height: 800 } });

type SceneApp = { scene: { renderer: { lastView: MapView | null } } };
type Recorded = {
  command: Command;
  before: GameState;
  after: GameState;
  events: readonly GameEvent[];
};
declare global {
  interface Window {
    surfaceReadabilityCommands?: Recorded[];
  }
}

const luminance = ([r = 0, g = 0, b = 0]: readonly number[]) =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;
const mean = (values: readonly number[]) =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

async function state(page: Page) {
  return page.evaluate(() => window.fnt!.app.state!);
}

async function snapshot(page: Page) {
  await settleLayout(page);
  return page.evaluate(() => {
    const app = window.fnt!.app;
    const canvas = document.querySelector<HTMLCanvasElement>('.combat-scene .map-canvas');
    const camera = app.rendererCamera();
    const view = (app as unknown as SceneApp).scene.renderer.lastView;
    if (!canvas || !camera || !view) throw new Error('No genuinely drawn combat board');
    const rect = canvas.getBoundingClientRect();
    return {
      state: app.state!,
      camera,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      width: canvas.width,
      height: canvas.height,
      dpr: devicePixelRatio,
      time: view.time,
      units: view.units.map((unit) => ({
        id: unit.id,
        pos: unit.renderPos ?? unit.pos,
        size: unit.size,
      })),
      paved: app.content.maps.get(app.state!.location.mapId)?.scene?.pavedCells ?? [],
    };
  });
}

async function capture(page: Page, info: TestInfo, cells: readonly Vec2[], name: string) {
  const drawn = await snapshot(page);
  expect(drawn.camera.projection).toBe('topdown');
  expect(drawn.dpr).toBeGreaterThan(0);
  expect(drawn.camera.tile).toBe(40);
  const png = PNG.sync.read(
    await page.screenshot({ path: info.outputPath(`${name}.png`), scale: 'css' }),
  );
  expect(png.width).toBe(1280);
  expect(png.height).toBe(800);
  const m = drawn.camera.groundTransform;
  const points = cells.flatMap((cell) => {
    const out: { world: Vec2; screen: Vec2; rgb: number[] }[] = [];
    for (let dy = 12; dy <= 26; dy += 2)
      for (let dx = 12; dx <= 26; dx += 2) {
        const world = { x: cell.x + (dx + 0.5) / 40, y: cell.y + (dy + 0.5) / 40 };
        // Exclude conservative upright envelopes; these samples describe the material, not a unit.
        if (
          drawn.units.some(
            ({ pos, size }) =>
              world.x >= pos.x - (size === 2 ? 0.5 : 0.35) &&
              world.x <= pos.x + (size === 2 ? 2.5 : 1.35) &&
              world.y >= pos.y - (size === 2 ? 2.5 : 1.5) &&
              world.y <= pos.y + (size === 2 ? 2.3 : 1.1),
          )
        )
          continue;
        const wx = world.x * 40,
          wy = world.y * 40;
        const screen = {
          x: Math.floor(
            drawn.rect.x +
              ((m.a * wx + m.c * wy + m.tx) * drawn.rect.width) / (drawn.width / drawn.dpr),
          ),
          y: Math.floor(
            drawn.rect.y +
              ((m.b * wx + m.d * wy + m.ty) * drawn.rect.height) / (drawn.height / drawn.dpr),
          ),
        };
        expect(screen.x).toBeGreaterThanOrEqual(0);
        expect(screen.x).toBeLessThan(png.width);
        expect(screen.y).toBeGreaterThanOrEqual(0);
        expect(screen.y).toBeLessThan(png.height);
        expect(screen.x + 0.5).toBeGreaterThanOrEqual(drawn.rect.x);
        expect(screen.x + 0.5).toBeLessThan(drawn.rect.x + drawn.rect.width);
        expect(screen.y + 0.5).toBeGreaterThanOrEqual(drawn.rect.y);
        expect(screen.y + 0.5).toBeLessThan(drawn.rect.y + drawn.rect.height);
        const i = (screen.y * png.width + screen.x) * 4;
        out.push({ world, screen, rgb: [...png.data.subarray(i, i + 3)] });
      }
    expect(out.length, `visible material samples for ${cell.x},${cell.y}`).toBeGreaterThan(0);
    return out;
  });
  expect(points.length, 'nonempty unoccluded material samples').toBeGreaterThan(60);
  const unobscured = await page.evaluate((points) => {
    const canvas = document.querySelector('.combat-scene .map-canvas');
    return points.every(
      ({ screen }) => document.elementFromPoint(screen.x + 0.5, screen.y + 0.5) === canvas,
    );
  }, points);
  expect(unobscured, 'material samples belong to an unobscured canvas').toBe(true);
  const result = { drawn, points, mean: mean(points.map((point) => luminance(point.rgb))) };
  await info.attach(name, { body: JSON.stringify(result), contentType: 'application/json' });
  return result;
}

async function confirmTile(page: Page, target: Vec2) {
  const point = await paintedTileCentre(page, target);
  if (!point) throw new Error('No camera for the real target');
  await page.mouse.click(point.x, point.y);
  const confirm = page.getByRole('button', { name: 'Confirm', exact: true });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await waitForIdle(page);
}

const boards = [
  {
    id: 'quarry_gate',
    node: 'battle_quarry_gate',
    oil: [
      { x: 12, y: 6 },
      { x: 10, y: 7 },
    ],
  },
  {
    id: 'quarry_floor',
    node: 'battle_grumbler',
    oil: [
      { x: 7, y: 3 },
      { x: 12, y: 3 },
      { x: 7, y: 8 },
      { x: 12, y: 8 },
    ],
  },
] as const;

for (const renderer of ['canvas', 'webgl'] as const) {
  for (const board of boards) {
    test(`${renderer}: ${board.id} oil reads above a pit and stays still`, async ({
      page,
    }, info) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await resetStorage(page, `?renderer=${renderer}&style=topdown`);
      await startGame(page, ['Oil review'], ['kaya'], `surface-oil-${board.id}`, {
        reduceMotion: true,
      });
      // A combat tip writes its `guidance.tip.` flag when it shows and its toast
      // can sit over the board; this case pins an unchanged state and an
      // unobscured, still material, so tips stay off (combat-guidance covers them).
      await page.evaluate(() => window.fnt!.app.updateSettings({ combatGuidance: false }));
      await enterNode(page, board.node);
      expect(await takeTurn(page)).toBe(true);
      await waitForIdle(page);
      expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(renderer);
      // Top-down combat opens on the follow camera at N = 2 around the actor,
      // which leaves part of the oil off screen; Recentre is the real control
      // for the whole-board overview, where every sampled oil cell is drawn.
      await page.getByRole('button', { name: 'Recentre', exact: true }).click();
      await waitForIdle(page);
      expect(await page.evaluate(() => window.fnt!.app.rendererCamera()?.fitted)).toBe(true);
      const before = await state(page);
      expect(before.location.mapId).toBe(board.id);
      for (const cell of board.oil)
        expect(
          before.battle?.grid.tiles[cell.y * before.battle.grid.width + cell.x]?.surface?.id,
        ).toBe('oil');
      const first = await capture(page, info, board.oil, 'oil-first');
      await page.waitForTimeout(350);
      const second = await capture(page, info, board.oil, 'oil-second');
      expect(second.drawn.time).toBeGreaterThan(first.drawn.time);
      expect(await state(page)).toEqual(before);
      expect(errors).toEqual([]);
      expect(second.points).toEqual(first.points);
      // Independent prototype pit colour plus the same legibility margin as the material unit.
      expect(first.mean).toBeGreaterThan(luminance([40, 30, 32]) + 12);
    });
  }

  test(`${renderer}: legal Fire Step leaves visible char on paving after moving away`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await resetStorage(page, `?renderer=${renderer}&style=topdown`);
    // Supported level-three slot and actual chosen technique; no injected battle/clock/outcome.
    await page.evaluate(() => {
      const app = window.fnt!.app;
      app.updateSettings({ reduceMotion: false });
      app.newGame(
        [{ name: 'Char review', unitId: '' }],
        [{ characterId: 'kaya', level: 3, chosen: ['fire_step'] }],
        'surface-char-quarry-gate-598',
      );
    });
    await enterNode(page, 'battle_quarry_gate');
    expect(await takeTurn(page)).toBe(true);
    await waitForIdle(page);
    expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(renderer);
    const target = { x: 2, y: 5 };
    const ground = await capture(page, info, [target], 'paving-before');
    expect(ground.drawn.paved).toContainEqual(target);
    await page.evaluate(() => {
      const app = window.fnt!.app;
      const dispatch = app.dispatch.bind(app);
      window.surfaceReadabilityCommands = [];
      app.dispatch = (command) => {
        const before = app.state!;
        const events = dispatch(command);
        window.surfaceReadabilityCommands!.push({ command, before, after: app.state!, events });
        return events;
      };
    });
    await page.getByRole('button', { name: /^Fire Step/ }).click();
    await confirmTile(page, target);
    await page.getByRole('button', { name: /^Move\b/ }).click();
    await confirmTile(page, { x: 3, y: 4 });
    const commands = await page.evaluate(() => window.surfaceReadabilityCommands!);
    await info.attach('actual-ui-commands', {
      body: JSON.stringify(commands),
      contentType: 'application/json',
    });
    expect(commands.map((record) => record.command.type)).toEqual(['useAbility', 'move']);
    for (const record of commands) {
      const expected = apply(CONTENT, record.before, record.command);
      expect(record.after).toEqual(expected.state);
      expect(record.events).toEqual(expected.events);
    }
    const after = await state(page);
    expect(after.battle?.units.find((unit) => unit.id === 'p0')?.pos).toEqual({ x: 3, y: 4 });
    expect(
      after.battle?.grid.tiles[target.y * after.battle.grid.width + target.x]?.surface?.id,
    ).toBe('fire');
    const char = await capture(page, info, [target], 'char-after');
    expect(char.mean).toBeLessThan(ground.mean * 0.75);
    expect(errors).toEqual([]);
  });
}
