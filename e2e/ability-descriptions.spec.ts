import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CONTENT } from '../src/content';
import { createGame } from '../src/core/state/createGame';
import { apply } from '../src/core/state/reducer';
import { deserialize, serialize, stateFromBlob } from '../src/core/save/serialize';
import {
  reconcileBattleResult,
  reconcileDisciplines,
  reconcileWorld,
} from '../src/core/save/reconcile';
import { isValidTarget } from '../src/core/rules/abilities';
import { tileAt } from '../src/core/rules/grid';
import type { Command, GameEvent, GameState, Vec2 } from '../src/core/types';
import type { MapView } from '../src/render/view';
import { checkAbilityDescription } from '../scripts/content/ability-description-claims';
import { resetStorage, settleDialog, settleMapCanvas, takeTurn, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

test.describe.configure({ retries: 0 });

const WATER = { x: 5, y: 5 };
const BARE = { x: 5, y: 3 };
const OCCUPIED = { x: 3, y: 4 };

interface CastRecord {
  readonly command: Command;
  readonly before: GameState | null;
  readonly after: GameState | null;
  readonly events: readonly GameEvent[];
}
interface ClaimRenderProbe {
  frames: number;
  castFrames: number;
  movingFrames: number;
  casts: CastRecord[];
}
interface ClaimScene {
  renderer: { draw(view: MapView): void };
}
declare global {
  interface Window {
    abilityClaimReview?: ClaimRenderProbe;
  }
}

/** Supported initialized level-three kit, not an earned campaign checkpoint. */
function checkpoint() {
  const fresh = createGame(CONTENT, {
    seed: 'ability-description-559',
    startNode: 'village_explore',
    party: [
      { characterId: 'kaya', level: 3, chosen: ['fire_step'], autoChoose: true },
      { characterId: 'nilak', level: 3, autoChoose: true },
      { characterId: 'bo', level: 3, autoChoose: true },
    ],
  });
  const state = apply(CONTENT, fresh, { type: 'enterNode', nodeId: 'battle_forest_road' }).state;
  const battle = state.battle;
  const actor = battle?.units.find((unit) => unit.id === 'p0');
  const ability = CONTENT.abilities.get('fire_step');
  if (!battle || !actor || !ability) throw new Error('Missing authored Fire Step checkpoint');
  expect(battle.order[battle.turnIndex]).toBe(actor.id);
  expect(actor.abilities).toContain(ability.id);
  expect(tileAt(battle.grid, WATER)?.surface?.id).toBe('water');
  expect(tileAt(battle.grid, BARE)?.surface).toBeNull();
  expect(isValidTarget(CONTENT, battle, actor, ability, WATER).ok).toBe(true);
  expect(isValidTarget(CONTENT, battle, actor, ability, BARE).ok).toBe(true);
  expect(isValidTarget(CONTENT, battle, actor, ability, OCCUPIED).ok).toBe(false);
  const session = {
    players: state.party.map((unit) => ({ name: 'Fire Step review', unitId: unit.id })),
    soloPlay: true,
  };
  const parsed = deserialize(
    serialize(state, {
      savedAt: 1_700_000_000_000,
      label: 'Fire Step description review',
      summary: 'Supported level-three setup on the authored board, no campaign claim',
      session,
    }),
  );
  if (!parsed.ok) throw new Error(parsed.error);
  expect(stateFromBlob(parsed.blob)).toEqual(state);
  const loaded = reconcileBattleResult(CONTENT, stateFromBlob(parsed.blob));
  expect(loaded.warnings).toEqual([]);
  expect(reconcileWorld(CONTENT, reconcileDisciplines(CONTENT, loaded.state))).toEqual(state);
  return { state, session, actor, ability };
}

async function prepare(page: Page) {
  const fixture = checkpoint();
  await resetStorage(page, '?renderer=canvas');
  await page.evaluate(({ state, session }) => {
    const app = window.fnt?.app;
    if (!app) throw new Error('No running app');
    app.updateSettings({ reduceMotion: false });
    app.adoptSave(state, session);
    const probe: ClaimRenderProbe = { frames: 0, castFrames: 0, movingFrames: 0, casts: [] };
    window.abilityClaimReview = probe;
    const renderer = (app as unknown as { scene: ClaimScene }).scene.renderer;
    const draw = renderer.draw;
    renderer.draw = function (view) {
      draw.call(this, view);
      probe.frames++;
      const actor = view.units.find((unit) => unit.id === 'p0');
      if (actor?.clip === 'cast') probe.castFrames++;
      if (actor?.renderPos) probe.movingFrames++;
    };
    const dispatch = app.dispatch;
    app.dispatch = (command) => {
      const before = command.type === 'useAbility' ? structuredClone(app.state) : null;
      const events = dispatch.call(app, command);
      if (command.type === 'useAbility') {
        probe.casts.push({
          command: structuredClone(command),
          before,
          after: structuredClone(app.state),
          events: structuredClone(events),
        });
      }
      return events;
    };
  }, fixture);
  expect(await takeTurn(page)).toBe(true);
  await waitForIdle(page);
  await page.getByRole('button', { name: 'Focus Kaya', exact: true }).first().click();
  await settleMapCanvas(page);
  expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe('canvas');
  expect(await page.evaluate(() => window.fnt!.app.state)).toEqual(fixture.state);
  return fixture;
}

async function tilePoint(page: Page, tile: Vec2): Promise<Vec2> {
  await settleMapCanvas(page);
  let point = await paintedTileCentre(page, tile);
  let box = await page.locator('.map-canvas').boundingBox();
  if (!point || !box) throw new Error('No rendered combat tile');
  if (
    point.x < box.x + 12 ||
    point.x > box.x + box.width - 12 ||
    point.y < box.y + 12 ||
    point.y > box.y + box.height - 12
  ) {
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.mouse.move(centre.x * 2 - point.x, centre.y * 2 - point.y, { steps: 6 });
    await page.mouse.up();
    await settleMapCanvas(page);
    point = await paintedTileCentre(page, tile);
    box = await page.locator('.map-canvas').boundingBox();
  }
  if (!point || !box) throw new Error('Camera lost the rendered tile');
  expect(point.x).toBeGreaterThan(box.x);
  expect(point.x).toBeLessThan(box.x + box.width);
  expect(point.y).toBeGreaterThan(box.y);
  expect(point.y).toBeLessThan(box.y + box.height);
  expect(
    await page.evaluate(
      (p) => document.elementFromPoint(p.x, p.y)?.classList.contains('map-canvas'),
      point,
    ),
  ).toBe(true);
  return point;
}

test('the full rendered Fire Step card states legal landings and conditional terrain', async ({
  page,
}, info) => {
  const fixture = await prepare(page);
  const point = await tilePoint(page, fixture.actor.pos);
  await page.mouse.click(point.x, point.y);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCount(1);
  const card = dialog
    .locator('.ability-card')
    .filter({ has: page.getByRole('heading', { name: 'Fire Step', exact: true }) });
  const description = card.locator('p').first();
  await description.scrollIntoViewIfNeeded();
  await settleDialog(dialog);
  await expect(description).toBeVisible();
  await expect(card).toContainText('Range 4');
  await expect(card).toContainText('1 AP');
  const layout = await description.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      const rect = parent.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
        clip.left = Math.max(clip.left, rect.left + parent.clientLeft);
        clip.right = Math.min(clip.right, rect.left + parent.clientLeft + parent.clientWidth);
      }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
        clip.top = Math.max(clip.top, rect.top + parent.clientTop);
        clip.bottom = Math.min(clip.bottom, rect.top + parent.clientTop + parent.clientHeight);
      }
    }
    return {
      box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
      clip,
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
    };
  });
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  expect(layout.box.left).toBeGreaterThanOrEqual(layout.clip.left - 1);
  expect(layout.box.right).toBeLessThanOrEqual(layout.clip.right + 1);
  expect(layout.box.top).toBeGreaterThanOrEqual(layout.clip.top - 1);
  expect(layout.box.bottom).toBeLessThanOrEqual(layout.clip.bottom + 1);
  const text = await description.innerText();
  const shot = info.outputPath('fire-step-full-copy.png');
  await page.screenshot({ path: shot });
  await info.attach('fire-step-full-copy', { path: shot, contentType: 'image/png' });
  expect(text).toMatch(/(?:open|unoccupied) tile/i);
  expect(checkAbilityDescription(CONTENT, fixture.ability, text)).toEqual([]);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => window.fnt!.app.state)).toEqual(fixture.state);
});

