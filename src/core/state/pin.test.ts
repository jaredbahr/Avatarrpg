/**
 * The conversation pin's set half (ADR 0047 §4, B1) — written by the
 * NPC-tap path and by nothing else.
 *
 * These tests drive the pin through the real `apply` entry point so they
 * also exercise `settle` (ADR 0047 §5, B2), which clears a pin the result no
 * longer supports.
 */

import { describe as suite, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import type { GameState } from '../types';
import { createGame } from './createGame';
import { apply } from './reducer';

/** Explore, one tile west of Elder Mira (11,5) on the village map. */
function besideMira(): GameState {
  const base = createGame(CONTENT, {
    seed: 'pin',
    party: ['kaya', 'bo', 'nilak'].map((characterId) => ({ characterId })),
    startNode: 'village_explore',
  });
  return {
    ...base,
    screen: 'explore',
    location: { mapId: 'ba_dan_village', pos: { x: 10, y: 5 } },
    story: { ...base.story, nodeId: 'village_explore' },
  };
}

suite('the conversation pin', () => {
  it('is set when a real village NpcDef opens a conversation', () => {
    const result = apply(CONTENT, besideMira(), { type: 'walkTo', pos: { x: 11, y: 5 } });
    expect(result.state.screen).toBe('dialogue');
    expect(result.state.world.talk).toEqual({
      npcId: 'elder_mira',
      mapId: 'ba_dan_village',
      anchor: '11,5',
    });
  });

  it('is cleared by the command that leaves the conversation', () => {
    const opened = apply(CONTENT, besideMira(), { type: 'walkTo', pos: { x: 11, y: 5 } }).state;
    expect(opened.world.talk).not.toBeNull();

    // `mira_intro`'s `next` is `village_explore`, so playing it to the end
    // returns to explore; `settle` clears the pin on that command.
    let loaded = opened;
    for (let i = 0; i < 50 && loaded.screen === 'dialogue'; i++) {
      loaded = apply(CONTENT, loaded, { type: 'advanceDialogue' }).state;
    }
    expect(loaded.screen).toBe('explore');
    expect(loaded.world.talk).toBeNull();
  });

  it('is not written by a dialogue entry that did not go through walkTo', () => {
    // `enterNode` bypasses `handleWalkTo` entirely — the proof that the pin is
    // written only by the NPC-tap path, not on every dialogue entry.
    const result = apply(CONTENT, besideMira(), { type: 'enterNode', nodeId: 'mira_intro' });
    expect(result.state.screen).toBe('dialogue');
    expect(result.state.world.talk).toBeNull();
  });
});
