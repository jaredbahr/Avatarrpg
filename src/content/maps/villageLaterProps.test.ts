/**
 * Ba Dan's later-state props (`docs/places/ba_dan_village.md`): the hung side gate (SQ-02), Gao's jar (SQ-03) and Hesra's
 * boot (after the welcome-home supper) are absent until their condition holds, stand on their set-piece cells once it
 * does, draw at their art's native size, and open one look-at that returns to the village hub.
 */
import { describe, expect, it } from 'vitest';
import { apply } from '../../core/state/reducer';
import { createGame } from '../../core/state/createGame';
import { npcNode } from '../../core/story/storyEngine';
import { visibleNpcs } from '../../core/story/world';
import type { GameState } from '../../core/types';
import { npcPresentationScale } from '../../app/scenes/exploreMarkerScale';
import { TOPDOWN_OBJECTS } from '../assets/manifest';
import { CONTENT } from '../index';
import { SQ02_FLAG } from '../story/sq02OfficialGate';
import { SQ03_FLAG } from '../story/sq03GaosLedger';

const VILLAGE = 'ba_dan_village';

const PROPS = [
  { id: 'side_gate_hung', cell: { x: 25, y: 2 }, node: 'look_side_gate_hung', size: [28, 32] },
  { id: 'gao_jar', cell: { x: 18, y: 7 }, node: 'look_gao_jar', size: [21, 26] },
  { id: 'hesra_boot', cell: { x: 5, y: 7 }, node: 'look_hesra_boot', size: [12, 20] },
] as const;

function village(flags: GameState['flags'] = {}, visited: readonly string[] = []): GameState {
  const base = createGame(CONTENT, {
    seed: 'later-props',
    party: [{ characterId: 'kaya' }, { characterId: 'bo' }],
    startNode: 'village_explore',
  });
  return {
    ...base,
    screen: 'explore',
    flags: { ...base.flags, ...flags },
    story: { ...base.story, nodeId: 'village_explore', visited: [...visited] },
    location: { mapId: VILLAGE, pos: CONTENT.maps.get(VILLAGE)?.partySpawns[0] ?? { x: 0, y: 0 } },
  };
}

const map = () => {
  const found = CONTENT.maps.get(VILLAGE);
  if (!found) throw new Error('Ba Dan is missing');
  return found;
};
const standing = (state: GameState, id: string) =>
  visibleNpcs(CONTENT, map(), state).find((npc) => npc.id === id);

const WHEN: Record<(typeof PROPS)[number]['id'], GameState> = {
  side_gate_hung: village({ [SQ02_FLAG]: true }),
  gao_jar: village({ [SQ03_FLAG]: true }),
  hesra_boot: village({}, ['welcome_home_supper']),
};

describe('Ba Dan later-state props', () => {
  for (const prop of PROPS) {
    it(`${prop.id} is absent until its condition holds, then stands on its cell`, () => {
      for (const other of PROPS)
        if (other.id !== prop.id) expect(standing(WHEN[prop.id], other.id)).toBeUndefined();
      expect(standing(village(), prop.id)).toBeUndefined();
      expect(standing(WHEN[prop.id], prop.id)?.pos).toEqual(prop.cell);
    });

    it(`${prop.id} is drawn at its native size and opens one look-at back to the hub`, () => {
      const sprite = `world.${prop.id}`;
      expect(npcPresentationScale(sprite)).toBe(1);
      expect([TOPDOWN_OBJECTS[sprite]?.w, TOPDOWN_OBJECTS[sprite]?.h]).toEqual([...prop.size]);
      const state = WHEN[prop.id];
      expect(npcNode(CONTENT, state, VILLAGE, prop.id)).toBe(prop.node);
      const opened = apply(CONTENT, state, { type: 'walkTo', pos: prop.cell }).state;
      expect(opened.screen).toBe('dialogue');
      expect(opened.story.nodeId).toBe(prop.node);
      let done = opened;
      for (let n = 0; done.screen === 'dialogue' && n < 10; n++)
        done = apply(CONTENT, done, { type: 'advanceDialogue' }).state;
      expect(done.screen).toBe('explore');
      expect(done.story.nodeId).toBe('village_explore');
      expect(done.flags).toEqual(state.flags);
    });
  }
});
