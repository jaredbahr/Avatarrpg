/**
 * The difficulty setting in a save (ADR 0110).
 *
 * It is an additive `GameState` field with a schema default rather than a new
 * save format: every save written before it existed was played at the
 * forgiving tuning, which is exactly what Story is.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { createBattle, createGame } from '../state/createGame';
import { apply } from '../state/reducer';
import type { GameState } from '../types';
import { SAVE_FORMAT_VERSION, deserialize, serialize, stateFromBlob } from './serialize';

const META = {
  label: 'Slot 1',
  summary: 'Test save',
  savedAt: 1_700_000_000_000,
  session: { players: [{ name: 'Player 1', unitId: 'p0' }] },
};

function newGame(difficulty?: 'story' | 'hard'): GameState {
  return createGame(CONTENT, {
    seed: 'difficulty-save',
    party: [{ characterId: 'kaya' }, { characterId: 'sura' }, { characterId: 'bo' }],
    startNode: 'battle_quarry_gate',
    ...(difficulty ? { difficulty } : {}),
  });
}

function midBattle(difficulty: 'story' | 'hard'): GameState {
  const seeded = newGame(difficulty);
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(CONTENT, seeded, 'enc_grumbler', rng);
  return { ...seeded, screen: 'combat', rng: rng.state, battle };
}

function load(json: string): GameState {
  const result = deserialize(json);
  if (!result.ok) throw new Error(result.error);
  return stateFromBlob(result.blob);
}

describe('difficulty in saves', () => {
  it('starts a new game at Story unless the table picks Hard', () => {
    expect(newGame().difficulty).toBe('story');
    expect(newGame('hard').difficulty).toBe('hard');
  });

  it('survives a round trip, mid-battle included', () => {
    for (const difficulty of ['story', 'hard'] as const) {
      const state = midBattle(difficulty);
      expect(load(serialize(state, META))).toEqual(state);
    }
  });

  it('loads a save written before the setting existed as Story', () => {
    const state = midBattle('hard');
    const blob = JSON.parse(serialize(state, META)) as { state: Record<string, unknown> };
    delete blob.state.difficulty;
    const loaded = load(JSON.stringify(blob));
    expect(loaded.difficulty).toBe('story');
    expect(loaded.battle).toEqual(state.battle);
  });

  it('upgrades an old format to a current save at Story', () => {
    const state = newGame('hard');
    const blob = JSON.parse(serialize(state, META)) as {
      format: number;
      state: Record<string, unknown>;
    };
    // A format-4 blob: no living-world fields and no difficulty.
    delete blob.state.difficulty;
    const world = blob.state.world as Record<string, unknown>;
    delete world.residentProfiles;
    delete world.runoff;
    blob.format = 4;
    blob.state.version = 4;
    const loaded = load(JSON.stringify(blob));
    expect(loaded.difficulty).toBe('story');
    expect(loaded.version).toBe(SAVE_FORMAT_VERSION);
  });

  it('rejects a difficulty it does not know', () => {
    const blob = JSON.parse(serialize(newGame(), META)) as { state: Record<string, unknown> };
    blob.state.difficulty = 'nightmare';
    const result = deserialize(JSON.stringify(blob));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('difficulty');
  });
});

describe('setDifficulty', () => {
  it('changes the setting without touching the fight already on the field', () => {
    const before = midBattle('story');
    const frozen = structuredClone(before);
    const { state, events } = apply(CONTENT, before, { type: 'setDifficulty', difficulty: 'hard' });
    expect(state.difficulty).toBe('hard');
    expect(events).toEqual([]);
    expect(state.battle).toBe(before.battle);
    expect(state.rng).toBe(before.rng);
    expect(before).toEqual(frozen);
  });

  it('is a no-op when the setting already matches', () => {
    const before = newGame('hard');
    expect(apply(CONTENT, before, { type: 'setDifficulty', difficulty: 'hard' }).state).toBe(
      before,
    );
  });
});
