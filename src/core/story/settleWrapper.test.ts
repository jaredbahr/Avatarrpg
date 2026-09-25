/**
 * `settle` — the per-command wrapper (ADR 0047 §5, B2).
 *
 * It sits beside `findSettleTile` in `settle.ts` and does two things: it
 * clears a conversation pin the result no longer supports, and — in explore
 * only — steps the leader off a visible NPC tile. These tests pin both halves
 * and the determinism the pure rules layer promises.
 */

import { describe as suite, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { createGame } from '../state/createGame';
import type { GameState } from '../types';
import { settle } from './settle';

function village(): GameState {
  return createGame(CONTENT, {
    seed: 'settle-wrapper',
    party: ['kaya', 'bo', 'nilak'].map((characterId) => ({ characterId })),
    startNode: 'village_explore',
  });
}

/** Explorer on an open village tile, with an arbitrary pin written in. */
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

const withTalk = (state: GameState, talk: GameState['world']['talk']): GameState => ({
  ...state,
  world: { ...state.world, talk },
});

suite('settle: the conversation pin (clear half)', () => {
  it('clears a stale pin when the screen is no longer dialogue', () => {
    const state = withTalk(exploring(), {
      npcId: 'elder_mira',
      mapId: 'ba_dan_village',
      anchor: '11,5',
    });
    expect(state.screen).toBe('explore');

    const result = settle(CONTENT, state, state);
    expect(result.state.world.talk).toBeNull();
  });

  it('clears a stale pin when the map no longer matches talk.mapId', () => {
    const state = withTalk(
      exploring({
        screen: 'dialogue',
        location: { mapId: 'ba_dan_riverside', pos: { x: 3, y: 7 } },
      }),
      { npcId: 'elder_mira', mapId: 'ba_dan_village', anchor: '11,5' },
    );

    const result = settle(CONTENT, state, state);
    expect(result.state.world.talk).toBeNull();
  });

  it('keeps a live pin: dialogue on the pinned map leaves `talk` unchanged', () => {
    const pin = { npcId: 'elder_mira', mapId: 'ba_dan_village', anchor: '11,5' };
    const state = withTalk(exploring({ screen: 'dialogue' }), pin);

    const result = settle(CONTENT, state, state);
    expect(result.state.world.talk).toEqual(pin);
  });
});

suite('settle: the leader step (move half)', () => {
  it('moves the leader off a visible NPC tile in explore and emits partyWalked', () => {
    // Elder Mira's real NpcDef tile on ba_dan_village.
    const state = exploring({ location: { mapId: 'ba_dan_village', pos: { x: 11, y: 5 } } });

    const result = settle(CONTENT, state, state);
    expect(result.state.location.pos).not.toEqual({ x: 11, y: 5 });
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'partyWalked',
        unitId: state.party[0]?.id,
        from: { x: 11, y: 5 },
      }),
    );
  });

  it('does nothing to the leader outside explore, even on an NPC tile', () => {
    const state = exploring({
      screen: 'dialogue',
      location: { mapId: 'ba_dan_village', pos: { x: 11, y: 5 } },
    });

    const result = settle(CONTENT, state, state);
    expect(result.state.location.pos).toEqual({ x: 11, y: 5 });
    expect(result.events.some((event) => event.type === 'partyWalked')).toBe(false);
  });

  it('is deterministic: the same inputs give the same result', () => {
    const state = exploring({ location: { mapId: 'ba_dan_village', pos: { x: 11, y: 5 } } });
    const first = settle(CONTENT, state, state);
    const second = settle(CONTENT, state, state);
    expect(first.state).toEqual(second.state);
    expect(first.events).toEqual(second.events);
  });
});
