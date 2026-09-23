/**
 * `reconcileWorld` — the load-time world repair (ADR 0047 §5).
 *
 * It is `settle`'s clear half plus its move half, run on a loaded save with
 * no events (there is nothing to animate on a load). These tests pin both
 * halves directly, the pin's survival through a full save round trip, and
 * the idempotence the `continuity.test` load-settles promise depends on.
 */

import { describe as suite, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { createGame } from '../state/createGame';
import type { GameState } from '../types';
import { reconcileWorld } from './reconcile';
import { deserialize, serialize, stateFromBlob } from './serialize';

const META = {
  label: 'Slot 1',
  summary: 'Reconcile save',
  savedAt: 1_700_000_000_000,
  session: { players: [{ name: 'Lorelai', unitId: 'p0' }], soloPlay: false },
};

function village(): GameState {
  return createGame(CONTENT, {
    seed: 'reconcile-world',
    party: ['kaya', 'bo', 'nilak'].map((characterId) => ({ characterId })),
    startNode: 'village_explore',
  });
}

/** Explorer on an open village tile, with the given overrides written in. */
function exploring(overrides: Partial<GameState> = {}): GameState {
  const base = village();
  return {
    ...base,
    screen: 'explore',
    location: { mapId: 'ba_dan_village', pos: { x: 3, y: 7 } },
    story: { ...base.story, nodeId: 'village_explore' },
    ...overrides,
  };
}

/** Elder Mira's real NpcDef id and tile on `ba_dan_village`. */
const MIRA = { npcId: 'elder_mira', mapId: 'ba_dan_village', anchor: '11,5' };

const withTalk = (state: GameState, talk: GameState['world']['talk']): GameState => ({
  ...state,
  world: { ...state.world, talk },
});

suite('reconcileWorld: the conversation pin (clear half)', () => {
  it('clears a stale pin when the screen is no longer dialogue', () => {
    const state = withTalk(exploring(), MIRA);
    expect(state.screen).toBe('explore');

    expect(reconcileWorld(CONTENT, state).world.talk).toBeNull();
  });

  it('clears a stale pin when the map no longer matches talk.mapId', () => {
    const state = withTalk(
      exploring({
        screen: 'dialogue',
        location: { mapId: 'ba_dan_riverside', pos: { x: 3, y: 7 } },
      }),
      MIRA,
    );

    expect(reconcileWorld(CONTENT, state).world.talk).toBeNull();
  });

  it('clears a pin whose NpcDef no longer exists on talk.mapId', () => {
    const state = withTalk(exploring({ screen: 'dialogue' }), {
      ...MIRA,
      npcId: 'nobody',
    });

    expect(reconcileWorld(CONTENT, state).world.talk).toBeNull();
  });

  it('keeps a valid, live pin unchanged: dialogue on the pinned map', () => {
    const state = withTalk(exploring({ screen: 'dialogue' }), MIRA);

    expect(reconcileWorld(CONTENT, state).world.talk).toEqual(MIRA);
  });
});

suite('reconcileWorld: the leader step (move half)', () => {
  it('moves the leader off a visible NPC tile in explore, without events', () => {
    // Elder Mira's real NpcDef tile on `ba_dan_village`.
    const state = exploring({ location: { mapId: 'ba_dan_village', pos: { x: 11, y: 5 } } });

    // `reconcileWorld` returns a `GameState`, not a `StepResult`: there is
    // nothing to animate on a load, so only the position is asserted.
    expect(reconcileWorld(CONTENT, state).location.pos).not.toEqual({ x: 11, y: 5 });
  });
});

suite('reconcileWorld: idempotence and the round trip', () => {
  it('is idempotent for a pin-bearing state and a leader-on-NPC-tile state', () => {
    const pinned = withTalk(exploring({ screen: 'dialogue' }), MIRA);
    const onNpc = exploring({ location: { mapId: 'ba_dan_village', pos: { x: 11, y: 5 } } });

    for (const state of [pinned, onNpc]) {
      const once = reconcileWorld(CONTENT, state);
      expect(reconcileWorld(CONTENT, once)).toEqual(once);
    }
  });

  it('survives a full save round trip: a live pin reloads intact', () => {
    const state = withTalk(exploring({ screen: 'dialogue' }), MIRA);

    const result = deserialize(serialize(state, META));
    if (!result.ok) throw new Error(result.error);
    const reloaded = reconcileWorld(CONTENT, stateFromBlob(result.blob));

    expect(reloaded.world.talk).toEqual(MIRA);
  });
});
