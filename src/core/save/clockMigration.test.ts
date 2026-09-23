import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { apply } from '../state/reducer';
import { createGame } from '../state/createGame';
import { reconcileDisciplines } from './reconcile';
import type { GameState } from '../types';
import { SAVE_MAGIC, deserialize, migrate, serialize, stateFromBlob } from './serialize';

const META = {
  label: 'Slot 1',
  summary: 'Test save',
  savedAt: 1_700_000_000_000,
  session: { players: [{ name: 'Lorelai', unitId: 'p0' }], soloPlay: false },
};

describe('save format 4: world.clock and world.talk (ADR 0047 W1)', () => {
  it('starts a new game at day 1, midday, with no pin', () => {
    const state = createGame(CONTENT, {
      seed: 1,
      party: [{ characterId: 'kaya' }],
      startNode: 'act1_open',
    });
    expect(state.world.clock).toEqual({ day: 1, phase: 'midday' });
    expect(state.world.talk).toBeNull();
  });

  it('round-trips clock and talk unchanged', () => {
    const state: GameState = {
      ...createGame(CONTENT, {
        seed: 2,
        party: [{ characterId: 'kaya' }],
        startNode: 'act1_open',
      }),
      world: {
        returnPos: {},
        fired: [],
        cleared: [],
        clock: { day: 3, phase: 'evening' },
        talk: { npcId: 'shopkeeper_gao', mapId: 'ba_dan_village', anchor: 'bd02.shopfront' },
      },
    };
    const result = deserialize(serialize(state, META));
    if (!result.ok) throw new Error(result.error);
    expect(stateFromBlob(result.blob).world).toEqual(state.world);
  });

  it('migrates a format-3 riverside save to afternoon with no pin', () => {
    const state = createGame(CONTENT, {
      seed: 3,
      party: [{ characterId: 'kaya' }],
      startNode: 'act1_open',
    });
    const blob = {
      magic: SAVE_MAGIC,
      format: 3,
      savedAt: META.savedAt,
      label: META.label,
      summary: META.summary,
      state: {
        ...state,
        version: 3,
        location: { mapId: 'ba_dan_riverside', pos: { x: 1, y: 1 } },
        world: { returnPos: {}, fired: [], cleared: [] },
      },
      session: META.session,
    };
    const migrated = migrate(blob) as { format: number; state: { world: unknown } };
    expect(migrated.format).toBe(4);
    expect(migrated.state.world).toEqual({
      returnPos: {},
      fired: [],
      cleared: [],
      clock: { day: 1, phase: 'afternoon' },
      talk: null,
    });

    const result = deserialize(JSON.stringify(blob));
    if (!result.ok) throw new Error(result.error);
    expect(result.blob.format).toBe(4);
  });

  it('migrates a format-3 village save to evening', () => {
    const state = createGame(CONTENT, {
      seed: 4,
      party: [{ characterId: 'kaya' }],
      startNode: 'act1_open',
    });
    const blob = {
      magic: SAVE_MAGIC,
      format: 3,
      savedAt: META.savedAt,
      label: META.label,
      summary: META.summary,
      state: {
        ...state,
        version: 3,
        location: { mapId: 'ba_dan_village', pos: { x: 1, y: 1 } },
        world: { returnPos: {}, fired: [], cleared: [] },
      },
      session: META.session,
    };
    const migrated = migrate(blob) as { state: { world: { clock: unknown } } };
    expect(migrated.state.world.clock).toEqual({ day: 1, phase: 'evening' });
  });

  it('loads a format-3 mid-conversation save (riverside Dorin) and plays it to the end', () => {
    const base = createGame(CONTENT, {
      seed: 5,
      party: [{ characterId: 'kaya' }],
      startNode: 'act1_open',
    });
    const blob = {
      magic: SAVE_MAGIC,
      format: 3,
      savedAt: META.savedAt,
      label: META.label,
      summary: META.summary,
      state: {
        ...base,
        version: 3,
        screen: 'dialogue',
        location: { mapId: 'ba_dan_riverside', pos: { x: 32, y: 12 } },
        story: { ...base.story, nodeId: 'riverside_dorin', visited: ['riverside_dorin'] },
        world: { returnPos: {}, fired: [], cleared: [] },
      },
      session: META.session,
    };
    const result = deserialize(JSON.stringify(blob));
    if (!result.ok) throw new Error(result.error);
    let loaded = reconcileDisciplines(CONTENT, stateFromBlob(result.blob));
    expect(loaded.screen).toBe('dialogue');
    expect(loaded.story.nodeId).toBe('riverside_dorin');

    // Plays to the end without crashing: advanceDialogue repeatedly until the
    // conversation exits back to explore (or safety-stops after 50 steps).
    for (let i = 0; i < 50 && loaded.screen === 'dialogue'; i++) {
      loaded = apply(CONTENT, loaded, { type: 'advanceDialogue' }).state;
    }
    expect(loaded.screen).not.toBe('dialogue');
  });

  it('rejects a save with a bad phase or day < 1', () => {
    const state = createGame(CONTENT, {
      seed: 6,
      party: [{ characterId: 'kaya' }],
      startNode: 'act1_open',
    });
    const goodBlob = JSON.parse(serialize(state, META));

    const badPhase = {
      ...goodBlob,
      state: {
        ...goodBlob.state,
        world: { ...goodBlob.state.world, clock: { day: 1, phase: 'noon' } },
      },
    };
    expect(deserialize(JSON.stringify(badPhase)).ok).toBe(false);

    const badDay = {
      ...goodBlob,
      state: {
        ...goodBlob.state,
        world: { ...goodBlob.state.world, clock: { day: 0, phase: 'midday' } },
      },
    };
    expect(deserialize(JSON.stringify(badDay)).ok).toBe(false);
  });
});
