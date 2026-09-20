import { expect } from '@playwright/test';
import { upcomingOrder } from '../../src/core/rules/turnOrder';
import { settleLayout } from '../helpers';
import { paintedTileCentre } from '../projection';
import type { Page } from '@playwright/test';
import type { Settings } from '../../src/app/storage/localSaves';
import { nextFloat } from '../../src/core/rng';
import type { SurfaceId } from '../../src/core/types';

/**
 * State surgery for staging a picture.
 *
 * Both sides of a fight start twenty tiles apart, so every interesting beat
 * (a whip landing, lightning through a puddle, a unit going down) needs the
 * board arranged first. These edit `app.state` directly, exactly as the e2e
 * specs already do to skip past what they are not testing, and then call
 * `app.resync()` so the HUD catches up. Nothing here touches the rules.
 */

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface StagedUnit {
  readonly id: string;
  readonly name: string;
  readonly pos: Vec2;
  readonly hp: number;
  readonly size: 1 | 2;
  readonly abilities: readonly string[];
}

export interface FigureRow {
  readonly key: string;
  readonly label: string;
  readonly widthTiles?: 1 | 2;
}

const POSE_CAPTIONS = [
  'idle A',
  'idle B',
  'walk A',
  'walk B',
  'wind-up',
  'release',
  'recover',
  'melee A',
  'melee B',
  'hit',
  'KO',
];

/**
 * Covers the page with every frame of each row's placeholder sheet, baked at
 * `tileCss` CSS pixels a tile through `window.fnt.bakeReview`, one row per
 * unit with a caption. The frames are views onto the atlas image, so what is
 * shown is exactly what the baker wrote.
 */
export async function showFigureSheet(
  page: Page,
  rows: readonly FigureRow[],
  tileCss: number,
): Promise<void> {
  await page.evaluate(
    async ({ rows, tileCss, captions }) => {
      document.getElementById('fnt-figures')?.remove();
      const bake = window.fnt?.bakeReview;
      if (!bake) throw new Error('window.fnt.bakeReview is not exposed.');
      const dpr = window.devicePixelRatio || 1;
      const host = document.createElement('div');
      host.id = 'fnt-figures';
      host.style.cssText =
        'position:fixed;inset:0;z-index:99999;background:#120d0a;color:#f4e9d8;' +
        'font:13px/1.2 system-ui,sans-serif;padding:10px 12px;overflow:hidden;' +
        'display:flex;flex-direction:column;gap:5px;align-items:flex-start';
      const header = document.createElement('div');
      header.style.cssText = 'display:flex;gap:4px;color:#a89880;font-size:11px';
      const spacer = document.createElement('div');
      spacer.style.cssText = 'width:150px;flex:none';
      header.append(spacer);
      for (const caption of captions) {
        const cell = document.createElement('div');
        cell.textContent = caption;
        cell.style.cssText = `width:${tileCss}px;flex:none;text-align:center;overflow:hidden`;
        header.append(cell);
      }
      host.append(header);
      const decodes: Promise<void>[] = [];
      for (const row of rows) {
        const sheet = bake(row.key, Math.round(tileCss * dpr), row.widthTiles ?? 1);
        if (!sheet) continue;
        const line = document.createElement('div');
        line.style.cssText = 'display:flex;align-items:flex-end;gap:4px';
        const label = document.createElement('div');
        label.textContent = row.label;
        label.style.cssText = 'width:150px;flex:none;color:#d9a441;padding-bottom:4px';
        line.append(label);
        for (const frame of sheet.frames) {
          const cell = document.createElement('div');
          cell.style.cssText =
            `position:relative;overflow:hidden;flex:none;width:${frame.w / dpr}px;` +
            `height:${frame.h / dpr}px;background:#1c1512;outline:1px solid #3a2d24`;
          const img = new Image();
          img.src = sheet.url;
          img.style.cssText =
            `position:absolute;left:${-frame.x / dpr}px;top:${-frame.y / dpr}px;` +
            `width:${sheet.width / dpr}px;height:${sheet.height / dpr}px;max-width:none`;
          decodes.push(img.decode().catch(() => undefined));
          cell.append(img);
          line.append(cell);
        }
        host.append(line);
      }
      document.body.append(host);
      await Promise.all(decodes);
    },
    { rows, tileCss, captions: POSE_CAPTIONS },
  );
}

/** The unit whose turn it is, or null outside a fight. */
export async function actor(page: Page): Promise<StagedUnit | null> {
  return page.evaluate(() => {
    const battle = window.fnt?.app.state?.battle;
    const unit = battle?.units.find((u) => u.id === battle.order[battle.turnIndex]);
    if (!unit) return null;
    return {
      id: unit.id,
      name: unit.name,
      pos: unit.pos,
      hp: unit.hp,
      size: unit.size,
      abilities: [...unit.abilities],
    };
  });
}

