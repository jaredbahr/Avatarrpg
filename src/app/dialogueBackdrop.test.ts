import { describe, expect, it } from 'vitest';
import type { GameState } from '../core/types';
import { CONTENT } from '../content';
import { dialogueBackdropOwner } from './App';

function dialogueState(nodeId: string, mapId: string): GameState {
  return {
    screen: 'dialogue',
    story: { nodeId },
    location: { mapId },
    battle: null,
  } as unknown as GameState;
}

describe('loaded dialogue backdrop', () => {
  it('rebuilds the exploration world recorded by the save', () => {
    expect(dialogueBackdropOwner(CONTENT, dialogueState('mira_intro', 'ba_dan_village'))).toEqual({
      kind: 'explore',
      mapId: 'ba_dan_village',
    });
  });

  it('rebuilds a retained battle when the save still owns one', () => {
    const state = dialogueState('mira_intro', 'ba_dan_village');
    const battle = { mapId: 'forest_road' } as GameState['battle'];
    const owner = dialogueBackdropOwner(CONTENT, { ...state, battle });
    // A suspended fight belongs to the exact battle, not to its map.
    expect(owner).toEqual({ kind: 'combat', battle });
    expect(owner && 'battle' in owner ? owner.battle : null).toBe(battle);
  });

  it('uses the parchment stage for interludes and worldless story nodes', () => {
    expect(dialogueBackdropOwner(CONTENT, dialogueState('act1_open', 'ba_dan_village'))).toBeNull();
    expect(dialogueBackdropOwner(CONTENT, dialogueState('mira_intro', ''))).toBeNull();
    expect(
      dialogueBackdropOwner(CONTENT, dialogueState('missing_node', 'ba_dan_village')),
    ).toBeNull();
  });
});
