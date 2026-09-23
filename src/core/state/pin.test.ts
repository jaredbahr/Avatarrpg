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
import type { ContentIndex, GameState } from '../types';
import { createGame } from './createGame';
import { apply } from './reducer';
import { reconcileDisciplines, reconcileWorld } from '../save/reconcile';
import { deserialize, serialize, stateFromBlob } from '../save/serialize';

const META = {
  label: 'Slot 1',
  summary: 'Pin round trip',
  savedAt: 1_700_000_000_000,
  session: { players: [{ name: 'Lorelai', unitId: 'p0' }], soloPlay: false },
};

/** deserialize -> stateFromBlob -> reconcileDisciplines -> reconcileWorld, the same order App.ts loads a save in. */
function reload(content: ContentIndex, state: GameState): GameState {
  const result = deserialize(serialize(state, META));
  if (!result.ok) throw new Error(result.error);
  return reconcileWorld(content, reconcileDisciplines(content, stateFromBlob(result.blob)));
}

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

  it('survives a save/reload mid-conversation, and clears once reloaded and played to the end', () => {
    // walkTo opens the conversation and sets the pin; advance one line short
    // of the end, then round-trip through the full load path (serialize ->
    // deserialize -> reconcileDisciplines -> reconcileWorld, matching
    // App.ts) before checking the pin is still there.
    const opened = apply(CONTENT, besideMira(), { type: 'walkTo', pos: { x: 11, y: 5 } }).state;
    expect(opened.screen).toBe('dialogue');
    const advanced = apply(CONTENT, opened, { type: 'advanceDialogue' }).state;
    expect(advanced.screen).toBe('dialogue');

    const reloaded = reload(CONTENT, advanced);
    expect(reloaded.screen).toBe('dialogue');
    expect(reloaded.world.talk).toEqual({
      npcId: 'elder_mira',
      mapId: 'ba_dan_village',
      anchor: '11,5',
    });

    // Now play the reloaded conversation to the end; settle() clears the
    // pin on the command that leaves it, the same as the in-memory case.
    let played = reloaded;
    for (let i = 0; i < 50 && played.screen === 'dialogue'; i++) {
      played = apply(CONTENT, played, { type: 'advanceDialogue' }).state;
    }
    expect(played.screen).toBe('explore');
    expect(played.world.talk).toBeNull();
  });
});