/** The party member playing `characterId`, or null. */
export async function partyUnit(page: Page, characterId: string): Promise<StagedUnit | null> {
  return page.evaluate((id) => {
    const battle = window.fnt?.app.state?.battle;
    const unit = battle?.units.find((u) => u.characterId === id);
    if (!unit) return null;
    return {
      id: unit.id,
      name: unit.name,
      pos: unit.pos,
      hp: unit.hp,
      size: unit.size,
      abilities: [...unit.abilities],
    };
  }, characterId);
}

/** Living enemies, in roster order. */
export async function enemies(page: Page): Promise<StagedUnit[]> {
  return page.evaluate(() => {
    const battle = window.fnt?.app.state?.battle;
    if (!battle) return [];
    return battle.units
      .filter((u) => u.faction === 'enemy' && u.hp > 0)
      .map((u) => ({
        id: u.id,
        name: u.name,
        pos: u.pos,
        hp: u.hp,
        size: u.size,
        abilities: [...u.abilities],
      }));
  });
}

/** True if the tile is on the map and not blocked. */
export async function open(page: Page, pos: Vec2): Promise<boolean> {
  return page.evaluate((p) => {
    const battle = window.fnt?.app.state?.battle;
    if (!battle) return false;
    if (p.x < 0 || p.y < 0 || p.x >= battle.grid.width || p.y >= battle.grid.height) return false;
    const tile = battle.grid.tiles[p.y * battle.grid.width + p.x];
    return tile !== undefined && !tile.blocked;
  }, pos);
}

/** Makes it `unitId`'s turn with a fresh action budget, and tells the HUD. */
export async function giveTurn(page: Page, unitId: string): Promise<void> {
  await page.evaluate((id) => {
    const app = window.fnt?.app;
    const state = app?.state;
    const battle = state?.battle;
    if (!app || !state || !battle) throw new Error('No fight is running.');
    const index = battle.order.indexOf(id);
    if (index < 0) throw new Error(`${id} is not in the turn order.`);
    const units = battle.units.map((u) =>
      u.id === id ? { ...u, ap: u.base.maxAp, move: u.base.maxMove, cooldowns: {} } : u,
    );
    app.state = { ...state, battle: { ...battle, units, turnIndex: index } };
    app.resync();
  }, unitId);
}

/** Stands a unit on a tile. Throws if the tile is off the map or blocked. */
export async function placeUnit(page: Page, unitId: string, pos: Vec2): Promise<void> {
  if (!(await open(page, pos))) throw new Error(`Tile ${pos.x},${pos.y} is not open.`);
  await page.evaluate(
    ({ id, p }) => {
      const app = window.fnt?.app;
      const state = app?.state;
      const battle = state?.battle;
      if (!app || !state || !battle) throw new Error('No fight is running.');
      const units = battle.units.map((u) => (u.id === id ? { ...u, pos: p } : u));
      app.state = { ...state, battle: { ...battle, units } };
      app.resync();
    },
    { id: unitId, p: pos },
  );
}

export async function setHp(page: Page, unitId: string, hp: number): Promise<void> {
  await page.evaluate(
    ({ id, value }) => {
      const app = window.fnt?.app;
      const state = app?.state;
      const battle = state?.battle;
      if (!app || !state || !battle) throw new Error('No fight is running.');
      const units = battle.units.map((u) => (u.id === id ? { ...u, hp: value } : u));
      app.state = { ...state, battle: { ...battle, units } };
      app.resync();
    },
    { id: unitId, value: hp },
  );
}

/** Teaches a unit an ability for the picture, whatever its level. */
export async function grantAbility(page: Page, unitId: string, abilityId: string): Promise<void> {
  await page.evaluate(
    ({ id, ability }) => {
      const app = window.fnt?.app;
      const state = app?.state;
      const battle = state?.battle;
      if (!app || !state || !battle) throw new Error('No fight is running.');
      if (!app.content.abilities.has(ability)) throw new Error(`Unknown ability ${ability}.`);
      const units = battle.units.map((u) =>
        u.id === id && !u.abilities.includes(ability)
          ? { ...u, abilities: [...u.abilities, ability] }
          : u,
      );
      app.state = { ...state, battle: { ...battle, units } };
      app.resync();
    },
    { id: unitId, ability: abilityId },
  );
}

/** Lays a permanent surface on a tile. */
export async function paintSurface(page: Page, pos: Vec2, surface: SurfaceId): Promise<void> {
  await page.evaluate(
    ({ p, id }) => {
      const app = window.fnt?.app;
      const state = app?.state;
      const battle = state?.battle;
      if (!app || !state || !battle) throw new Error('No fight is running.');
      const index = p.y * battle.grid.width + p.x;
      const tiles = battle.grid.tiles.map((tile, i) =>
        i === index ? { ...tile, surface: { id, duration: -1, spread: 0 } } : tile,
      );
      app.state = { ...state, battle: { ...battle, grid: { ...battle.grid, tiles } } };
      app.resync();
    },
    { p: pos, id: surface },
  );
}

