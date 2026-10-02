/**
 * Props that catch fire, burn and go out (B-2).
 *
 * B-1 added the data — `fuel`, `burnsInto`, `ignites`, `douse` and
 * `PropInstance.burning` — and nothing read it. These tests are the first code
 * that does. The shipped hay bale now exercises the same rules in real battles.
 *
 * Everything here is rules only. No RNG is consumed on any path, so the
 * confirm-step preview keeps its promise of being roll-free.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { posKey, tileAt, withTile } from '../rules/grid';
import { resolveAbility } from '../rules/abilities';
import type {
  BattleState,
  ContentIndex,
  GameEvent,
  GameState,
  PropDef,
  PropInstance,
  Vec2,
} from '../types';
import { appendLog } from './log';
import { BattleDraft } from './battleDraft';
import { createBattle, createGame } from './createGame';
import { apply } from './reducer';
import { deserialize, serialize, stateFromBlob } from '../save/serialize';
import type { SaveMeta } from '../save/serialize';

/**
 * Test-only fuel props.
 *
 * They deliberately do not live in `src/content/`: they isolate edge cases that
 * the shipped hay bale does not need to encode.
 */
function fuelProp(overrides: Partial<PropDef> & Pick<PropDef, 'id' | 'name'>): PropDef {
  return {
    description: 'Test-only prop.',
    sprite: 'prop.hay',
    hp: 20,
    blocksMove: false,
    blocksSight: false,
    grantsCover: false,
    pushable: false,
    vulnerableTo: [],
    immuneTo: [],
    onBreak: [{ kind: 'surface', surface: 'mud', duration: 2, radius: 0 }],
    breakLabel: 'It falls apart.',
    fuel: 3,
    ignites: { radius: 1, spread: 1 },
    douse: ['water'],
    ...overrides,
  };
}

const HAYSTACK = fuelProp({
  id: 'test_haystack',
  name: 'Test Haystack',
  burnsInto: [{ kind: 'surface', surface: 'rubble', duration: 2, radius: 0 }],
});

/** Burns fast, breaks to a fire hit, and declares no `burnsInto`. */
const KINDLING = fuelProp({
  id: 'test_kindling',
  name: 'Test Kindling',
  hp: 3,
  fuel: 1,
  vulnerableTo: ['fire'],
  ignites: undefined,
  burnsInto: undefined,
});

/** Solid, so `paintSurface` cannot paint fire under it. */
const SOLID_HAY = fuelProp({
  id: 'test_solid_hay',
  name: 'Test Solid Hay',
  blocksMove: true,
  blocksSight: true,
  grantsCover: true,
});

/** Solid, burns, and leaves nothing: the tile after it is the tile under it. */
const SOLID_ASH = fuelProp({
  id: 'test_solid_ash',
  name: 'Test Solid Ash',
  blocksMove: true,
  blocksSight: true,
  grantsCover: true,
  onBreak: [],
  burnsInto: [],
});

/** No fuel: isolates the ordinary-prop path from the shipped hay rule. */
const RACK = fuelProp({
  id: 'test_rack',
  name: 'Test Rack',
  hp: 12,
  fuel: undefined,
  ignites: undefined,
  douse: undefined,
  burnsInto: undefined,
});

/**
 * Solid and fuel-less: `surfaceExposure` reads its neighbours, so it is the
 * shape that would notice if the pre-tick snapshot leaked onto non-fuel props.
 */
const SOLID_RACK = fuelProp({
  id: 'test_solid_rack',
  name: 'Test Solid Rack',
  hp: 12,
  blocksMove: true,
  blocksSight: true,
  grantsCover: true,
  fuel: undefined,
  ignites: undefined,
  douse: undefined,
  burnsInto: undefined,
});

const testProps = new Map(CONTENT.props);
testProps.set(HAYSTACK.id, HAYSTACK);
testProps.set(KINDLING.id, KINDLING);
testProps.set(SOLID_HAY.id, SOLID_HAY);
testProps.set(RACK.id, RACK);
testProps.set(SOLID_RACK.id, SOLID_RACK);
testProps.set(SOLID_ASH.id, SOLID_ASH);

const TEST_CONTENT: ContentIndex = { ...CONTENT, props: testProps };

