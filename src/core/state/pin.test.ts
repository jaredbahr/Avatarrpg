/**
 * The conversation pin's set half (ADR 0047 §4, B1) — written by the
 * NPC-tap path and by nothing else, and only for a resident-bound NpcDef.
 * The pin stores the resident's anchor id, not a tile.
 *
 * No real NpcDef is bound until W5a, so `BOUND` binds Elder Mira to a
 * synthetic resident standing on her tile (`testResidents.ts`).
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
import { TEST_ANCHOR, TEST_RESIDENT, withBoundNpc } from '../story/testResidents';
import { RANK_CONVERSATION, resolveResidents } from '../story/residents';
import { placedNpcs } from '../story/world';

const BOUND = withBoundNpc(CONTENT, 'ba_dan_village', 'elder_mira');
const PIN = { npcId: 'elder_mira', mapId: 'ba_dan_village', anchor: TEST_ANCHOR };

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
  it('is set, with the anchor id, when a resident-bound NpcDef opens a conversation', () => {
    const result = apply(BOUND, besideMira(), { type: 'walkTo', pos: { x: 11, y: 5 } });
    expect(result.state.screen).toBe('dialogue');
    expect(result.state.world.talk).toEqual(PIN);
  });

  it('pins nobody when an unbound NpcDef opens a conversation', () => {
    // Real content binds no NpcDef yet: the same tap opens the same
    // conversation, but there is no resident to hold in place.
    const result = apply(CONTENT, besideMira(), { type: 'walkTo', pos: { x: 11, y: 5 } });
    expect(result.state.screen).toBe('dialogue');
    expect(result.state.world.talk).toBeNull();
  });

  it('is cleared by the command that leaves the conversation', () => {
    const opened = apply(BOUND, besideMira(), { type: 'walkTo', pos: { x: 11, y: 5 } }).state;
    expect(opened.world.talk).not.toBeNull();

    // `mira_intro`'s `next` is `village_explore`, so playing it to the end
    // returns to explore; `settle` clears the pin on that command.
    let loaded = opened;
    for (let i = 0; i < 50 && loaded.screen === 'dialogue'; i++) {
      loaded = apply(BOUND, loaded, { type: 'advanceDialogue' }).state;
    }
    expect(loaded.screen).toBe('explore');
    expect(loaded.world.talk).toBeNull();
  });

  it('holds the speaker on the pinned tile, at rank 0, at every line of the conversation', () => {
    const village = BOUND.maps.get('ba_dan_village');
    if (!village) throw new Error('Missing village map');
    let state = apply(BOUND, besideMira(), { type: 'walkTo', pos: { x: 11, y: 5 } }).state;
    let lines = 0;
    for (; lines < 50 && state.screen === 'dialogue'; lines++) {
      const placement = resolveResidents(BOUND, state).placements.find(
        (p) => p.id === TEST_RESIDENT,
      );
      expect(placement?.rank).toBe(RANK_CONVERSATION);
      expect(placement?.anchor).toBe(TEST_ANCHOR);
      const speaker = placedNpcs(BOUND, village, state).find((npc) => npc.id === 'elder_mira');
      expect(speaker?.pos).toEqual({ x: 11, y: 5 });
      state = apply(BOUND, state, { type: 'advanceDialogue' }).state;
    }
    expect(lines).toBeGreaterThan(1);
  });

  it('is not written by a dialogue entry that did not go through walkTo', () => {
    // `enterNode` bypasses `handleWalkTo` entirely — the proof that the pin is
    // written only by the NPC-tap path, not on every dialogue entry.
    const result = apply(BOUND, besideMira(), { type: 'enterNode', nodeId: 'mira_intro' });
    expect(result.state.screen).toBe('dialogue');
    expect(result.state.world.talk).toBeNull();
  });

  it('survives a save/reload mid-conversation, and clears once reloaded and played to the end', () => {
    // walkTo opens the conversation and sets the pin; advance one line short
    // of the end, then round-trip through the full load path (serialize ->
    // deserialize -> reconcileDisciplines -> reconcileWorld, matching
    // App.ts) before checking the pin is still there.
    const opened = apply(BOUND, besideMira(), { type: 'walkTo', pos: { x: 11, y: 5 } }).state;
    expect(opened.screen).toBe('dialogue');
    const advanced = apply(BOUND, opened, { type: 'advanceDialogue' }).state;
    expect(advanced.screen).toBe('dialogue');

    const reloaded = reload(BOUND, advanced);
    expect(reloaded.screen).toBe('dialogue');
    expect(reloaded.world.talk).toEqual(PIN);

    // Now play the reloaded conversation to the end; settle() clears the
    // pin on the command that leaves it, the same as the in-memory case.
    let played = reloaded;
    for (let i = 0; i < 50 && played.screen === 'dialogue'; i++) {
      played = apply(BOUND, played, { type: 'advanceDialogue' }).state;
    }
    expect(played.screen).toBe('explore');
    expect(played.world.talk).toBeNull();
  });
});