for (const terrain of ['bare', 'water'] as const) {
  test(`real Fire Step controls reject an occupied landing, then resolve ${terrain}`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const fixture = await prepare(page);
    await page.getByRole('button', { name: /^Fire Step/ }).click();
    await expect(page.locator('.ability-header')).toContainText('Fire Step');
    const occupied = await tilePoint(page, OCCUPIED);
    await page.mouse.click(occupied.x, occupied.y);
    const confirm = page.getByRole('button', { name: 'Confirm', exact: true });
    await expect(confirm).toBeDisabled();
    expect(await page.evaluate(() => window.fnt!.app.state)).toEqual(fixture.state);
    expect(await page.evaluate(() => window.abilityClaimReview!.casts)).toEqual([]);
    const target = terrain === 'bare' ? BARE : WATER;
    const point = await tilePoint(page, target);
    await page.mouse.click(point.x, point.y);
    await expect(confirm).toBeEnabled();
    const expected = apply(CONTENT, fixture.state, {
      type: 'useAbility',
      unitId: fixture.actor.id,
      abilityId: fixture.ability.id,
      target,
    });
    await page.evaluate(() => {
      const probe = window.abilityClaimReview;
      if (!probe) throw new Error('Missing real-render observer');
      probe.frames = 0;
      probe.castFrames = 0;
      probe.movingFrames = 0;
    });
    await confirm.click();
    await waitForIdle(page);
    await settleMapCanvas(page);
    const actual = await page.evaluate(() => window.fnt!.app.state!);
    expect(actual).toEqual(expected.state);
    const actor = actual.battle?.units.find((unit) => unit.id === fixture.actor.id);
    expect(actor?.pos).toEqual(target);
    expect(actual.battle && tileAt(actual.battle.grid, target)?.surface?.id).toBe(
      terrain === 'bare' ? 'fire' : 'steam',
    );
    expect(actor?.statuses.some((status) => status.id === 'burning')).toBe(terrain === 'bare');
    if (terrain === 'bare') expect(actor?.hp).toBeLessThan(fixture.actor.hp);
    else expect(actor?.hp).toBe(fixture.actor.hp);
    const probe = await page.evaluate(() => window.abilityClaimReview!);
    expect(probe.casts).toHaveLength(1);
    expect(probe.casts[0]?.events).toEqual(expected.events);
    expect(probe.frames).toBeGreaterThan(0);
    expect(probe.castFrames + probe.movingFrames).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    const shot = info.outputPath(`fire-step-${terrain}.png`);
    await page.screenshot({ path: shot });
    await info.attach(`fire-step-${terrain}`, { path: shot, contentType: 'image/png' });
    await info.attach('real-command-and-render-evidence', {
      body: Buffer.from(JSON.stringify({ target, before: fixture.state, expected, actual, probe })),
      contentType: 'application/json',
    });
  });
}
