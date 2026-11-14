/**
 * SQ-01, Too Many Cabbages: Pella's list, the sled on the Forest Road, the three choices, and
 * the payoffs at home. Played through the reducer by walking up and tapping, as a player would.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../index';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import { evaluate } from '../../core/story/conditions';
import { npcNode, resolveDialogue } from '../../core/story/storyEngine';
import { visibleNpcs } from '../../core/story/world';
import type { FlagValue, GameState, MapDef } from '../../core/types';
import { SQ01_FLAG } from './sq01Cabbages';

const VILLAGE = 'ba_dan_village';
const FOREST = 'forest_road';
const OUTCOMES = ['families', 'crew', 'leverage'] as const;

const map = (id: string): MapDef => {
  const found = CONTENT.maps.get(id);
  if (!found) throw new Error(`Missing map ${id}`);
  return found;
};

function at(
  mapId: string,
  hub: string,
  flags: Record<string, FlagValue> = {},
  visited: string[] = [],
  party = ['kaya', 'bo'],
): GameState {
  const base = createGame(CONTENT, {
    seed: 'sq01',
    party: party.map((characterId) => ({ characterId })),
    startNode: hub,
  });
  return {
    ...base,
    screen: 'explore',
    flags: { ...base.flags, ...flags },
    story: { ...base.story, nodeId: hub, visited },
    location: { mapId, pos: map(mapId).partySpawns[0] ?? { x: 0, y: 0 } },
  };
}

const npcAt = (state: GameState, npcId: string) =>
  visibleNpcs(CONTENT, map(state.location.mapId), state).find((npc) => npc.id === npcId);

function tap(state: GameState, npcId: string): GameState {
  const npc = npcAt(state, npcId);
  if (!npc) throw new Error(`${npcId} is not here`);
  const opened = apply(CONTENT, state, { type: 'walkTo', pos: npc.pos }).state;
  expect(opened.screen).toBe('dialogue');
  return opened;
}

function play(state: GameState, picks: number[] = []): GameState {
  const queue = [...picks];
  for (let count = 0; state.screen === 'dialogue'; count++) {
    if (count > 40) throw new Error('Conversation never ended');
    const node = state.story.nodeId ? CONTENT.story.get(state.story.nodeId) : undefined;
    const pick = node?.kind === 'choice' ? queue.shift() : undefined;
    if (node?.kind === 'choice' && pick === undefined) throw new Error(`No pick for ${node.id}`);
    state =
      pick === undefined
        ? apply(CONTENT, state, { type: 'advanceDialogue' }).state
        : apply(CONTENT, state, { type: 'chooseOption', optionIndex: pick }).state;
  }
  expect(queue, 'unused picks').toEqual([]);
  expect(state.screen).toBe('explore');
  return state;
}

const LISTED = ['mira_intro', 'pella_tips', 'pella_asked', 'sq01_packing_list'];
/** The sled lies east of the roadblock: the party meets it once the road is open. */
const ON_THE_ROAD = [...LISTED, 'road_depart', 'after_forest'];

