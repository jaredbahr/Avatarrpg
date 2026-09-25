/**
 * Save format 5: `world.residentProfiles` and `world.runoff`.
 *
 * Both fields are persisted and, so far, inert — nothing in the rules reads
 * them. That makes the save layer the only thing with behaviour to pin:
 *
 *   - a new game starts with an empty profile map and an unresolved runoff;
 *   - a format-4 save gains exactly those two defaults and keeps every other
 *     field byte for byte (flags, location, clock, pin, return positions, fired
 *     triggers, cleared encounters, story, party, battle, RNG);
 *   - the 4 -> 5 step reads nothing else, so a player's clock and pin are not
 *     re-derived from where they happen to be standing;
 *   - a format-5 blob names both fields, so a blob missing one of them is
 *     damaged rather than quietly treated as legacy.
 *
 * The migration is deliberately dumb, so most of this file is one deep compare
 * over a fixture, and the interesting part is what that compare would catch: a
 * migration that reached for `location` or `flags` to invent a profile, or one
 * that rebuilt the clock the way the 3 -> 4 step does.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { apply } from '../state/reducer';
import { createBattle, createGame, SAVE_VERSION } from '../state/createGame';
import type { FlagValue, GameState } from '../types';
import {
  SAVE_FORMAT_VERSION,
  SAVE_MAGIC,
  deserialize,
  migrate,
  serialize,
  stateFromBlob,
  toBlob,
} from './serialize';

const META = {
  label: 'Slot 1',
  summary: 'Profile save',
  savedAt: 1_700_000_000_000,
  session: { players: [{ name: 'Lorelai', unitId: 'p0' }], soloPlay: false },
};

/**
 * A game in the shape format 4 wrote: `version: 4`, and a world with only the
 * five keys that existed then. Building it by naming those keys is the point —
 * a sixth key creeping into the format-4 fixture would make the compare below
 * pass for the wrong reason.
 */
type V4State = Omit<GameState, 'version' | 'world'> & {
  version: number;
  world: Omit<GameState['world'], 'residentProfiles' | 'runoff'>;
};

function asV4(state: GameState): V4State {
  return {
    ...state,
    version: 4,
    world: {
      returnPos: state.world.returnPos,
      fired: state.world.fired,
      cleared: state.world.cleared,
      clock: state.world.clock,
      talk: state.world.talk,
    },
  };
}

/** A blob with whatever state and format version the test is about. */
function blobOf(state: unknown, format: number): Record<string, unknown> {
  return {
    magic: SAVE_MAGIC,
    format,
    savedAt: META.savedAt,
    label: META.label,
    summary: META.summary,
    state,
    session: META.session,
  };
}

/** A game paused in a real fight, as `serialize.test.ts` builds one. */
function midBattle(): GameState {
  const seeded = createGame(CONTENT, {
    seed: 'profile-format-5-battle',
    party: [
      { characterId: 'kaya', level: 2, autoChoose: true },
      { characterId: 'bo', level: 2, autoChoose: true },
    ],
    startNode: 'battle_quarry_gate',
    flags: { ruon_spared: true },
  });
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(CONTENT, seeded, 'enc_quarry_gate', rng);
  let state: GameState = {
    ...seeded,
    screen: 'combat',
    rng: rng.state,
    battle: {
      ...battle,
      units: battle.units.map((unit) =>
        unit.faction === 'party' ? { ...unit, ai: 'aggressive' } : unit,
      ),
    },
  };
  for (let i = 0; i < 3 && state.battle?.phase === 'active'; i++) {
    state = apply(CONTENT, state, { type: 'runAiTurn' }).state;
  }
  return state;
}

/** Somewhere a player can be standing, with a clock and a pin worth keeping. */
function away(
  mapId: string,
  nodeId: string,
  flags: Readonly<Record<string, FlagValue>>,
  clock: GameState['world']['clock'],
  talk: GameState['world']['talk'],
): GameState {
  const base = createGame(CONTENT, {
    seed: `format-5-${mapId}`,
    party: [
      { characterId: 'kaya', level: 3 },
      { characterId: 'bo', level: 3 },
    ],
    startNode: nodeId,
  });
  return {
    ...base,
    screen: 'explore',
    flags: { ...base.flags, ...flags },
    story: { ...base.story, nodeId, visited: ['act1_open', nodeId], lineIndex: 2 },
    location: { mapId, pos: { x: 3, y: 4 } },
    world: {
      returnPos: { ba_dan_village: { x: 1, y: 1 }, [mapId]: { x: 3, y: 4 } },
      fired: ['forest_road:battle_forest_road', 'quarry_gate:encounter'],
      cleared: ['enc_forest_road'],
      clock,
      talk,
      residentProfiles: {},
      runoff: 'unresolved',
    },
  };
}

