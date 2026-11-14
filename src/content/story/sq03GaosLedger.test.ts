/**
 * SQ-03, Gao's Other Ledger: the parcels after Gao's first word, the drawer, the three choices,
 * and the jar once the workers are home, with the Ruon-trade variant. Played through the reducer
 * by walking up and tapping, as a player would.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../index';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import { evaluate } from '../../core/story/conditions';
import { npcNode, resolveDialogue } from '../../core/story/storyEngine';
import { visibleNpcs } from '../../core/story/world';
import type { FlagValue, GameState, MapDef } from '../../core/types';
import { SQ03_FLAG } from './sq03GaosLedger';

const VILLAGE = 'ba_dan_village';
const OUTCOMES = ['extension', 'fund', 'praised'] as const;

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
    seed: 'sq03',
    party: party.map((characterId) => ({ characterId })),
    startNode: hub,
  });
  return {
    ...base,
    screen: 'explore',
    flags: { ...base.flags, ...flags },
    story: { ...base.story, nodeId: hub, visited },
    location: { mapId, pos: map(mapId).partySpawns[0] ?? { x: 0, y: 0 } },
    // Morning: Gao serves at his shopfront, and the afternoon plant scene is not in the way.
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

const gao = (state: GameState) => npcNode(CONTENT, state, VILLAGE, 'shopkeeper_gao');
const road = (flags: Record<string, FlagValue> = {}, visited: string[] = [], party?: string[]) =>
  at(VILLAGE, 'village_explore', flags, ['mira_intro', ...visited], party);
const home = (flags: Record<string, FlagValue> = {}, visited: string[] = []) =>
  at(VILLAGE, 'village_return_explore', { act1_complete: true, ...flags }, [
    'mira_intro',
    ...visited,
  ]);

describe('SQ-03: Gao’s Other Ledger', () => {
  it('waits for Gao’s first word and, after the trade, his objection; before the rescue only', () => {
    expect(gao(road())).toBe('gao_friendly');
    expect(gao(road({}, ['gao_friendly']))).toBe('sq03_hook');
    expect(gao(road({ ruon_traded: true }, ['gao_friendly']))).toBe('gao_cold');
    expect(gao(road({ ruon_traded: true }, ['gao_friendly', 'gao_cold']))).toBe('sq03_hook');
    expect(gao(home({}, ['gao_friendly']))).toBe('gao_home');
    expect(gao(home({}, ['gao_friendly', 'gao_home']))).toBe('gao_home');
    expect(gao(home({ ruon_traded: true }, ['gao_friendly', 'gao_home_cold']))).toBe(
      'gao_home_cold',
    );
  });

  it('can be put off: Gao says his usual piece and asks again next time', () => {
    const before = road({}, ['gao_friendly']);
    const later = play(tap(before, 'shopkeeper_gao'), [1]);
    expect(later.story.visited).toContain('gao_friendly');
    expect(later.flags).toEqual(before.flags);
    expect(gao(later)).toBe('sq03_hook');
  });

  OUTCOMES.forEach((outcome, pick) => {
    it(`${outcome}: any party can choose it; it costs no XP and blocks nothing`, () => {
      for (const party of [['nilak'], ['kaya', 'sura', 'bo', 'nima', 'riko', 'wen']]) {
        const before = road({}, ['gao_friendly'], party);
        const done = play(tap(before, 'shopkeeper_gao'), [0, pick]);
        expect(done.flags[SQ03_FLAG]).toBe(outcome);
        expect(done.story.nodeId).toBe('village_explore');
        expect(done.party).toEqual(before.party);
        expect(done.world.cleared).toEqual(before.world.cleared);
        // Before the rescue Gao goes back to his ordinary lines.
        expect(gao(done)).toBe('gao_friendly');
      }
    });
  });

  describe('the jar, once the workers are home', () => {
    it('keeps the homecoming first, then shows the jar once', () => {
      for (const outcome of OUTCOMES) {
        let state = home({ [SQ03_FLAG]: outcome }, ['gao_friendly']);
        expect(gao(state)).toBe('gao_home');
        state = play(tap(state, 'shopkeeper_gao'));
        expect(gao(state)).toBe('sq03_jar');
        state = play(tap(state, 'shopkeeper_gao'));
        expect(gao(state)).toBe('gao_home');
      }
    });

    it('labels the jar every time, and keeps Gao’s view of the trade', () => {
      const jar = CONTENT.story.get('sq03_jar');
      const label = CONTENT.story.get('sq03_jar_label');
      if (jar?.kind !== 'dialogue' || label?.kind !== 'dialogue') throw new Error('Missing nodes');
      for (const outcome of OUTCOMES) {
        const lines = resolveDialogue(home({ [SQ03_FLAG]: outcome }), label).lines.join(' ');
        expect(lines).toContain('For whoever needs it; no speeches.');
      }
      const said = (flags: Record<string, FlagValue>) =>
        resolveDialogue(home(flags), jar).lines.join(' ');
      expect(new Set(OUTCOMES.map((o) => said({ [SQ03_FLAG]: o }))).size).toBe(3);
      for (const outcome of OUTCOMES) {
        expect(said({ [SQ03_FLAG]: outcome, ruon_traded: true })).toContain('Ruon');
        expect(said({ [SQ03_FLAG]: outcome })).not.toContain('Ruon');
      }
    });

    it('names the choice made on the end card', () => {
      const end = CONTENT.story.get('demo_complete');
      if (end?.kind !== 'end' || !end.recap) throw new Error('Missing the recap');
      const recap = (state: GameState) =>
        end.recap?.choices.filter((c) => evaluate(state, c.when)).map((c) => c.text) ?? [];
      const base = recap(home());
      const added = (outcome: string) =>
        recap(home({ [SQ03_FLAG]: outcome })).filter((text) => !base.includes(text));
      expect(new Set(OUTCOMES.map((o) => added(o).join()))).toHaveProperty('size', 3);
      for (const outcome of OUTCOMES) expect(added(outcome)).toHaveLength(1);
    });
  });
});
