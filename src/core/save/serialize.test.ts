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
import { createBattle, createGame } from '../state/createGame';
import type { GameState } from '../types';
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
  let state: GameState = { ...seeded, screen: 'combat', rng: rng.state, battle };
  for (let i = 0; i < 12 && state.battle?.phase === 'active'; i++) {
    state = apply(CONTENT, state, { type: 'runAiTurn' }).state;
  }
  return state;
}

describe('save round trip', () => {
  it('survives a round trip unchanged', () => {
    const before = midBattleState();
    expect(before.battle, 'the fixture should still be mid-battle').not.toBeNull();

    const result = deserialize(serialize(before, META));
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;

    const after = stateFromBlob(result.blob);

    // Deep equality, not a spot check: this is what fails when a new field is
    // added to GameState/BattleState and not to the schema in serialize.ts.
    expect(after).toEqual(before);
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

  it('exports the same state it serialises, just readable', () => {
    const state = midBattleState();
    const pretty = serializeForExport(state, META);
    expect(pretty).toContain('\n  ');

    const result = deserialize(pretty);
    if (!result.ok) throw new Error(result.error);
    expect(stateFromBlob(result.blob)).toEqual(state);
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
    expect(describeProgress(state, 'The Quarry Gate')).toBe(
      'The Quarry Gate — level 1 — Lorelai',
    );
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