const META: SaveMeta = {
  label: 'Prop fire',
  summary: 'B-2 round trip',
  savedAt: 1_700_000_000_000,
  session: { players: [{ name: 'Lorelai', unitId: 'p0' }], soloPlay: false },
};

function freshDraft(content: ContentIndex = TEST_CONTENT): BattleDraft {
  const seeded = createGame(content, {
    seed: 'prop-fire',
    party: [
      { characterId: 'kaya', level: 3, autoChoose: true },
      { characterId: 'bo', level: 3, autoChoose: true },
    ],
    startNode: '',
  });
  const rng = new RngCursor(seeded.rng);
  return new BattleDraft(content, forestRoadWithoutProps(content, seeded, rng), rng);
}

/**
 * These tests place their own props on open ground, so lift the map's shipped
 * ones off first: each put its tile's `previous` state aside when it was placed.
 */
function forestRoadWithoutProps(
  content: ContentIndex,
  seeded: GameState,
  rng: RngCursor,
): BattleState {
  const battle = createBattle(content, seeded, 'enc_forest_road', rng);
  let grid = battle.grid;
  for (const prop of battle.props) grid = withTile(grid, prop.pos, prop.previous);
  return { ...battle, grid, props: [] };
}

/** An empty, walkable tile with `radius` clear tiles around it, props included. */
function openTile(draft: BattleDraft, radius = 1): Vec2 {
  const occupied = new Set(draft.units.flatMap((u) => [posKey(u.pos)]));
  for (let y = radius; y < draft.grid.height - radius; y++) {
    for (let x = radius; x < draft.grid.width - radius; x++) {
      let clear = true;
      for (let dy = -radius; dy <= radius && clear; dy++) {
        for (let dx = -radius; dx <= radius && clear; dx++) {
          const pos = { x: x + dx, y: y + dy };
          const tile = tileAt(draft.grid, pos);
          if (
            !tile ||
            tile.blocked ||
            tile.surface ||
            occupied.has(posKey(pos)) ||
            draft.propAt(pos)
          ) {
            clear = false;
          }
        }
      }
      if (clear) return { x, y };
    }
  }
  throw new Error('no open tile on this map');
}

function place(draft: BattleDraft, propId: string, pos: Vec2): PropInstance {
  const prop = draft.placeProp(propId, pos);
  if (!prop) throw new Error(`could not place ${propId}`);
  return prop;
}

function eventOf(draft: BattleDraft, type: GameEvent['type']): GameEvent | undefined {
  return draft.events.find((event) => event.type === type);
}

/** The tiles within `radius` orthogonal steps of a centre. */
function orthogonal(pos: Vec2, radius: number): Vec2[] {
  const out: Vec2[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.abs(dx) + Math.abs(dy) <= radius) out.push({ x: pos.x + dx, y: pos.y + dy });
    }
  }
  return out;
}

