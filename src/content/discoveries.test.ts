import { describe, expect, it } from 'vitest';
import { CONTENT } from './index';
import { DISCOVERIES } from './maps/discoveries';
import { createGame } from '../core/state/createGame';
import { apply } from '../core/state/reducer';
import { deserialize, serialize, stateFromBlob } from '../core/save/serialize';
import type { GameState } from '../core/types';

function finish(state: GameState): GameState {
  for (let count = 0; state.screen === 'dialogue' && count < 10; count++)
    state = apply(CONTENT, state, { type: 'advanceDialogue' }).state;
  expect(state.screen).toBe('explore');
  return state;
}

describe('optional roadside discoveries', () => {
  for (const item of DISCOVERIES) {
    it(`${item.id} is reachable, remembered after loading, and never pays repeat rewards`, () => {
      const initial = createGame(CONTENT, {
        seed: 'discoveries',
        party: [{ characterId: 'kaya' }],
        startNode: item.back,
      });
      const entered = apply(CONTENT, initial, { type: 'enterNode', nodeId: item.back }).state;
      const start = {
        ...entered,
        story: {
          ...entered.story,
          visited: [...entered.story.visited, 'road_depart', 'after_forest', 'after_ambush'],
        },
      };
      let state = apply(CONTENT, start, { type: 'walkTo', pos: item.pos }).state;
      expect(state.story.nodeId).toBe(`discover_${item.id}`);
      const position = state.location.pos;
      state = finish(state);
      expect(state.flags[`world.discovered.${item.id}`]).toBe(true);
      expect(state.location).toEqual({ mapId: item.map, pos: position });
      expect(state.party).toEqual(start.party);
      const blob = deserialize(
        serialize(state, {
          label: 'Discovery',
          summary: 'Roadside',
          savedAt: 1,
          session: { players: [{ name: 'Player', unitId: 'p0' }], soloPlay: false },
        }),
      );
      expect(blob.ok).toBe(true);
      if (!blob.ok) throw new Error(blob.error);
      state = stateFromBlob(blob.blob);
      state = apply(CONTENT, state, { type: 'walkTo', pos: item.pos }).state;
      expect(state.story.nodeId).toBe(`revisit_${item.id}`);
      state = finish(state);
      expect(state.party).toEqual(start.party);
      expect(state.world.cleared).toEqual(start.world.cleared);
    });
  }
});
