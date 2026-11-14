import { describe, expect, it } from 'vitest';
import { CONTENT } from '../index';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import { resolveDialogue } from '../../core/story/storyEngine';
import { evaluate } from '../../core/story/conditions';
import type { GameState, StoryNode } from '../../core/types';
import { GATE_TALK_EARNED } from './act1';

/**
 * The quarry gate's talk route is earned, never inherited (story bible C-07,
 * C-08). Bo and Lin Mei bring their own work; any other party, non-benders
 * included, earns it on the Forest Road. A bender's element alone opens nothing.
 */
function atGate(party: readonly string[], flags: GameState['flags'] = {}): GameState {
  const initial = createGame(CONTENT, {
    seed: 'gate-talk',
    party: party.map((characterId) => ({ characterId })),
    startNode: 'gate_parley',
  });
  return { ...initial, flags: { ...initial.flags, ...flags } };
}

const ROAD = {
  lanfen: { 'world.ducks_seen': true },
  marker: { 'world.discovered.runoff_marker': true },
} as const;

function dialogue(id: string): Extract<StoryNode, { kind: 'dialogue' }> {
  const node = CONTENT.story.get(id);
  if (node?.kind !== 'dialogue') throw new Error(`Missing dialogue ${id}`);
  return node;
}

describe('the quarry gate talk', () => {
  it('is the third option at the parley and is gated on what the party knows', () => {
    const parley = CONTENT.story.get('gate_parley');
    if (parley?.kind !== 'choice') throw new Error('Missing the parley');
    expect(parley.options[2]?.requires).toEqual(GATE_TALK_EARNED);
    expect(parley.options[2]?.speaker).toBeUndefined();
  });

  it('stays shut to an element on its own', () => {
    for (const party of [['riko'], ['wen', 'riko'], ['kaya', 'tenzo'], ['nilak', 'sura', 'nima']])
      expect(evaluate(atGate(party), GATE_TALK_EARNED), party.join('+')).toBe(false);
  });

  it('opens for Bo and Lin Mei on their own work, and for any party the road taught', () => {
    expect(evaluate(atGate(['bo']), GATE_TALK_EARNED)).toBe(true);
    expect(evaluate(atGate(['lin_mei']), GATE_TALK_EARNED)).toBe(true);
    for (const flags of Object.values(ROAD)) {
      expect(evaluate(atGate(['riko'], flags), GATE_TALK_EARNED)).toBe(true);
      expect(evaluate(atGate(['kaya', 'tenzo'], flags), GATE_TALK_EARNED)).toBe(true);
    }
  });

  it('lets a lone non-bender talk the gate open and reach the same surrender', () => {
    let state = atGate(['wen'], ROAD.lanfen);
    expect(state.story.nodeId).toBe('gate_parley');
    state = apply(CONTENT, state, { type: 'chooseOption', optionIndex: 2 }).state;
    expect(state.story.nodeId).toBe('gate_kinship');
    for (let guard = 0; guard < 20 && state.story.nodeId !== 'ruon_surrender'; guard++)
      state = apply(CONTENT, state, { type: 'advanceDialogue' }).state;
    expect(state.story.nodeId).toBe('ruon_surrender');
    expect(state.flags.gate_talked_through).toBe(true);
    expect(state.flags.ruon_respects_you).toBe(true);
    expect(state.flags.gate_fire_bluff).toBeUndefined();
  });

  it('has Ruon answer the case that was actually made', () => {
    const cases: readonly [readonly string[], GameState['flags'], string, string][] = [
      [['bo'], {}, 'Bo', 'A week of wages'],
      [['lin_mei'], {}, 'Lin Mei', 'I was told'],
      [['riko'], ROAD.marker, 'The Quarry Gate', 'Blocked since the driller'],
      [['riko'], ROAD.lanfen, 'The Quarry Gate', 'The road keeper'],
    ];
    for (const [party, flags, caseSpeaker, reply] of cases) {
      const state = atGate(party, flags);
      expect(resolveDialogue(state, dialogue('gate_kinship')).speaker).toBe(caseSpeaker);
      const answer = resolveDialogue(state, dialogue('gate_ruon_listens'));
      expect(answer.speaker).toBe('Captain Ruon');
      expect(answer.lines[0]).toContain(reply);
    }
  });

  it('gives the bluff to a firebender who is present', () => {
    const words = dialogue('gate_bluff_words');
    expect(resolveDialogue(atGate(['tenzo']), words).speaker).toBe('Tenzo');
    expect(resolveDialogue(atGate(['kaya']), words).speaker).toBe('Kaya');
    expect(resolveDialogue(atGate(['kaya', 'tenzo']), words).speaker).toBe('Tenzo');
  });
});
