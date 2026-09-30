/**
 * Save round-trip.
 *
 * The important test here is `survives a round trip unchanged`. `toBlob` writes
 * `GameState` through an unchecked cast, and zod's default `strip` behaviour
 * silently drops any key the schema does not name. Add a field to `GameState` or
 * `BattleState` and forget `serialize.ts`, and the save *writes* fine, *parses*
 * fine, and comes back with that field `undefined` — a crash that only ever
 * happens on a loaded mid-battle save, on somebody else's tablet.
 *
 * A deep equality check over a real mid-battle state is the only thing that
 * catches that class of bug, so it is the first test in this file and the reason
 * the file exists.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { apply } from '../state/reducer';
import { unitAbilities } from '../rules/abilities';
import { createBattle, createGame } from '../state/createGame';
import { reconcileDisciplines } from './reconcile';
import type { ContentIndex, GameState } from '../types';
import { weatherAt } from '../rules/obscurement';
import {
  SAVE_FORMAT_VERSION,
  SAVE_MAGIC,
  deserialize,
  describeProgress,
  migrate,
  serialize,
  serializeForExport,
  stateFromBlob,
} from './serialize';

const META = {
  label: 'Slot 1',
  summary: 'Test save',
  savedAt: 1_700_000_000_000,
  session: { players: [{ name: 'Lorelai', unitId: 'p0' }], soloPlay: false },
};

/** A game paused in the middle of a real fight — the richest state we can save. */
function midBattleState(): GameState {
  const seeded = createGame(CONTENT, {
    seed: 'save-round-trip',
    party: [
      { characterId: 'kaya', level: 2, autoChoose: true },
      { characterId: 'bo', level: 2, autoChoose: true },
    ],
    startNode: 'battle_quarry_gate',
    flags: { ruon_spared: true, act1_scouted: 3, quarry_password: 'lotus' },
  });

  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(CONTENT, seeded, 'enc_quarry_gate', rng);

  // Play a few turns so surfaces, statuses, cooldowns and the turn cursor all
  // carry something worth losing.
  let state: GameState = {
    ...seeded,
    screen: 'combat',
    rng: rng.state,
    battle: {
      ...battle,
      // As in the headless simulator, lend the party an AI profile. Otherwise
      // runAiTurn refuses the first human turn and the fixture never advances.
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

describe('save round trip', () => {
  it('survives a round trip unchanged', () => {
    const before = midBattleState();
    expect(before.battle?.phase, 'the fixture should still be mid-battle').toBe('active');

    const result = deserialize(serialize(before, META));
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;

    const after = stateFromBlob(result.blob);

    // Deep equality, not a spot check: this is what fails when a new field is
    // added to GameState/BattleState and not to the schema in serialize.ts.
    expect(after).toEqual(before);
  });

  it('round-trips a prop that is burning', () => {
    const base = midBattleState();
    const battle = base.battle;
    if (!battle) throw new Error('fixture should be mid-battle');
    const [first, ...rest] = battle.props;
    if (!first) throw new Error('fixture should place props');
    const before: GameState = {
      ...base,
      battle: { ...battle, props: [{ ...first, burning: 3 }, ...rest] },
    };

    const result = deserialize(serialize(before, META));
    if (!result.ok) throw new Error(result.error);
    const after = stateFromBlob(result.blob);

    expect(after).toEqual(before);
    expect(after.battle?.props[0]?.burning).toBe(3);
  });

  it('loads an older save with no burning field unchanged', () => {
    const base = midBattleState();
    const battle = base.battle;
    if (!battle) throw new Error('fixture should be mid-battle');
    if (battle.props.length === 0) throw new Error('fixture should place props');
    // Simulate a save written before `burning` existed: drop the key entirely.
    const props = battle.props.map((prop) => {
      const { burning: _burning, ...rest } = prop;
      return rest;
    });
    const before: GameState = { ...base, battle: { ...battle, props } };
    for (const prop of before.battle?.props ?? []) expect('burning' in prop).toBe(false);

    const result = deserialize(serialize(before, META));
    if (!result.ok) throw new Error(result.error);
    const after = stateFromBlob(result.blob);

    expect(after).toEqual(before);
    // Absent must stay absent, not come back as an explicit undefined or 0.
    for (const prop of after.battle?.props ?? []) expect('burning' in prop).toBe(false);
  });

  it('keeps every battle field the rules rely on', () => {
    const before = midBattleState();
    const result = deserialize(serialize(before, META));
    if (!result.ok) throw new Error(result.error);
    const after = stateFromBlob(result.blob);

    // Named explicitly so a stripped key fails with a readable message rather
    // than a wall of object diff.
    for (const key of Object.keys(before.battle ?? {})) {
      expect(
        (after.battle as Record<string, unknown> | null)?.[key],
        `battle.${key} was dropped by the save schema`,
      ).not.toBeUndefined();
    }
    for (const key of Object.keys(before)) {
      expect(
        (after as unknown as Record<string, unknown>)[key],
        `state.${key} was dropped by the save schema`,
      ).not.toBeUndefined();
    }
  });

  it('round-trips a game that is not in a battle', () => {
    const state = createGame(CONTENT, {
      seed: 42,
      party: [{ characterId: 'kaya' }],
      startNode: 'act1_open',
    });

    const result = deserialize(serialize(state, META));
    if (!result.ok) throw new Error(result.error);
    expect(stateFromBlob(result.blob)).toEqual(state);
  });

  it('preserves flag values of every permitted type', () => {
    const state: GameState = {
      ...createGame(CONTENT, {
        seed: 7,
        party: [{ characterId: 'kaya' }],
        startNode: 'act1_open',
      }),
      // Numbers matter: a standing of 0 must survive as 0, not vanish.
      flags: { spared: true, refused: false, standing: 0, tally: -2, token: 'jade' },
    };

    const result = deserialize(serialize(state, META));
    if (!result.ok) throw new Error(result.error);
    expect(stateFromBlob(result.blob).flags).toEqual({
      spared: true,
      refused: false,
      standing: 0,
      tally: -2,
      token: 'jade',
    });
  });

  it('leaves the universal abilities usable after a load', () => {
    /*
     * Shove is granted through `ContentIndex.universalAbilities` and resolved by
     * `unitAbilities()` at read time rather than written onto `Unit.abilities`,
     * which is what lets a save made before it existed pick it up with no
     * migration. The cost of that design is that nothing in the save proves it
     * survived: the ability is not *in* the blob to check.
     *
     * So this asserts the property rather than the storage — after a real round
     * trip and the load-time reconciliation, can everybody still shove a barrel?
     * It fires if `unitAbilities` stops folding the universals in, if the list
     * empties, or if the faction rule starts excluding somebody it should not.
     * Verified by making `unitAbilities` return `unit.abilities` unchanged:
     * "Kaya lost Shove across a save/load".
     *
     * Note what it deliberately does *not* need to catch: a future
     * `reconcileDisciplines` that rebuilds a unit's ability list from its kit
     * cannot drop Shove, because Shove was never in the list to drop. That is
     * the design working, not a gap.
     */
    const before = midBattleState();
    const result = deserialize(serialize(before, META));
    if (!result.ok) throw new Error(result.error);

    const loaded = reconcileDisciplines(CONTENT, stateFromBlob(result.blob));
    for (const member of loaded.party) {
      expect(
        unitAbilities(CONTENT, member).includes('shove'),
        `${member.name} lost Shove across a save/load`,
      ).toBe(true);
    }
  });

  it('exports the same state it serialises, just readable', () => {
    const state = midBattleState();
    const pretty = serializeForExport(state, META);
    expect(pretty).toContain('\n  ');

    const result = deserialize(pretty);
    if (!result.ok) throw new Error(result.error);
    expect(stateFromBlob(result.blob)).toEqual(state);
  });

  it('resumes the same combat events and RNG as an uninterrupted game', () => {
    let uninterrupted = midBattleState();
    const result = deserialize(serialize(uninterrupted, META));
    if (!result.ok) throw new Error(result.error);
    let resumed = reconcileDisciplines(CONTENT, stateFromBlob(result.blob));
    let turns = 0;
    const initialRng = resumed.rng;

    while (uninterrupted.battle?.phase === 'active' && turns < 40) {
      const command = { type: 'runAiTurn' } as const;
      const expected = apply(CONTENT, uninterrupted, command);
      const actual = apply(CONTENT, resumed, command);
      expect(actual.events, `events after resumed turn ${turns}`).toEqual(expected.events);
      expect(actual.state, `state after resumed turn ${turns}`).toEqual(expected.state);
      uninterrupted = expected.state;
      resumed = actual.state;
      turns++;
    }

    expect(turns).toBeGreaterThan(1);
    expect(resumed.rng).not.toBe(initialRng);
  });

  it('keeps a weather battle deterministic across a save/load', () => {
    /*
     * Weather is derived from the encounter and the round rather than stored,
     * so the save schema does not change. That only holds up if a loaded battle
     * keeps rolling the same shots: this runs one uninterrupted fight and one
     * interrupted by a save, both under the same sandstorm, and compares the
     * event log turn for turn.
     */
    const encounter = CONTENT.encounters.get('enc_quarry_gate');
    if (!encounter) throw new Error('Missing quarry gate encounter');
    const storm: ContentIndex = {
      ...CONTENT,
      encounters: new Map(CONTENT.encounters).set('enc_quarry_gate', {
        ...encounter,
        weather: { id: 'sandstorm', schedule: [{ fromRound: 1, intensity: 2 }] },
      }),
    };

    const seeded = createGame(storm, {
      seed: 'weather-save-round-trip',
      party: [
        { characterId: 'kaya', level: 2, autoChoose: true },
        { characterId: 'bo', level: 2, autoChoose: true },
      ],
      startNode: '',
    });
    const rng = new RngCursor(seeded.rng);
    const battle = createBattle(storm, seeded, 'enc_quarry_gate', rng);
    let uninterrupted: GameState = {
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
    for (let i = 0; i < 3 && uninterrupted.battle?.phase === 'active'; i++) {
      uninterrupted = apply(storm, uninterrupted, { type: 'runAiTurn' }).state;
    }
    expect(uninterrupted.battle?.phase).toBe('active');

    const result = deserialize(serialize(uninterrupted, META));
    if (!result.ok) throw new Error(result.error);
    let resumed = stateFromBlob(result.blob);

    // The weather is live and identical on both sides without being in the blob.
    expect(weatherAt(storm, 'enc_quarry_gate', uninterrupted.battle?.round ?? 0)).toBe(2);

    let turns = 0;
    while (uninterrupted.battle?.phase === 'active' && turns < 40) {
      const command = { type: 'runAiTurn' } as const;
      const expected = apply(storm, uninterrupted, command);
      const actual = apply(storm, resumed, command);
      expect(actual.events, `events after resumed turn ${turns}`).toEqual(expected.events);
      uninterrupted = expected.state;
      resumed = actual.state;
      turns++;
    }
    expect(turns).toBeGreaterThan(1);
  });
});

describe('save rejection', () => {
  it('rejects a file that is not JSON', () => {
    const result = deserialize('{definitely not json');
    expect(result).toEqual({ ok: false, error: 'That file is not valid JSON.' });
  });

  it('rejects a JSON file from some other game', () => {
    const result = deserialize(JSON.stringify({ magic: 'some-other-game', format: 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('not a Four Nations Tactics save');
  });

  it('names the damaged field so the error is diagnosable', () => {
    const state = midBattleState();
    const blob = JSON.parse(serialize(state, META));
    delete blob.state.flags;

    const result = deserialize(JSON.stringify(blob));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('state.flags');
  });

  it('refuses a save from a newer build rather than half-loading it', () => {
    const state = midBattleState();
    const blob = JSON.parse(serialize(state, META));
    blob.format = SAVE_FORMAT_VERSION + 1;

    const result = deserialize(JSON.stringify(blob));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('newer version');
  });

  it('never downgrades a newer save whose summary is missing', () => {
    const blob = JSON.parse(serialize(midBattleState(), META));
    blob.format = SAVE_FORMAT_VERSION + 1;
    delete blob.summary;

    const result = deserialize(JSON.stringify(blob));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('newer version');
    expect(migrate(blob)).toEqual(blob);
  });

  it('recognises a newer format before trying to parse its unfamiliar state', () => {
    const result = deserialize(
      JSON.stringify({ magic: SAVE_MAGIC, format: SAVE_FORMAT_VERSION + 1, state: {} }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('newer version');
  });

  it.each([undefined, null, -1, 0.5, '1'])('rejects an invalid format %s', (format) => {
    const blob = JSON.parse(serialize(midBattleState(), META));
    blob.format = format;
    delete blob.summary;
    const result = deserialize(JSON.stringify(blob));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('format');
  });

  it('does not repair a missing summary by remigrating a current save', () => {
    const blob = JSON.parse(serialize(midBattleState(), META));
    delete blob.summary;
    const result = deserialize(JSON.stringify(blob));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('summary');
  });
});

describe('migration', () => {
  it('synthesises a summary for a format 0 blob', () => {
    const migrated = migrate({ magic: SAVE_MAGIC, format: 0, label: 'Old slot' }) as Record<
      string,
      unknown
    >;
    expect(migrated.format).toBe(SAVE_FORMAT_VERSION);
    expect(migrated.summary).toBe('Old slot');
  });

  it('leaves a current blob alone', () => {
    const blob = { magic: SAVE_MAGIC, format: SAVE_FORMAT_VERSION, summary: 'Here' };
    expect(migrate(blob)).toEqual(blob);
  });

  it.each([0, 1])('still loads a format %s save without a summary', (format) => {
    const blob = JSON.parse(serialize(midBattleState(), META));
    blob.format = format;
    blob.state.version = 1;
    delete blob.summary;
    for (const unit of [...blob.state.party, ...blob.state.battle.units]) {
      delete unit.disciplineId;
    }
    const result = deserialize(JSON.stringify(blob));
    if (!result.ok) throw new Error(result.error);
    expect(result.blob.format).toBe(SAVE_FORMAT_VERSION);
    expect(result.blob.summary).toBe(META.label);
    expect(result.blob.state.party.every((unit) => unit.disciplineId === null)).toBe(true);
    expect(result.blob.state.battle?.units.every((unit) => unit.disciplineId === null)).toBe(true);
  });

  it('passes non-objects straight through', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate('nope')).toBe('nope');
  });
});

describe('describeProgress', () => {
  it('names the place, the level and the party', () => {
    const state = createGame(CONTENT, {
      seed: 1,
      party: [{ characterId: 'kaya', displayName: 'Lorelai' }],
      startNode: 'act1_open',
    });
    expect(describeProgress(state, 'The Quarry Gate')).toBe('The Quarry Gate — level 1 — Lorelai');
  });

  it('falls back to a location when there is no story title', () => {
    const state = createGame(CONTENT, {
      seed: 1,
      party: [{ characterId: 'kaya' }],
      startNode: 'act1_open',
    });
    expect(describeProgress(state, null)).toContain('On the road');
  });
});
