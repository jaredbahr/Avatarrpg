/**
 * SQ-02, A Very Official Gate: Dorin's hook after his directions, the register and the hen, the
 * three choices, and his story once the workers are home. Played through the reducer by walking
 * up and tapping, as a player would.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../index';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import { evaluate } from '../../core/story/conditions';
import { npcNode, resolveDialogue } from '../../core/story/storyEngine';
import { visibleNpcs } from '../../core/story/world';
import type { FlagValue, GameState, MapDef } from '../../core/types';
import { SQ02_FLAG } from './sq02OfficialGate';

const VILLAGE = 'ba_dan_village';
const OUTCOMES = ['quiet', 'public', 'mocked'] as const;

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
    seed: 'sq02',
    party: party.map((characterId) => ({ characterId })),
    startNode: hub,
  });
  return {
    ...base,
    screen: 'explore',
    flags: { ...base.flags, ...flags },
    story: { ...base.story, nodeId: hub, visited },
    location: { mapId, pos: map(mapId).partySpawns[0] ?? { x: 0, y: 0 } },
    // Morning: Dorin is on his post (at midday he drills by the river).
    world: { ...base.world, clock: { day: 1, phase: 'morning' } },
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

const PHASES = ['dawn', 'morning', 'midday', 'afternoon'] as const;
const DIRECTED = ['mira_intro', 'dorin_directions'];
const dorin = (state: GameState) => npcNode(CONTENT, state, VILLAGE, 'guard_dorin');
const inPhase = (state: GameState, phase: (typeof PHASES)[number]): GameState => ({
  ...state,
  world: { ...state.world, clock: { day: 1, phase } },
});

describe('SQ-02: A Very Official Gate', () => {
  it('waits for Dorin’s directions, then offers the gate in every daylight phase', () => {
    expect(dorin(at(VILLAGE, 'village_explore', {}, ['mira_intro']))).toBe('dorin_directions');
    for (const phase of PHASES)
      expect(dorin(inPhase(at(VILLAGE, 'village_explore', {}, DIRECTED), phase))).toBe('sq02_hook');
  });

  it('can be put off, and the directions are still there', () => {
    const before = at(VILLAGE, 'village_explore', {}, DIRECTED);
    const later = play(tap(before, 'guard_dorin'), [1]);
    expect(later.story.visited).toContain('dorin_directions');
    expect(later.flags).toEqual(before.flags);
    expect(dorin(later)).toBe('sq02_hook');
  });

  OUTCOMES.forEach((outcome, pick) => {
    it(`${outcome}: any party can choose it; it costs no XP and blocks nothing`, () => {
      for (const party of [['wen'], ['kaya', 'sura', 'bo', 'nima', 'riko', 'tenzo']]) {
        const before = at(VILLAGE, 'village_explore', {}, DIRECTED, party);
        const done = play(tap(before, 'guard_dorin'), [0, pick]);
        expect(done.flags[SQ02_FLAG]).toBe(outcome);
        expect(done.story.nodeId).toBe('village_explore');
        expect(done.party).toEqual(before.party);
        expect(done.world.cleared).toEqual(before.world.cleared);
        expect(dorin(done)).toBe('sq02_after');
        const again = play(tap(done, 'guard_dorin'));
        expect(again.flags).toEqual(done.flags);
      }
    });
  });

  it('is not offered after the rescue to a table that skipped it', () => {
    const home = at(VILLAGE, 'village_return_explore', { act1_complete: true }, DIRECTED);
    expect(dorin(home)).toBe('dorin_home');
    const heard = play(tap(home, 'guard_dorin'));
    expect(dorin(heard)).toBe('dorin_home');
  });

  describe('once the workers are home', () => {
    const home = (flags: Record<string, FlagValue>, party = ['bo']) =>
      at(VILLAGE, 'village_return_explore', { act1_complete: true, ...flags }, DIRECTED, party);

    it('keeps the homecoming first, tells the gate story once, then the homecoming again', () => {
      for (const outcome of OUTCOMES) {
        let state = home({ [SQ02_FLAG]: outcome });
        expect(dorin(state)).toBe('dorin_home');
        state = play(tap(state, 'guard_dorin'));
        expect(dorin(state)).toBe('sq02_return');
        state = play(tap(state, 'guard_dorin'));
        expect(state.story.nodeId).toBe('village_return_explore');
        expect(dorin(state)).toBe('dorin_home');
      }
    });

    it('pays off the river drill, keeps the mocked Dorin guarded, and grins only with Kaya', () => {
      const told = CONTENT.story.get('sq02_return');
      const gate = CONTENT.story.get('sq02_return_gate');
      if (told?.kind !== 'dialogue' || gate?.kind !== 'dialogue') throw new Error('Missing nodes');
      const said = (state: GameState) => resolveDialogue(state, told).lines.join(' ');
      const seen = (state: GameState) => resolveDialogue(state, gate).lines.join(' ');
      const both = 'I checked both sides of the gate this time.';
      expect(said(home({ [SQ02_FLAG]: 'quiet' }))).toContain(both);
      expect(said(home({ [SQ02_FLAG]: 'public' }))).toContain(both);
      expect(said(home({ [SQ02_FLAG]: 'mocked' }))).not.toContain(both);
      expect(said(home({ [SQ02_FLAG]: 'quiet', riverside_drill: true }))).not.toEqual(
        said(home({ [SQ02_FLAG]: 'quiet' })),
      );
      expect(said(home({ [SQ02_FLAG]: 'mocked', riverside_drill: true }))).toEqual(
        said(home({ [SQ02_FLAG]: 'mocked' })),
      );
      expect(seen(home({ [SQ02_FLAG]: 'quiet' }, ['bo']))).not.toContain('Kaya');
      expect(seen(home({ [SQ02_FLAG]: 'quiet' }, ['kaya']))).toContain('Kaya');
      expect(seen(home({ [SQ02_FLAG]: 'mocked' }, ['kaya']))).not.toContain('Kaya');
    });

    it('names the choice made on the end card', () => {
      const end = CONTENT.story.get('demo_complete');
      if (end?.kind !== 'end' || !end.recap) throw new Error('Missing the recap');
      const gate = (state: GameState) =>
        end.recap?.choices
          .filter((c) => evaluate(state, c.when))
          .map((c) => c.text)
          .filter((text) => text.includes('side gate')) ?? [];
      expect(gate(home({}))).toEqual([]);
      for (const outcome of OUTCOMES) expect(gate(home({ [SQ02_FLAG]: outcome }))).toHaveLength(1);
      expect(gate(home({ [SQ02_FLAG]: 'quiet' }))).toEqual(gate(home({ [SQ02_FLAG]: 'public' })));
      expect(gate(home({ [SQ02_FLAG]: 'mocked' }))).not.toEqual(
        gate(home({ [SQ02_FLAG]: 'quiet' })),
      );
    });
  });
});