describe('props that burn', () => {
  let draft: BattleDraft;
  beforeEach(() => {
    draft = freshDraft();
  });

  it('catches fire instead of taking damage from the first fire hit', () => {
    const pos = openTile(draft);
    const hay = place(draft, HAYSTACK.id, pos);

    draft.damageProp(hay.id, 4, 'fire');

    expect(draft.propAt(pos)?.hp).toBe(hay.hp);
    expect(draft.propAt(pos)?.burning).toBe(HAYSTACK.fuel);
    expect(eventOf(draft, 'propIgnited')).toMatchObject({
      type: 'propIgnited',
      propId: hay.id,
      pos,
      label: 'The Test Haystack catches fire!',
    });
    expect(appendLog(TEST_CONTENT, draft.toBattle(), [], draft.events)).toContain(
      'The Test Haystack catches fire!',
    );
  });

  it('catches even when the ordinary vulnerable hit would have broken it', () => {
    const pos = openTile(draft);
    const kindling = place(draft, KINDLING.id, pos);

    draft.damageProp(kindling.id, 4, 'fire');

    expect(draft.propAt(pos)).toMatchObject({ hp: kindling.hp, burning: 1 });
    expect(draft.events.some((event) => event.type === 'propDestroyed')).toBe(false);
  });

  it('paints fire in its ignite radius and burns a round of fuel', () => {
    const pos = openTile(draft, 2);
    const hay = place(draft, HAYSTACK.id, pos);
    draft.damageProp(hay.id, 4, 'fire');

    draft.tickTerrain();

    expect(draft.propAt(pos)?.burning).toBe(2);
    for (const tile of orthogonal(pos, 1)) {
      expect(tileAt(draft.grid, tile)?.surface?.id, `fire at ${posKey(tile)}`).toBe('fire');
    }
    // Orthogonal distance, not a square: the diagonals stay dark.
    expect(tileAt(draft.grid, { x: pos.x + 1, y: pos.y + 1 })?.surface ?? null).toBeNull();
    expect(tileAt(draft.grid, pos)?.surface?.spread).toBe(1);
    expect(tileAt(draft.grid, pos)?.surface?.duration).toBe(1);

    draft.tickTerrain();
    expect(draft.propAt(pos)?.burning).toBe(1);
  });

  it('burns away into burnsInto, and falls back to onBreak without one', () => {
    const pos = openTile(draft, 2);
    const hay = place(draft, HAYSTACK.id, pos);
    draft.damageProp(hay.id, 4, 'fire');

    draft.tickTerrain();
    draft.tickTerrain();
    draft.tickTerrain();

    expect(draft.propAt(pos)).toBeUndefined();
    expect(tileAt(draft.grid, pos)?.surface?.id).toBe('rubble');
    const destroyed = draft.events.filter((event) => event.type === 'propDestroyed').at(-1);
    expect(destroyed).toMatchObject({ label: 'The Test Haystack burns away.' });

    // No `burnsInto`: the ordinary break effects run instead.
    const fallback = freshDraft();
    const other = openTile(fallback, 1);
    const kindling = place(fallback, KINDLING.id, other);
    fallback.damageProp(kindling.id, 1, 'fire');
    expect(fallback.propAt(other)?.burning).toBe(1);

    fallback.tickTerrain();

    expect(fallback.propAt(other)).toBeUndefined();
    expect(tileAt(fallback.grid, other)?.surface?.id).toBe('mud');
    const last = fallback.events.filter((event) => event.type === 'propDestroyed').at(-1);
    expect(last).toMatchObject({ label: 'The Test Kindling burns away.' });
  });

  it('is put out by listed damage without taking that hit', () => {
    const pos = openTile(draft);
    const hay = place(draft, HAYSTACK.id, pos);
    draft.damageProp(hay.id, 4, 'fire');

    draft.damageProp(hay.id, 1, 'water');

    const after = draft.propAt(pos);
    expect(after?.hp).toBe(hay.hp);
    expect(after?.burning).toBeUndefined();
    expect(after !== undefined && 'burning' in after).toBe(false);
    expect(eventOf(draft, 'propDoused')).toMatchObject({
      label: 'The Test Haystack is put out.',
    });
  });

  it('is doused by a water or ice surface under it', () => {
    for (const surface of ['water', 'ice'] as const) {
      const local = freshDraft();
      const pos = openTile(local);
      const hay = place(local, HAYSTACK.id, pos);
      local.damageProp(hay.id, 4, 'fire');
      local.paint([pos], surface, 3, null);

      local.tickTerrain();

      expect(local.propAt(pos)?.burning, `doused by ${surface}`).toBeUndefined();
      expect(eventOf(local, 'propDoused')).toMatchObject({
        label: 'The Test Haystack is put out.',
      });
      // The fire never got to spread first.
      expect(tileAt(local.grid, pos)?.surface?.id).toBe(surface);
    }
  });

  it('is put out without damage by water or ice beside a solid burning prop', () => {
    for (const surface of ['water', 'ice'] as const) {
      const local = freshDraft();
      const pos = openTile(local);
      const hay = place(local, SOLID_ASH.id, pos);
      local.damageProp(hay.id, 1, 'fire');
      local.paint([{ x: pos.x + 1, y: pos.y }], surface, 3, null);

      local.tickTerrain();

      expect(local.propAt(pos)).toMatchObject({ hp: hay.hp });
      expect(local.propAt(pos)?.burning, `put out beside ${surface}`).toBeUndefined();
      expect(local.events.some((event) => event.type === 'propDoused')).toBe(true);
    }
  });

  it('is doused by water or ice that expires this upkeep', () => {
    for (const surface of ['water', 'ice'] as const) {
      const local = freshDraft();
      const pos = openTile(local);
      const hay = place(local, HAYSTACK.id, pos);
      local.damageProp(hay.id, 4, 'fire');
      const lit = local.propAt(pos);
      expect(lit?.burning).toBe(HAYSTACK.fuel);
      local.paint([pos], surface, 1, null);
      // Count only what the upkeep emits: the setup's own ignition is not it.
      const before = local.events.length;

      local.tickTerrain();
      const emitted = local.events.slice(before);

      // The surface was there at upkeep, so it still put the prop out — and
      // dousing wins outright: no fire painted and no fuel spent.
      expect(local.propAt(pos)?.burning, `doused by ${surface}`).toBeUndefined();
      expect(tileAt(local.grid, pos)?.surface ?? null, `fire on ${surface}`).toBeNull();
      expect(local.propAt(pos)?.hp).toBe(lit?.hp);
      expect(emitted.filter((event) => event.type === 'propDoused')).toHaveLength(1);
      expect(emitted.filter((event) => event.type === 'propIgnited')).toHaveLength(0);
    }
  });

  it('does not bring back an expired surface when a solid prop burns away', () => {
    const pos = openTile(draft, 2);
    // Water under the prop when it is placed: the journal remembers it.
    draft.paint([pos], 'water', 2, null);
    const hay = place(draft, SOLID_ASH.id, pos);
    expect(hay.previous.surface?.id).toBe('water');
    // The puddle dries out under the prop while it stands.
    draft.tickTerrain();
    draft.tickTerrain();
    expect(tileAt(draft.grid, pos)?.surface ?? null).toBeNull();

    draft.damageProp(hay.id, 1, 'fire');
    for (let round = 0; round < (SOLID_ASH.fuel ?? 0) && draft.propAt(pos); round++) {
      draft.tickTerrain();
    }

    expect(draft.propAt(pos)).toBeUndefined();
    const after = tileAt(draft.grid, pos);
    expect(after?.blocked, 'the baked flags are lifted').toBe(false);
    expect(after?.surface?.id, 'the dried puddle stays dry').not.toBe('water');
  });

  it('ignites from fire that expires this upkeep', () => {
    const pos = openTile(draft, 2);
    const hay = place(draft, HAYSTACK.id, pos);
    draft.paint([pos], 'fire', 1, null);
    expect(tileAt(draft.grid, pos)?.surface?.id).toBe('fire');

    draft.tickTerrain();

    expect(tileAt(draft.grid, pos)?.surface ?? null).toBeNull();
    expect(draft.propAt(pos)?.hp).toBe(hay.hp);
    expect(draft.propAt(pos)?.burning).toBe(HAYSTACK.fuel);
    expect(draft.events.filter((event) => event.type === 'propIgnited')).toHaveLength(1);
  });

  it('lights a solid fuel prop from fire beside it that expires this upkeep', () => {
    const pos = openTile(draft, 2);
    place(draft, SOLID_HAY.id, pos);
    draft.paint([{ x: pos.x + 1, y: pos.y }], 'fire', 1, null);

    draft.tickTerrain();

    expect(draft.propAt(pos)?.burning).toBe(SOLID_HAY.fuel);
    expect(draft.events.filter((event) => event.type === 'propIgnited')).toHaveLength(1);
  });

  it('does not burn a fuel-less prop from fire that expires this upkeep', () => {
    const pos = openTile(draft, 2);
    const rack = place(draft, SOLID_RACK.id, pos);
    draft.paint([{ x: pos.x + 1, y: pos.y }], 'fire', 1, null);

    draft.tickTerrain();

    // Exactly as on main: the surface is gone before a fuel-less prop reads it.
    expect(draft.propAt(pos)?.hp).toBe(rack.hp);
    expect(draft.propAt(pos)?.burning).toBeUndefined();
    expect(draft.events.filter((event) => event.type === 'propDamaged')).toHaveLength(0);
    expect(draft.events.filter((event) => event.type === 'propIgnited')).toHaveLength(0);
  });

  it('still burns a fuel-less prop from fire beside it that is still lit', () => {
    const pos = openTile(draft, 2);
    const rack = place(draft, SOLID_RACK.id, pos);
    draft.paint([{ x: pos.x + 1, y: pos.y }], 'fire', 3, null);

    draft.tickTerrain();

    expect(draft.propAt(pos)?.hp).toBe(rack.hp - 4);
    expect(draft.propAt(pos)?.burning).toBeUndefined();
  });

  it('ignores a damage type that is not in its douse list', () => {
    const pos = openTile(draft);
    const hay = place(draft, HAYSTACK.id, pos);
    draft.damageProp(hay.id, 4, 'fire');

    draft.damageProp(hay.id, 1, 'cold');
    draft.damageProp(hay.id, 1, 'earth');

    expect(draft.propAt(pos)?.burning).toBe(HAYSTACK.fuel);
    expect(draft.events.some((event) => event.type === 'propDoused')).toBe(false);
  });

  it('lights the prop next door on the following upkeep, one ring per round', () => {
    const pos = openTile(draft, 2);
    const first = place(draft, HAYSTACK.id, pos);
    const second = place(draft, HAYSTACK.id, { x: pos.x + 1, y: pos.y });
    draft.damageProp(first.id, 4, 'fire');

    draft.tickTerrain();

    expect(draft.props.find((p) => p.id === first.id)?.burning).toBe(2);
    // Ignited, but its own fuel is untouched: a prop lights one round and
    // starts burning the next, never both in the same upkeep.
    expect(draft.props.find((p) => p.id === second.id)?.burning).toBe(HAYSTACK.fuel);

    draft.tickTerrain();

    expect(draft.props.find((p) => p.id === second.id)?.burning).toBe(2);
  });

  it('lights a solid prop from the fire beside it', () => {
    const pos = openTile(draft, 2);
    place(draft, SOLID_HAY.id, pos);
    draft.paint([{ x: pos.x + 1, y: pos.y }], 'fire', 3, null);
    expect(tileAt(draft.grid, pos)?.surface, 'its own tile stays bare').toBeNull();

    draft.tickTerrain();

    expect(draft.propAt(pos)?.burning).toBe(SOLID_HAY.fuel);
  });

  it('leaves a prop with no fuel exactly as it was', () => {
    const pos = openTile(draft, 2);
    const rack = place(draft, RACK.id, pos);

    draft.damageProp(rack.id, 4, 'fire');

    expect(draft.propAt(pos)?.hp).toBe(rack.hp - 4);
    expect(draft.propAt(pos)?.burning).toBeUndefined();

    // Standing in fire still only burns it down, exactly as before B-2.
    draft.paint([pos], 'fire', 3, null);
    draft.tickTerrain();

    expect(draft.propAt(pos)?.burning).toBeUndefined();
    expect(draft.propAt(pos)?.hp ?? rack.hp).toBeLessThan(rack.hp - 4);
    expect(draft.events.some((event) => event.type === 'propIgnited')).toBe(false);
  });

  it('resumes a mid-burn save identically', () => {
    const seeded = createGame(TEST_CONTENT, {
      seed: 'prop-fire-save',
      party: [{ characterId: 'kaya', level: 3, autoChoose: true }],
      startNode: '',
    });
    const rng = new RngCursor(seeded.rng);
    const battle = forestRoadWithoutProps(TEST_CONTENT, seeded, rng);
    const live = new BattleDraft(TEST_CONTENT, battle, rng);
    const pos = openTile(live, 2);
    const hay = place(live, HAYSTACK.id, pos);
    live.damageProp(hay.id, 4, 'fire');
    const before: GameState = {
      ...seeded,
      screen: 'combat',
      rng: rng.state,
      battle: live.toBattle(),
    };

    const result = deserialize(serialize(before, META));
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    const loaded = stateFromBlob(result.blob);
    const beforeBattle = before.battle;
    const loadedBattle = loaded.battle;
    if (!beforeBattle || !loadedBattle) throw new Error('battle missing');

    expect(beforeBattle.props.find((p) => p.propId === HAYSTACK.id)?.burning).toBe(HAYSTACK.fuel);
    expect(loadedBattle.props.find((p) => p.propId === HAYSTACK.id)?.burning).toBe(HAYSTACK.fuel);

    const original = new BattleDraft(TEST_CONTENT, beforeBattle, new RngCursor(before.rng));
    const resumed = new BattleDraft(TEST_CONTENT, loadedBattle, new RngCursor(loaded.rng));
    original.tickTerrain();
    resumed.tickTerrain();
    original.tickTerrain();
    resumed.tickTerrain();

    expect(resumed.toBattle().props).toEqual(original.toBattle().props);
    expect(resumed.toBattle().grid).toEqual(original.toBattle().grid);
    expect(
      resumed.props.some((p) => (p.burning ?? 0) > 0),
      'still mid-burn',
    ).toBe(true);
  });

  it('runs the complete shipped hay rule and never burns another shipped prop', () => {
    const seeded = createGame(CONTENT, {
      seed: 'props-fire-shipped',
      party: [
        { characterId: 'kaya', level: 2, autoChoose: true },
        { characterId: 'bo', level: 2, autoChoose: true },
      ],
      startNode: 'battle_quarry_gate',
      flags: { ruon_spared: true },
    });
    const rng = new RngCursor(seeded.rng);
    const battle = createBattle(CONTENT, seeded, 'enc_quarry_gate', rng);
    expect(battle.props.length, 'the quarry gate should place props').toBeGreaterThan(0);

    const hay = battle.props.find((prop) => prop.propId === 'hay_bale');
    const kaya = battle.units.find((unit) => unit.characterId === 'kaya');
    const jab = CONTENT.abilities.get('fire_jab');
    if (!hay || !kaya || !jab) throw new Error('shipped hay fixture is incomplete');
    const live = new BattleDraft(CONTENT, battle, rng);
    resolveAbility(live, live.unit(kaya.id) ?? kaya, jab, hay.pos, live.rng);

    expect(live.props.find((prop) => prop.id === hay.id)).toMatchObject({
      hp: hay.hp,
      burning: 2,
    });
    expect(live.events.some((event) => event.type === 'propIgnited')).toBe(true);
    expect(live.events.some((event) => event.type === 'propDestroyed')).toBe(false);

    for (let upkeep = 0; upkeep < 2; upkeep++) {
      const eventStart = live.events.length;
      live.tickTerrain();
      expect(appendLog(CONTENT, live.toBattle(), [], live.events.slice(eventStart))).toContain(
        'The Hay Bale burns and spreads fire.',
      );
      // The first round is the bale's own cross of fire, with its solid tile left bare.
      if (upkeep === 0) {
        for (const pos of orthogonal(hay.pos, 1).filter((at) => posKey(at) !== posKey(hay.pos))) {
          expect(tileAt(live.grid, pos)?.surface?.id, `first upkeep fire at ${posKey(pos)}`).toBe(
            'fire',
          );
        }
        expect(tileAt(live.grid, hay.pos)?.surface ?? null).toBeNull();
      }
    }
    /*
     * The second round is the map joining in. The water barrel at (14,8) stands
     * beside two of the burning tiles: one round of fire weakens it, the second
     * breaks it, and its water puts out the fire next to it. The far side of the
     * bale keeps burning.
     */
    const barrel = battle.props.find(
      (prop) => prop.propId === 'water_barrel' && prop.pos.x === 14 && prop.pos.y === 8,
    );
    expect(barrel, 'the gatehouse barrel beside the bale').toBeDefined();
    expect(live.props.some((prop) => prop.id === barrel?.id)).toBe(false);
    expect(tileAt(live.grid, { x: 14, y: 7 })?.surface?.id).not.toBe('fire');
    expect(tileAt(live.grid, { x: 13, y: 8 })?.surface?.id).not.toBe('fire');
    expect(tileAt(live.grid, { x: 12, y: 7 })?.surface?.id).toBe('fire');
    expect(tileAt(live.grid, { x: 13, y: 6 })?.surface?.id).toBe('fire');
    expect(live.props.some((prop) => prop.id === hay.id)).toBe(false);
    expect(
      live.events.some(
        (event) => event.type === 'propDestroyed' && event.label === 'The Hay Bale burns away.',
      ),
    ).toBe(true);
    expect(appendLog(CONTENT, live.toBattle(), [], live.events)).toEqual(
      expect.arrayContaining([
        'The Hay Bale catches fire!',
        'The Hay Bale burns and spreads fire.',
        'The Hay Bale burns away.',
      ]),
    );

    for (const damageType of ['water', 'cold', 'earth'] as const) {
      const local = new BattleDraft(CONTENT, battle, new RngCursor(1));
      local.damageProp(hay.id, 1, 'fire');
      local.damageProp(hay.id, 1, damageType);
      expect(local.props.find((prop) => prop.id === hay.id)?.burning).toBeUndefined();
      expect(local.events.some((event) => event.type === 'propDoused')).toBe(true);
      expect(appendLog(CONTENT, local.toBattle(), [], local.events)).toContain(
        'The Hay Bale is put out.',
      );
    }

    const secondFire = new BattleDraft(CONTENT, battle, new RngCursor(2));
    secondFire.damageProp(hay.id, 1, 'fire');
    secondFire.damageProp(hay.id, 4, 'fire');
    expect(secondFire.props.some((prop) => prop.id === hay.id)).toBe(false);

    const wind = new BattleDraft(CONTENT, battle, new RngCursor(3));
    wind.damageProp(hay.id, 4, 'air');
    expect(wind.props.some((prop) => prop.id === hay.id)).toBe(false);

    for (const prop of live.props) {
      if (prop.propId !== 'hay_bale') expect(prop.burning).toBeUndefined();
    }
  });

  it('lights and burns away shipped hay through reducer actions and real round upkeep', () => {
    const seeded = createGame(CONTENT, {
      seed: 'props-fire-reducer',
      party: [{ characterId: 'kaya', level: 3, autoChoose: true }],
      startNode: '',
    });
    const rng = new RngCursor(seeded.rng);
    const battle = createBattle(CONTENT, seeded, 'enc_quarry_gate', rng);
    const hay = battle.props.find((prop) => prop.propId === 'hay_bale');
    const kaya = battle.units.find((unit) => unit.characterId === 'kaya');
    if (!hay || !kaya) throw new Error('shipped reducer hay fixture is incomplete');

    // Two tiles up the road with a clear line: outside the bale's own cross of fire.
    const adjacent = { x: hay.pos.x, y: hay.pos.y - 2 };
    let state: GameState = {
      ...seeded,
      screen: 'combat',
      rng: rng.state,
      battle: {
        ...battle,
        units: battle.units.map((unit) => ({
          ...unit,
          ...(unit.id === kaya.id ? { pos: adjacent } : {}),
          ai: unit.id === kaya.id ? 'none' : unit.ai,
        })),
        order: [kaya.id, ...battle.order.filter((id) => id !== kaya.id)],
        turnIndex: 0,
      },
    };

    const ignition = apply(CONTENT, state, {
      type: 'useAbility',
      unitId: kaya.id,
      abilityId: 'fire_jab',
      target: hay.pos,
    });
    state = ignition.state;
    expect(ignition.events.some((event) => event.type === 'propIgnited')).toBe(true);

    const ended = apply(CONTENT, state, { type: 'endTurn', unitId: kaya.id });
    state = ended.state;
    const events: GameEvent[] = [...ignition.events, ...ended.events];
    let steps = 0;
    while (
      events.filter((event) => event.type === 'roundStarted').length < 2 &&
      state.battle?.phase === 'active' &&
      steps++ < 40
    ) {
      // The hero has no AI here: when her turn comes round again she simply passes.
      const acting = state.battle.order[state.battle.turnIndex];
      const step =
        acting === kaya.id
          ? apply(CONTENT, state, { type: 'endTurn', unitId: kaya.id })
          : apply(CONTENT, state, { type: 'runAiTurn' });
      state = step.state;
      events.push(...step.events);
      for (const prop of state.battle?.props ?? []) {
        if (prop.burning !== undefined) expect(prop.propId).toBe('hay_bale');
      }
    }

    expect(events.filter((event) => event.type === 'roundStarted')).toHaveLength(2);
    expect(state.battle?.props.some((prop) => prop.id === hay.id)).toBe(false);
    // The fight is live, so the bale ends one of two ways: its fuel runs out, or an enemy's
    // fire breaks it while it burns. Either way it is gone, through the destroy path.
    expect(events.some((event) => event.type === 'propDestroyed' && event.propId === hay.id)).toBe(
      true,
    );
  });
});