describe('SQ-01: Too Many Cabbages', () => {
  it('starts in Pella’s first conversation: pella_asked, then the packing list', () => {
    const state = play(tap(at(VILLAGE, 'village_explore', {}, ['mira_intro']), 'kid_pella'));
    expect(state.story.visited).toEqual(
      expect.arrayContaining(['pella_tips', 'sq01_packing_list']),
    );
    expect(state.flags.pella_asked).toBe(true);
    expect(npcNode(CONTENT, state, VILLAGE, 'kid_pella')).toBe('pella_again');
  });

  it('shows the sled only to a party carrying the list, and only until the rescue', () => {
    expect(
      npcAt(at(FOREST, 'forest_after_explore', {}, ['road_depart', 'after_forest']), 'sq01_sled'),
    ).toBeUndefined();
    expect(npcAt(at(FOREST, 'forest_after_explore', {}, ON_THE_ROAD), 'sq01_sled')).toBeDefined();
    const home = at(FOREST, 'forest_return_explore', { act1_complete: true }, ON_THE_ROAD);
    expect(npcAt(home, 'sq01_sled')).toBeUndefined();
  });

  OUTCOMES.forEach((outcome, pick) => {
    it(`${outcome}: any party can make the choice; it costs no XP and blocks nothing`, () => {
      // A solo non-bender, a full table of six: no option is gated.
      for (const party of [['riko'], ['kaya', 'sura', 'bo', 'nima', 'wen', 'lin_mei']]) {
        const before = at(
          FOREST,
          'forest_after_explore',
          { pella_asked: true },
          ON_THE_ROAD,
          party,
        );
        const done = play(tap(before, 'sq01_sled'), [pick]);
        expect(done.flags[SQ01_FLAG]).toBe(outcome);
        expect(done.story.nodeId).toBe('forest_after_explore');
        expect(done.party).toEqual(before.party);
        expect(done.world.cleared).toEqual(before.world.cleared);
        // The roadblock and the exits are exactly as they were.
        expect(npcNode(CONTENT, done, FOREST, 'sq01_sled')).toBe('sq01_sled_again');
        const again = play(tap(done, 'sq01_sled'));
        expect(again.flags).toEqual(done.flags);
        expect(again.story.nodeId).toBe('forest_after_explore');
      }
    });
  });

  it('remembers the hidden load on a revisit', () => {
    const node = CONTENT.story.get('sq01_sled_again');
    if (node?.kind !== 'dialogue') throw new Error('Missing sq01_sled_again');
    const lines = (outcome: string) =>
      resolveDialogue(at(FOREST, 'forest_after_explore', { [SQ01_FLAG]: outcome }), node).lines;
    expect(lines('leverage')).not.toEqual(lines('families'));
    expect(lines('crew')).toEqual(lines('families'));
  });

  describe('the payoff at home', () => {
    const home = (outcome?: string, visited: string[] = []) =>
      at(
        VILLAGE,
        'village_return_explore',
        { act1_complete: true, pella_asked: true, ...(outcome ? { [SQ01_FLAG]: outcome } : {}) },
        [...LISTED, 'mira_epilogue', ...visited],
      );

    it('keeps Pella’s homecoming first, then opens her corrected list', () => {
      for (const outcome of OUTCOMES) {
        let state = home(outcome);
        expect(npcNode(CONTENT, state, VILLAGE, 'kid_pella')).toBe('pella_home');
        state = play(tap(state, 'kid_pella'));
        expect(state.story.visited).toContain('pella_home');
        expect(npcNode(CONTENT, state, VILLAGE, 'kid_pella')).toBe('sq01_pella_list');
        state = play(tap(state, 'kid_pella'));
        expect(state.story.nodeId).toBe('village_return_explore');
      }
    });

    it('leaves a party that skipped the sled with the ordinary homecoming', () => {
      const state = play(tap(home(), 'kid_pella'));
      expect(npcNode(CONTENT, state, VILLAGE, 'kid_pella')).toBe('pella_home');
      const node = CONTENT.story.get('pella_home');
      if (node?.kind !== 'dialogue') throw new Error('Missing pella_home');
      expect(resolveDialogue(home(), node).lines).not.toEqual(
        resolveDialogue(home('families'), node).lines,
      );
    });

    it('writes each choice its own list, and the recap names the choice made', () => {
      const node = CONTENT.story.get('sq01_pella_list');
      if (node?.kind !== 'dialogue') throw new Error('Missing sq01_pella_list');
      const lists = OUTCOMES.map((o) => resolveDialogue(home(o), node).lines.join(' '));
      expect(new Set(lists).size).toBe(3);

      const end = CONTENT.story.get('demo_complete');
      if (end?.kind !== 'end' || !end.recap) throw new Error('Missing the recap');
      const recap = (state: GameState) =>
        end.recap?.choices.filter((c) => evaluate(state, c.when)).map((c) => c.text) ?? [];
      const sled = (state: GameState) => recap(state).filter((text) => text.includes('sled'));
      expect(sled(home())).toEqual([]);
      for (const outcome of OUTCOMES) expect(sled(home(outcome))).toHaveLength(1);
      expect(sled(home('families'))).toEqual(sled(home('crew')));
      expect(sled(home('leverage'))).not.toEqual(sled(home('families')));
    });
  });
});
