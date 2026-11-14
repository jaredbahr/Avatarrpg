/** Earned command replay adopted through the API; subsequent targeting uses the real UI. */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { grumblerAimCheckpoint } from '../scripts/e2e/grumbler-aim-checkpoint';
import { CONTENT } from '../src/content';
import { isValidTarget } from '../src/core/rules/abilities';
import { distance, occupiedCells, samePos } from '../src/core/rules/grid';
import { apply } from '../src/core/state/reducer';
import type { Command, GameEvent, GameState, Vec2 } from '../src/core/types';
import type { Camera } from '../src/render/camera';
import type { MapView } from '../src/render/view';
import { allowSoftwareWebgl } from './budget';
import { resetStorage, settleLayout, takeTurn, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

test.describe.configure({ retries: 0 });

interface AcceptedInput {
  command: Command;
  events: readonly GameEvent[];
  before: GameState | null;
  after: GameState | null;
}
interface AimObserver {
  draws: number;
  targetTiles: readonly Vec2[];
  overflow: boolean;
  inputs: AcceptedInput[];
  stop(): void;
}
interface AimScene {
  pending: Vec2 | null;
  renderer: { camera: Camera; draw(view: MapView): void };
  resolvePointer(x: number, y: number, intent: 'tap'): { tile: Vec2; unit?: unknown } | null;
}
declare global {
  interface Window {
    grumblerAimReview?: AimObserver;
  }
}

async function installObserver(page: Page): Promise<void> {
  await page.evaluate(() => {
    const app = window.fnt?.app;
    if (!app) throw new Error('Missing running app');
    const renderer = (app as unknown as { scene: AimScene }).scene.renderer;
    const originalDraw = renderer.draw;
    const originalDispatch = app.dispatch;
    const review: AimObserver = {
      draws: 0,
      targetTiles: [],
      overflow: false,
      inputs: [],
      stop: () => undefined,
    };
    window.grumblerAimReview = review;
    renderer.draw = function (view) {
      originalDraw.call(this, view);
      review.draws += 1;
      if (review.draws > 20_000) {
        review.overflow = true;
        return;
      }
      review.targetTiles = (
        view.overlays?.find((layer) => layer.kind === 'target')?.tiles ?? []
      ).map((tile) => ({ ...tile }));
    };
    app.dispatch = (command) => {
      const before = command.type === 'useAbility' ? structuredClone(app.state) : null;
      const events = originalDispatch.call(app, command);
      if (command.type === 'useAbility') {
        review.inputs.push({
          command: structuredClone(command),
          events: structuredClone(events),
          before,
          after: structuredClone(app.state),
        });
      }
      return events;
    };
    review.stop = () => {
      renderer.draw = originalDraw;
      app.dispatch = originalDispatch;
    };
  });
}

/** Camera changes use wheel/pan input, never an assigned camera or game position. */
async function tilePoint(page: Page, tile: Vec2): Promise<Vec2> {
  await settleLayout(page);
  let point = await paintedTileCentre(page, tile);
  let box = await page.locator('.map-canvas').boundingBox();
  if (!point || !box) throw new Error('Missing painted combat tile');
  const inside = () =>
    point !== null &&
    box !== null &&
    point.x > box.x + 24 &&
    point.x < box.x + box.width - 24 &&
    point.y > box.y + 24 &&
    point.y < box.y + box.height - 24;
  if (!inside()) {
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.mouse.move(centre.x * 2 - point.x, centre.y * 2 - point.y, { steps: 6 });
    await page.mouse.up();
    await settleLayout(page);
    point = await paintedTileCentre(page, tile);
    box = await page.locator('.map-canvas').boundingBox();
  }
  expect(inside(), `Tile ${tile.x},${tile.y} must be fully inside the actual canvas`).toBe(true);
  if (!point) throw new Error('Missing painted tile after pan');
  expect(
    await page.evaluate(
      (p) => document.elementFromPoint(p.x, p.y) === document.querySelector('.map-canvas'),
      point,
    ),
    'The actual mouse target must reach the canvas',
  ).toBe(true);
  const picked = await page.evaluate((p) => {
    const app = window.fnt?.app;
    const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
    const battle = app?.state?.battle;
    if (!app || !canvas || !battle) throw new Error('Missing actual inverse-picking inputs');
    const rect = canvas.getBoundingClientRect();
    const camera = (app as unknown as { scene: AimScene }).scene.renderer.camera;
    // attachPointer supplies these same CSS-local coordinates to CombatScene.
    return camera.pickTile(p.x - rect.left, p.y - rect.top, battle.grid);
  }, point);
  expect(picked, 'The real inverse picker must resolve the intended raw tile').toEqual(tile);
  return point;
}

async function tapTile(page: Page, tile: Vec2, emptyGround = false): Promise<void> {
  const point = await tilePoint(page, tile);
  if (emptyGround) {
    const resolved = await page.evaluate((p) => {
      const app = window.fnt?.app;
      const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
      if (!app || !canvas) throw new Error('Missing empty-ground picking inputs');
      const rect = canvas.getBoundingClientRect();
      const scene = (app as unknown as { scene: AimScene }).scene;
      const result = scene.resolvePointer(p.x - rect.left, p.y - rect.top, 'tap');
      return result ? { tile: result.tile, bodyHit: result.unit !== undefined } : null;
    }, point);
    expect(
      resolved,
      'Empty control must preserve ground meaning without an enlarged-body hit',
    ).toEqual({ tile, bodyHit: false });
  }
  await page.mouse.click(point.x, point.y);
  await settleLayout(page);
}

async function selection(page: Page) {
  const model = await page.evaluate(() => {
    const app = window.fnt?.app;
    if (!app) throw new Error('Missing app while observing selection');
    return {
      pending: (app as unknown as { scene: AimScene }).scene.pending,
      state: app.state,
      session: app.session.toMeta(),
      targetTiles: window.grumblerAimReview?.targetTiles ?? [],
    };
  });
  return {
    ...model,
    preview: await page.locator('.confirm-bar').innerText(),
    confirmEnabled: await page.getByRole('button', { name: 'Confirm', exact: true }).isEnabled(),
  };
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`highlighted far Grumbler cell selects its legal aim on ${renderer}`, async ({
    page,
  }, info) => {
    test.setTimeout(60_000);
    allowSoftwareWebgl(test, renderer);
    const checkpoint = grumblerAimCheckpoint();
    const battle = checkpoint.state.battle;
    const caster = battle?.units.find((unit) => unit.id === checkpoint.casterId);
    const boss = battle?.units.find((unit) => unit.id === checkpoint.targetId);
    const ability = CONTENT.abilities.get(checkpoint.abilityId);
    if (!battle || !caster || !boss || !ability) throw new Error('Missing earned aim checkpoint');
    expect(caster.ap).toBe(5);
    expect(boss.size).toBe(2);
    const footprint = occupiedCells(boss);
    const emptyTiles = battle.grid.tiles.flatMap((tile, index) => {
      const pos = { x: index % battle.grid.width, y: Math.floor(index / battle.grid.width) };
      return !tile.blocked &&
        tile.elevation === 0 &&
        distance(boss.pos, pos) >= 4 &&
        distance(caster.pos, pos) > ability.range + CONTENT.tuning.heightReachBonus &&
        !battle.units.some((unit) => occupiedCells(unit).some((cell) => samePos(cell, pos))) &&
        !battle.props.some((prop) => samePos(prop.pos, pos))
        ? [pos]
        : [];
    });
    emptyTiles.sort((a, b) => distance(a, checkpoint.far) - distance(b, checkpoint.far));
    const invalid = emptyTiles[0];
    if (!invalid) throw new Error('No real empty out-of-range control tile');
    expect(isValidTarget(CONTENT, battle, caster, ability, invalid)).toEqual({
      ok: false,
      reason: 'Out of range.',
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const observations: Record<string, unknown> = {
      protocol:
        'Earned canonical command replay, API adoptSave, real Ready/wheel/pan/mouse/Confirm; ordinary clock. Not Load UI or uninterrupted campaign.',
      transcript: checkpoint.transcript,
      far: checkpoint.far,
      near: checkpoint.near,
      invalid,
    };

    try {
      await resetStorage(page, `?renderer=${renderer}`);
      await page.evaluate(
        ({ state, session }) => {
          const app = window.fnt?.app;
          if (!app) throw new Error('Missing app before adoption');
          // Every step below asserts the GameState is the checkpoint's, byte for
          // byte. A combat tip, once shown, writes its `guidance.tip.` flag into
          // that state (App bookkeeping, not a reducer change), so tips stay off
          // here; combat-guidance specs cover them.
          app.updateSettings({ reduceMotion: false, combatGuidance: false });
          app.adoptSave(state, session);
        },
        { state: checkpoint.state, session: checkpoint.session },
      );
      const adopted = await page.evaluate(() => ({
        state: window.fnt?.app.state,
        session: window.fnt?.app.session.toMeta(),
      }));
      expect(adopted).toEqual({ state: checkpoint.state, session: checkpoint.session });
      observations.adopted = adopted;
      await expect(page.getByRole('button', { name: /I'm ready/i })).toBeVisible();
      expect(await takeTurn(page)).toBe(true);
      await waitForIdle(page);
      expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(renderer);
      const ready = await page.evaluate(() => ({
        state: window.fnt?.app.state,
        session: window.fnt?.app.session.toMeta(),
      }));
      expect(ready).toEqual({ state: checkpoint.state, session: checkpoint.session });
      observations.ready = ready;

      const box = await page.locator('.map-canvas').boundingBox();
      const tilePx = await page.evaluate(() => window.fnt?.app.rendererCamera()?.tilePx);
      if (!box || !tilePx) throw new Error('Missing actual combat camera');
      await page.locator('.map-canvas').dispatchEvent('wheel', {
        clientX: box.x + box.width / 2,
        clientY: box.y + box.height / 2,
        deltaX: 0,
        deltaY: Math.log(tilePx / 32) / 0.002,
        deltaMode: 0,
      });
      await settleLayout(page);
      await tilePoint(page, checkpoint.far);
      await installObserver(page);
      await page.getByRole('button', { name: new RegExp(`^${ability.name}`) }).click();
      await settleLayout(page);
      observations.aimOverlay = await page.evaluate(() => window.grumblerAimReview?.targetTiles);

      const bossSelections: { tile: Vec2; sample: Awaited<ReturnType<typeof selection>> }[] = [];
      observations.bossSelections = bossSelections;
      const tapOrder = [
        checkpoint.far,
        ...footprint.filter((tile) => !samePos(tile, checkpoint.far)),
      ];
      for (const tile of tapOrder) {
        await tapTile(page, tile);
        bossSelections.push({ tile, sample: await selection(page) });
        if (samePos(tile, checkpoint.far)) {
          await info.attach('far-selection', {
            body: await page.screenshot(),
            contentType: 'image/png',
          });
        }
      }

      // Continue through both controls even when the baseline rejected the highlighted far cell.
      await tapTile(page, invalid, true);
      const rejected = await selection(page);
      observations.emptySelection = rejected;
      await tapTile(page, checkpoint.near);
      const near = await selection(page);
      observations.nearSelection = near;
      await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Confirm', exact: true }).click();
      await waitForIdle(page);
      const complete = await page.evaluate(() => ({
        state: window.fnt?.app.state ?? null,
        session: window.fnt?.app.session.toMeta(),
      }));
      const after = complete.state;
      observations.after = complete;
      const inputs = await page.evaluate(() => window.grumblerAimReview?.inputs ?? []);
      observations.inputs = inputs;

      expect.soft(observations.aimOverlay).toEqual(expect.arrayContaining(footprint));
      expect.soft(bossSelections).toHaveLength(4);
      for (const { tile, sample } of bossSelections) {
        const label = `Boss footprint tap ${tile.x},${tile.y}`;
        expect.soft(sample.targetTiles, label).toEqual(expect.arrayContaining(footprint));
        expect.soft(sample.pending, label).toEqual(checkpoint.near);
        expect.soft(sample.confirmEnabled, label).toBe(true);
        expect.soft(sample.preview, label).toContain(boss.name);
        expect.soft(sample.preview, label).not.toContain('Out of range.');
        expect.soft(sample.state, label).toEqual(checkpoint.state);
        expect.soft(sample.session, label).toEqual(checkpoint.session);
      }
      expect.soft(rejected.pending).toEqual(invalid);
      expect.soft(rejected.confirmEnabled).toBe(false);
      expect.soft(rejected.preview).toContain('Out of range.');
      expect.soft(rejected.state).toEqual(checkpoint.state);
      expect.soft(rejected.session).toEqual(checkpoint.session);
      expect.soft(near.pending).toEqual(checkpoint.near);
      expect.soft(near.confirmEnabled).toBe(true);
      expect.soft(near.preview).toContain(boss.name);
      expect.soft(near.state).toEqual(checkpoint.state);
      expect.soft(near.session).toEqual(checkpoint.session);
      expect.soft(complete.session).toEqual(checkpoint.session);
      expect.soft(inputs).toHaveLength(1);
      const input = inputs[0];
      expect.soft(input?.command).toEqual({
        type: 'useAbility',
        unitId: caster.id,
        abilityId: ability.id,
        target: checkpoint.near,
      });
      expect.soft(input?.events).toContainEqual(
        expect.objectContaining({
          type: 'abilityUsed',
          unitId: caster.id,
          abilityId: ability.id,
          target: checkpoint.near,
        }),
      );
      expect.soft(input?.before).toEqual(checkpoint.state);
      expect
        .soft(input?.after?.battle?.units.find((unit) => unit.id === caster.id)?.ap)
        .toBe(caster.ap - ability.apCost);
      // The roll is the checkpoint's own: replay the same command through the
      // real reducer and require the page to have produced exactly that.
      const expected = apply(CONTENT, checkpoint.state, {
        type: 'useAbility',
        unitId: caster.id,
        abilityId: ability.id,
        target: checkpoint.near,
      });
      const expectedBossHp = expected.state.battle?.units.find((unit) => unit.id === boss.id)?.hp;
      expect.soft(input?.events).toEqual(expected.events);
      expect
        .soft(input?.after?.battle?.units.find((unit) => unit.id === boss.id)?.hp)
        .toBe(expectedBossHp);
      expect
        .soft(after?.battle?.units.find((unit) => unit.id === caster.id)?.ap)
        .toBe(caster.ap - ability.apCost);
      expect
        .soft(after?.battle?.units.find((unit) => unit.id === boss.id)?.hp)
        .toBe(expectedBossHp);
      expect.soft(after?.log).toContain(`${caster.name} uses ${ability.name}.`);
      await info.attach('near-confirmed', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    } finally {
      const observer = await page
        .evaluate(() => {
          const review = window.grumblerAimReview;
          if (!review) return null;
          review.stop();
          return {
            draws: review.draws,
            overflow: review.overflow,
            targetTiles: review.targetTiles,
            inputs: review.inputs,
          };
        })
        .catch(() => null);
      await info.attach('aim-observations', {
        body: JSON.stringify({ ...observations, observer, errors }, null, 2),
        contentType: 'application/json',
      });
      expect
        .soft(observer, 'Actual forwarding draw observer must have been installed')
        .not.toBeNull();
      expect.soft(observer?.draws ?? 0).toBeGreaterThan(0);
      expect.soft(observer?.overflow).toBe(false);
      expect.soft(errors).toEqual([]);
    }
  });
}
