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
import { resolveResidents } from '../story/residents';
import { reconcileWorld } from './reconcile';
import { deserialize, serialize, stateFromBlob } from './serialize';
import { TEST_ANCHOR, TEST_RESIDENT, withBoundNpc } from '../story/residents.fixture';

/** Elder Mira bound to a synthetic resident on her tile, apart from her real schedule. */
const BOUND = withBoundNpc(CONTENT, 'ba_dan_village', 'elder_mira');

/** `BOUND` with Elder Mira's NpcDef unbound again. */
const UNBOUND = {
  ...BOUND,
  maps: new Map(
    [...BOUND.maps].map(([id, map]) => [
      id,
      {
        ...map,
        npcs: map.npcs.map((n) =>
          n.id === 'elder_mira' ? { ...n, resident: undefined, pos: { x: 11, y: 5 } } : n,
        ),
      },
    ]),
  ),
};

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

/** A live pin on the bound Elder Mira: her NpcDef id and her resident's anchor id. */
const MIRA = { npcId: 'elder_mira', mapId: 'ba_dan_village', anchor: TEST_ANCHOR };

const withTalk = (state: GameState, talk: GameState['world']['talk']): GameState => ({
  ...state,
  world: { ...state.world, talk },
});

suite('reconcileWorld: the conversation pin (clear half)', () => {
  it('clears a stale pin when the screen is no longer dialogue', () => {
    const state = withTalk(exploring(), MIRA);
    expect(state.screen).toBe('explore');

    expect(reconcileWorld(BOUND, state).world.talk).toBeNull();
  });

  it('clears a stale pin when the map no longer matches talk.mapId', () => {
    const state = withTalk(
      exploring({
        screen: 'dialogue',
        location: { mapId: 'ba_dan_riverside', pos: { x: 3, y: 7 } },
      }),
      MIRA,
    );

    expect(reconcileWorld(BOUND, state).world.talk).toBeNull();
  });

  it('clears a pin whose NpcDef no longer exists on talk.mapId', () => {
    const state = withTalk(exploring({ screen: 'dialogue' }), {
      ...MIRA,
      npcId: 'nobody',
    });

    expect(reconcileWorld(BOUND, state).world.talk).toBeNull();
  });

  it('clears a pin whose anchor no longer exists in content', () => {
    const state = withTalk(exploring({ screen: 'dialogue' }), { ...MIRA, anchor: 'gone.anchor' });

    expect(reconcileWorld(BOUND, state).world.talk).toBeNull();
  });

  it('clears a pin whose anchor is on another map', () => {
    const elsewhere = {
      ...BOUND,
      anchors: new Map([
        ...BOUND.anchors,
        [
          TEST_ANCHOR,
          {
            id: TEST_ANCHOR,
            place: 'TEST',
            site: { kind: 'map' as const, mapId: 'ba_dan_riverside', pos: { x: 15, y: 9 } },
          },
        ],
      ]),
    };
    const state = withTalk(exploring({ screen: 'dialogue' }), MIRA);

    expect(reconcileWorld(elsewhere, state).world.talk).toBeNull();
  });

  it('clears a pin whose NpcDef is no longer bound to a resident', () => {
    // The same live pin, loaded against content where Elder Mira is
    // unbound: the binding is gone, so nobody is held.
    const state = withTalk(exploring({ screen: 'dialogue' }), MIRA);
    expect(reconcileWorld(BOUND, state).world.talk).toEqual(MIRA);

    expect(reconcileWorld(UNBOUND, state).world.talk).toBeNull();
  });

  it('clears a pin whose resident record no longer exists', () => {
    const orphaned = { ...BOUND, residents: new Map() };
    const state = withTalk(exploring({ screen: 'dialogue' }), MIRA);
    expect(BOUND.residents.has(TEST_RESIDENT)).toBe(true);

    expect(reconcileWorld(orphaned, state).world.talk).toBeNull();
  });

  it("clears a same-map anchor owned by another resident and resumes the speaker's schedule", () => {
    const ordinary = exploring();
    const base = exploring({
      screen: 'dialogue',
      story: { ...ordinary.story, visited: ['mira_intro', 'dorin_home'] },
      world: { ...ordinary.world, clock: { day: 1, phase: 'morning' }, talk: null },
    });
    const state = withTalk(base, {
      npcId: 'guard_dorin',
      mapId: 'ba_dan_village',
      // Mira owns this valid village anchor; it has never been one of Dorin's slots.
      anchor: 'bd01.table',
    });

    const reconciled = reconcileWorld(CONTENT, state);
    expect(reconciled.world.talk).toBeNull();
    expect(
      resolveResidents(CONTENT, reconciled).placements.find((p) => p.id === 'lw.npc.dorin')?.anchor,
    ).toBe('bd03.post');
  });

  it('keeps an old pinless save on the ordinary resident schedule', () => {
    const ordinary = exploring();
    const old = exploring({
      screen: 'dialogue',
      story: { ...ordinary.story, visited: ['mira_intro', 'dorin_home'] },
      world: { ...ordinary.world, clock: { day: 1, phase: 'morning' }, talk: null },
    });

    const reconciled = reconcileWorld(CONTENT, old);
    expect(reconciled.world.talk).toBeNull();
    expect(
      resolveResidents(CONTENT, reconciled).placements.find((p) => p.id === 'lw.npc.dorin')?.anchor,
    ).toBe('bd03.post');
  });

  it('keeps a valid, live pin unchanged: dialogue on the pinned map, bound, anchor known', () => {
    const state = withTalk(exploring({ screen: 'dialogue' }), MIRA);

    expect(reconcileWorld(BOUND, state).world.talk).toEqual(MIRA);
  });
});

suite('reconcileWorld: the leader step (move half)', () => {
  it('moves the leader off a visible NPC tile in explore, without events', () => {
    // Elder Mira's real anchor, `bd01.table`: held there before `mira_intro`.
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
      const once = reconcileWorld(BOUND, state);
      expect(reconcileWorld(BOUND, once)).toEqual(once);
    }
  });

  it('survives a full save round trip: a live pin reloads intact', () => {
    const state = withTalk(exploring({ screen: 'dialogue' }), MIRA);

    const result = deserialize(serialize(state, META));
    if (!result.ok) throw new Error(result.error);
    const reloaded = reconcileWorld(BOUND, stateFromBlob(result.blob));

    expect(reloaded.world.talk).toEqual(MIRA);
  });
});