const PLACES = [
  {
    name: 'the quarry floor',
    mapId: 'quarry_floor',
    nodeId: 'quarry_after_explore',
    clock: { day: 1, phase: 'night' },
    talk: null,
  },
  {
    name: 'the forest road',
    mapId: 'forest_road',
    nodeId: 'forest_after_explore',
    clock: { day: 2, phase: 'dawn' },
    talk: null,
  },
  {
    name: 'Ba Dan',
    mapId: 'ba_dan_village',
    nodeId: 'village_return_explore',
    clock: { day: 2, phase: 'afternoon' },
    talk: { npcId: 'shopkeeper_gao', mapId: 'ba_dan_village', anchor: 'bd02.shopfront' },
  },
  {
    name: 'the riverside',
    mapId: 'ba_dan_riverside',
    nodeId: 'riverside_explore',
    clock: { day: 2, phase: 'evening' },
    talk: { npcId: 'elder_mira', mapId: 'ba_dan_village', anchor: 'bd01.table' },
  },
] as const satisfies readonly {
  name: string;
  mapId: string;
  nodeId: string;
  clock: GameState['world']['clock'];
  talk: GameState['world']['talk'];
}[];

const FLAG_SETS = [
  { name: 'no act-1 flags', flags: {} },
  { name: 'act1_complete', flags: { act1_complete: true } },
  { name: 'act1_lost', flags: { act1_lost: true } },
  { name: 'the spared custody', flags: { act1_complete: true, ruon_spared: true } },
  { name: 'the traded custody', flags: { act1_lost: true, ruon_traded: true } },
] as const;

describe('a new game is format 5', () => {
  it('records an empty profile map and an unresolved runoff, and nothing else moved', () => {
    const fresh = createGame(CONTENT, {
      seed: 'format-5-new-game',
      party: [{ characterId: 'kaya' }],
      startNode: 'act1_open',
    });

    expect(SAVE_VERSION).toBe(5);
    expect(fresh.version).toBe(5);
    expect(fresh.world.residentProfiles).toEqual({});
    expect(fresh.world.runoff).toBe('unresolved');

    // The world is the version-4 one plus exactly these two keys — no other
    // field was quietly added alongside them.
    expect(Object.keys(fresh.world).sort()).toEqual([
      'cleared',
      'clock',
      'fired',
      'residentProfiles',
      'returnPos',
      'runoff',
      'talk',
    ]);
    const v4 = asV4(fresh);
    expect(Object.keys(v4.world)).toEqual(['returnPos', 'fired', 'cleared', 'clock', 'talk']);
    expect(v4.world).toEqual({
      returnPos: {},
      fired: [],
      cleared: [],
      clock: { day: 1, phase: 'midday' },
      talk: null,
    });

    // And the version-4 baseline for that same game migrates into it field for
    // field, so "all other state is unchanged" is asserted against the game
    // itself rather than against a hand-copied list of fields.
    const result = deserialize(JSON.stringify(blobOf(v4, 4)));
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.blob.format).toBe(5);
    expect(stateFromBlob(result.blob)).toEqual(fresh);
  });
});

describe('format 4 -> 5', () => {
  for (const place of PLACES) {
    for (const set of FLAG_SETS) {
      it(`adds the two defaults to a save at ${place.name} with ${set.name}`, () => {
        const saved = away(place.mapId, place.nodeId, set.flags, place.clock, place.talk);
        const v4 = asV4(saved);

        const result = deserialize(JSON.stringify(blobOf(v4, 4)));
        expect(result.ok, result.ok ? '' : result.error).toBe(true);
        if (!result.ok) return;

        expect(result.blob.format).toBe(5);
        const loaded = stateFromBlob(result.blob);
        expect(loaded.version).toBe(5);
        expect(loaded.world.residentProfiles).toEqual({});
        expect(loaded.world.runoff).toBe('unresolved');

        // Everything else, deep-equal: flags, location, clock, pin, return
        // positions, fired triggers, cleared encounters, story, party, RNG. The
        // pin is what a migration that re-derived the world from the map would
        // get wrong, which is why these fixtures set one.
        expect(loaded).toEqual({
          ...v4,
          version: 5,
          world: { ...v4.world, residentProfiles: {}, runoff: 'unresolved' },
        });
      });
    }
  }

  it('carries a mid-battle format-4 save across with the battle untouched', () => {
    const v4 = asV4(midBattle());
    expect(v4.battle?.phase, 'the fixture should still be mid-battle').toBe('active');

    const result = deserialize(JSON.stringify(blobOf(v4, 4)));
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;

    const loaded = stateFromBlob(result.blob);
    expect(loaded).toEqual({
      ...v4,
      version: 5,
      world: { ...v4.world, residentProfiles: {}, runoff: 'unresolved' },
    });
    expect(loaded.battle).toEqual(v4.battle);
    expect(loaded.rng).toBe(v4.rng);
  });

  it('chains a format-3 save through 3 -> 4 -> 5 and keeps the clock and pin migration', () => {
    for (const [mapId, phase] of [
      ['ba_dan_riverside', 'afternoon'],
      ['ba_dan_village', 'evening'],
    ] as const) {
      const base = createGame(CONTENT, {
        seed: 5,
        party: [{ characterId: 'kaya' }],
        startNode: 'act1_open',
      });
      const blob = blobOf(
        {
          ...asV4(base),
          version: 3,
          location: { mapId, pos: { x: 1, y: 1 } },
          world: { returnPos: {}, fired: [], cleared: [] },
        },
        3,
      );

      const migrated = migrate(blob) as {
        format: number;
        state: { version: number; world: Record<string, unknown> };
      };
      expect(migrated.format).toBe(5);
      expect(migrated.state.version).toBe(5);
      expect(migrated.state.world).toEqual({
        returnPos: {},
        fired: [],
        cleared: [],
        clock: { day: 1, phase },
        talk: null,
        residentProfiles: {},
        runoff: 'unresolved',
      });

      const result = deserialize(JSON.stringify(blob));
      expect(result.ok, result.ok ? '' : result.error).toBe(true);
      if (!result.ok) return;
      expect(result.blob.format).toBe(5);
      expect(stateFromBlob(result.blob).world).toEqual(migrated.state.world);
    }
  });

  it('is idempotent: migrating the migration deep-equals the migration', () => {
    for (const state of [
      away('ba_dan_village', 'village_return_explore', {}, { day: 2, phase: 'afternoon' }, null),
      midBattle(),
    ]) {
      const once = migrate(blobOf(asV4(state), 4));
      expect((once as { format: number }).format).toBe(5);
      expect(migrate(once)).toEqual(once);
    }
  });
});

