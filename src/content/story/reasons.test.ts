import { describe, expect, it } from 'vitest';
import { CONTENT } from '../index';
import { CHARACTERS } from '../characters';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import { resolveDialogue } from '../../core/story/storyEngine';
import { visibleNpcs } from '../../core/story/world';
import type { GameState } from '../../core/types';
import { REASON_FINDS, reasonFlag } from './reasons';

function party(ids: readonly string[], flags: GameState['flags'] = {}): GameState {
  const state = createGame(CONTENT, {
    seed: 'reasons',
    party: ids.map((characterId) => ({ characterId })),
    startNode: 'village_explore',
  });
  return { ...state, flags: { ...state.flags, act1_complete: true, ...flags } };
}

function markers(state: GameState, mapId: string): string[] {
  const map = CONTENT.maps.get(mapId);
  if (!map) throw new Error(mapId);
  return visibleNpcs(CONTENT, map, state)
    .map((npc) => npc.id)
    .filter((id) => id.startsWith('reason_'));
}

describe('each hero’s reason to keep going (C-31)', () => {
  it('gives every hero but Sura one find; hers is the culvert in the Cutting', () => {
    const heroes = CHARACTERS.map((character) => character.id).filter((id) => id !== 'sura');
    expect(REASON_FINDS.map((find) => find.hero).sort()).toEqual([...heroes].sort());
  });

  it('stands a find on the map only for a hero in the party, and only after the rescue', () => {
    const table = party(['kaya', 'bo', 'jinu']);
    expect(markers(table, 'quarry_floor').sort()).toEqual(['reason_bo', 'reason_kaya']);
    expect(markers(table, 'quarry_gate')).toEqual(['reason_jinu']);
    expect(
      markers({ ...table, flags: { ...table.flags, act1_complete: false } }, 'quarry_floor'),
    ).toEqual([]);
    // A solo non-bender sees only her own.
    expect(markers(party(['riko']), 'quarry_floor')).toEqual(['reason_riko']);
  });

  it('lets the hero speak, records the find and clears the marker', () => {
    const start = apply(CONTENT, party(['wen', 'nima']), {
      type: 'enterNode',
      nodeId: 'reason_wen',
    }).state;
    const node = CONTENT.story.get('reason_wen');
    if (node?.kind !== 'dialogue') throw new Error('reason_wen');
    expect(resolveDialogue(start, node).speaker).toBe('Wen');
    let state = start;
    for (let step = 0; step < 5 && state.screen === 'dialogue'; step++)
      state = apply(CONTENT, state, { type: 'advanceDialogue' }).state;
    expect(state.flags[reasonFlag('wen')]).toBe(true);
    expect(state.story.nodeId).toBe('quarry_after_explore');
    expect(markers(state, 'quarry_floor')).toEqual(['reason_nima']);
  });

  it('keeps the party-neutral reason on the rescue route for every party', () => {
    const epilogue = CONTENT.story.get('act1_epilogue');
    expect(epilogue?.kind === 'dialogue' && epilogue.next).toBe('quarry_ledger');
    const ledger = CONTENT.story.get('quarry_ledger');
    expect(ledger?.kind === 'dialogue' && ledger.variants).toBeUndefined();
  });
});
