/**
 * Props that catch fire, burn and go out (B-2).
 *
 * B-1 added the data — `fuel`, `burnsInto`, `ignites`, `douse` and
 * `PropInstance.burning` — and nothing read it. These tests are the first code
 * that does, so they double as the specification: no shipped prop declares
 * `fuel`, which is why a shipped battle must come out of these rules untouched.
 *
 * Everything here is rules only. No RNG is consumed on any path, so the
 * confirm-step preview keeps its promise of being roll-free.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { posKey, tileAt } from '../rules/grid';
import type { ContentIndex, GameEvent, GameState, PropDef, PropInstance, Vec2 } from '../types';
import { appendLog } from './log';
import { BattleDraft } from './battleDraft';
import { createBattle, createGame } from './createGame';
import { apply } from './reducer';
import { deserialize, serialize, stateFromBlob } from '../save/serialize';
import type { SaveMeta } from '../save/serialize';

/**
 * Test-only fuel props.
 *
 * They deliberately do not live in `src/content/`: no shipped prop may take
 * `fuel`, and the shipped-content test at the bottom is the proof.
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

/** No fuel: the shape every shipped prop has today. */
const RACK = fuelProp({
  id: 'test_rack',
  name: 'Test Rack',
  hp: 12,
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
  return new BattleDraft(content, createBattle(content, seeded, 'enc_forest_road', rng), rng);
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

  it('catches fire when a fire hit leaves it standing', () => {
    const pos = openTile(draft);
    const hay = place(draft, HAYSTACK.id, pos);

    draft.damageProp(hay.id, 4, 'fire');

    expect(draft.propAt(pos)?.hp).toBe(16);
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

  it('does not catch fire when the same hit breaks it', () => {
    const pos = openTile(draft);
    const kindling = place(draft, KINDLING.id, pos);

    draft.damageProp(kindling.id, 4, 'fire');

    expect(draft.propAt(pos)).toBeUndefined();
    expect(draft.events.some((event) => event.type === 'propIgnited')).toBe(false);
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
    fallback.damageProp(kindling.id, 1, 'fire'); // 3 hp, doubled to 2: it survives
    expect(fallback.propAt(other)?.burning).toBe(1);

    fallback.tickTerrain();

    expect(fallback.propAt(other)).toBeUndefined();
    expect(tileAt(fallback.grid, other)?.surface?.id).toBe('mud');
    const last = fallback.events.filter((event) => event.type === 'propDestroyed').at(-1);
    expect(last).toMatchObject({ label: 'The Test Kindling burns away.' });
  });

  it('is doused by water damage, which still lands', () => {
    const pos = openTile(draft);
    const hay = place(draft, HAYSTACK.id, pos);
    draft.damageProp(hay.id, 4, 'fire');

    draft.damageProp(hay.id, 1, 'water');

    const after = draft.propAt(pos);
    expect(after?.hp).toBe(15);
    expect(after?.burning).toBeUndefined();
    expect(after !== undefined && 'burning' in after).toBe(false);
    expect(eventOf(draft, 'propDoused')).toMatchObject({
      label: 'The Test Haystack is doused.',
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
      expect(eventOf(local, 'propDoused')).toMatchObject({ label: 'The Test Haystack is doused.' });
      // The fire never got to spread first.
      expect(tileAt(local.grid, pos)?.surface?.id).toBe(surface);
    }
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
    const battle = createBattle(TEST_CONTENT, seeded, 'enc_forest_road', rng);
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

  it('leaves a shipped-content battle with props exactly as it was', () => {
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

    let state: GameState = {
      ...seeded,
      screen: 'combat',
      rng: rng.state,
      // As in the save fixture: lend the party an AI profile so runAiTurn acts.
      battle: {
        ...battle,
        units: battle.units.map((unit) =>
          unit.faction === 'party' ? { ...unit, ai: 'aggressive' } : unit,
        ),
      },
    };

    const seen: GameEvent[] = [];
    for (let i = 0; i < 30 && state.battle?.phase === 'active'; i++) {
      const step = apply(CONTENT, state, { type: 'runAiTurn' });
      state = step.state;
      seen.push(...step.events);
      // No shipped prop has fuel, so `burning` must never appear at all.
      for (const prop of state.battle?.props ?? []) {
        expect(prop.burning, `${prop.propId} must never burn`).toBeUndefined();
      }
    }

    const upkeepRan = seen.some((event) => event.type === 'roundStarted');
    expect(upkeepRan, 'upkeep should have run').toBe(true);
    const fireEvents = seen.filter(
      (event) => event.type === 'propIgnited' || event.type === 'propDoused',
    );
    expect(fireEvents).toHaveLength(0);
    expect(seen.length, 'the fight should have done something').toBeGreaterThan(0);
  });
});