describe('a native format-5 blob', () => {
  /** A save holding one of every profile value, so the enum round-trips whole. */
  function carrying(): GameState {
    const base = createGame(CONTENT, {
      seed: 'format-5-profiles',
      party: [{ characterId: 'kaya' }],
      startNode: 'act1_open',
    });
    return {
      ...base,
      world: {
        ...base.world,
        clock: { day: 2, phase: 'evening' },
        residentProfiles: {
          elder_mira: 'missing',
          shopkeeper_gao: 'returning',
          guard_dorin: 'resting',
          guard_hanru: 'recovering',
          kaya: 'ready',
        },
        runoff: 'inspected',
      },
    };
  }

  it('round-trips every profile value and the runoff unchanged', () => {
    const state = carrying();
    const result = deserialize(serialize(state, META));
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;

    const loaded = stateFromBlob(result.blob);
    expect(loaded).toEqual(state);
    expect(loaded.world.residentProfiles).toEqual({
      elder_mira: 'missing',
      shopkeeper_gao: 'returning',
      guard_dorin: 'resting',
      guard_hanru: 'recovering',
      kaya: 'ready',
    });
    expect(loaded.world.runoff).toBe('inspected');
  });

  it('writes format 5 and leaves the state version there', () => {
    const state = carrying();
    expect(SAVE_FORMAT_VERSION).toBe(5);
    expect(toBlob(state, META).format).toBe(5);

    const result = deserialize(serialize(state, META));
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.blob.format).toBe(5);
    expect(stateFromBlob(result.blob).version).toBe(5);
  });

  it.each([
    ['a profile value', 'state.world.residentProfiles'],
    ['the runoff value', 'state.world.runoff'],
  ])('rejects an unknown %s at its schema path', (which, path) => {
    const blob = JSON.parse(serialize(carrying(), META)) as {
      format: number;
      state: { world: Record<string, unknown> };
    };
    if (which.startsWith('a profile')) {
      blob.state.world.residentProfiles = { elder_mira: 'sleepy' };
    } else {
      blob.state.world.runoff = 'flooded';
    }

    const result = deserialize(JSON.stringify(blob));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain(path);
  });

  it.each(['residentProfiles', 'runoff'])(
    'treats a format-5 blob missing %s as damaged',
    (field) => {
      const blob = JSON.parse(serialize(carrying(), META)) as {
        format: number;
        state: { world: Record<string, unknown> };
      };
      expect(blob.format).toBe(5);
      delete blob.state.world[field];

      const result = deserialize(JSON.stringify(blob));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toContain(`state.world.${field}`);
      // Not a legacy blob, so nothing may fill the gap in: the migration only
      // knows how to take a *format-4* blob to 5.
      expect(result.error).not.toContain('newer version');
      expect((migrate(blob) as { format: number }).format).toBe(5);
    },
  );

  it('still refuses format 6 before it validates the state', () => {
    const blob = JSON.parse(serialize(carrying(), META)) as Record<string, unknown>;
    blob.format = SAVE_FORMAT_VERSION + 1;
    expect(blob.format).toBe(6);
    // Unparseable as a state on purpose: the header check has to come first.
    blob.state = {};

    const result = deserialize(JSON.stringify(blob));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('newer version');
  });
});