/**
 * Steps the game's dice to a state whose next draw succeeds at `chance`.
 *
 * Every beat starts from the same seed, so the first roll of every fight is
 * the same roll, and on this seed it is a miss: five beats of "miss" say
 * nothing about how a hit looks. Loading the dice keeps the game as
 * deterministic as it was (the state is still one number, reached from the
 * seed by a fixed walk) and picks the number so the picture shows the hit.
 * Only the next draw is loaded; the variance and crit rolls after it fall
 * where they fall.
 */
export async function loadDice(page: Page, chance = 0.5): Promise<void> {
  const state = await page.evaluate(() => window.fnt?.app.state?.rng ?? null);
  if (state === null) throw new Error('No game is running.');
  let rng = state;
  for (let step = 0; step < 64 && nextFloat(rng).value >= chance; step++) {
    rng = nextFloat(rng).rng;
  }
  await page.evaluate((next) => {
    const app = window.fnt?.app;
    if (!app?.state) throw new Error('No game is running.');
    app.state = { ...app.state, rng: next };
  }, rng);
}

/** Fires an ability straight at the rules, returning the event types it produced. */
export async function cast(
  page: Page,
  unitId: string,
  abilityId: string,
  target: Vec2,
): Promise<string[]> {
  return page.evaluate(
    ({ id, ability, at }) => {
      const app = window.fnt?.app;
      if (!app) throw new Error('The game has not finished booting.');
      return app
        .dispatch({ type: 'useAbility', unitId: id, abilityId: ability, target: at })
        .map((event) => event.type);
    },
    { id: unitId, ability: abilityId, at: target },
  );
}

export async function endTurn(page: Page, unitId: string): Promise<string[]> {
  return page.evaluate((id) => {
    const app = window.fnt?.app;
    if (!app) throw new Error('The game has not finished booting.');
    return app.dispatch({ type: 'endTurn', unitId: id }).map((event) => event.type);
  }, unitId);
}

/** Drops every enemy to zero so the next turn end seals a victory. */
export async function fellEnemies(page: Page): Promise<void> {
  await page.evaluate(() => {
    const app = window.fnt?.app;
    const state = app?.state;
    const battle = state?.battle;
    if (!app || !state || !battle) throw new Error('No fight is running.');
    const units = battle.units.map((u) => (u.faction === 'enemy' ? { ...u, hp: 0 } : u));
    app.state = { ...state, battle: { ...battle, units } };
    app.resync();
  });
}

export async function updateSettings(page: Page, next: Partial<Settings>): Promise<void> {
  await page.evaluate((partial) => {
    window.fnt?.app.updateSettings(partial);
  }, next);
}

/** Screen point at the centre of a tile, through the same camera the tap handler reads. */
export async function tileCentre(page: Page, pos: Vec2): Promise<{ x: number; y: number }> {
  const point = await paintedTileCentre(page, pos);
  if (!point) throw new Error(`Could not map tile ${pos.x},${pos.y} to the screen.`);
  return point;
}

/**
 * Waits for the scene curtain to finish lifting.
 *
 * `App.showScene` drops an opaque curtain over the new scene and lifts it over
 * a CSS transition; a still taken during the lift is mostly ink. The curtain
 * drops its classes on `transitionend` (or a fallback timer), so wait for
 * that. Only while the page clock is running: under a paused clock the lift
 * has long finished, and this polls on animation frames that would never fire.
 *
 * The budget is generous because software WebGL at 2x renders the village in
 * more than a second a frame, and the transition end queues behind it.
 */
export async function settleCurtain(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.querySelector('.curtain.is-down, .curtain.is-lifting') === null,
    undefined,
    { timeout: 30_000 },
  );
}

/** Use the real focus control before inspecting an actor on a pannable board. */
export async function focusStagedUnit(page: Page, unitId: string, timeout: number): Promise<void> {
  const battle = await page.evaluate(() => window.fnt?.app.state?.battle);
  const unit = battle?.units.find((candidate) => candidate.id === unitId);
  if (!battle || !unit) throw new Error(`Missing staged unit ${unitId}`);
  // Names can repeat; match this actor's occurrence in the actual turn strip.
  const peers = upcomingOrder(battle, battle.units.length).filter(
    (candidate) => candidate.name === unit.name,
  );
  const index = peers.findIndex((candidate) => candidate.id === unitId);
  if (index < 0) throw new Error(`Staged unit ${unitId} has no focus control`);
  await page
    .getByRole('button', { name: `Focus ${unit.name}`, exact: true })
    .nth(index)
    .click();
  await settleLayout(page, timeout);
  const point = await tileCentre(page, unit.pos);
  expect(
    await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y) === document.querySelector('.map-canvas'),
      point,
    ),
    `Focused actor ${unitId} must be on the interactive canvas`,
  ).toBe(true);
}
