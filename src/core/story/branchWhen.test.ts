/**
 * A `branchWhen` node (ADR 0117): the story takes `ifTrue` or `ifFalse` by a
 * full `Condition`, so a hero-specific line can sit in the middle of a chain.
 * The old `branch` node reads one flag and must keep doing exactly that.
 */

import { describe as suite, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import type { Condition, ContentIndex, GameState, StoryNode } from '../types';
import { createGame } from '../state/createGame';
import { enterStoryNode } from './storyEngine';

const dialogues = [...CONTENT.story.values()].filter((n) => n.kind === 'dialogue');
const YES = dialogues[0]?.id ?? '';
const NO = dialogues[1]?.id ?? '';

function withNodes(...nodes: StoryNode[]): ContentIndex {
  const story = new Map(CONTENT.story);
  for (const node of nodes) story.set(node.id, node);
  return { ...CONTENT, story };
}

function game(party: string[], flags: GameState['flags'] = {}): GameState {
  const state = createGame(CONTENT, {
    seed: 'branch-when',
    party: party.map((characterId) => ({ characterId })),
    startNode: 'village_explore',
  });
  return { ...state, flags: { ...state.flags, ...flags } };
}

/** Which of YES / NO a fresh walk from a gate node lands on. */
function road(when: Condition, state: GameState): string | undefined {
  const content = withNodes({ id: 'gate', kind: 'branchWhen', when, ifTrue: YES, ifFalse: NO });
  return enterStoryNode(content, state, 'gate').state.story.nodeId ?? undefined;
}

suite('a branchWhen node', () => {
  it('takes ifTrue when the condition holds', () => {
    expect(road({ kind: 'partyHas', characterId: 'kaya' }, game(['kaya', 'bo']))).toBe(YES);
  });

  it('takes ifFalse when it does not', () => {
    expect(road({ kind: 'partyHas', characterId: 'nilak' }, game(['kaya', 'bo']))).toBe(NO);
  });

  it('reads nested all / any / not conditions', () => {
    const when: Condition = {
      kind: 'all',
      of: [
        { kind: 'partyHas', characterId: 'kaya' },
        { kind: 'not', of: { kind: 'partyHas', characterId: 'nilak' } },
        {
          kind: 'any',
          of: [
            { kind: 'flag', key: 'met_wen', op: 'set' },
            { kind: 'partySize', op: 'gte', value: 9 },
          ],
        },
      ],
    };
    expect(road(when, game(['kaya', 'bo'], { met_wen: true }))).toBe(YES);
    expect(road(when, game(['kaya', 'bo']))).toBe(NO);
    expect(road(when, game(['kaya', 'nilak'], { met_wen: true }))).toBe(NO);
  });

  it('reads standing, which a flag branch cannot (0 is falsy)', () => {
    const when: Condition = { kind: 'standing', nation: 'fire', op: 'gte', value: 0 };
    expect(road(when, game(['kaya']))).toBe(YES);
    expect(road({ ...when, op: 'lte', value: -1 }, game(['kaya']))).toBe(NO);
  });

  it('records the node as visited and chains through further pass-through nodes', () => {
    const content = withNodes(
      {
        id: 'g1',
        kind: 'branchWhen',
        when: { kind: 'partyHas', characterId: 'kaya' },
        ifTrue: 'g2',
        ifFalse: NO,
      },
      {
        id: 'g2',
        kind: 'branchWhen',
        when: { kind: 'partyHas', characterId: 'bo' },
        ifTrue: YES,
        ifFalse: NO,
      },
    );
    const state = enterStoryNode(content, game(['kaya', 'bo']), 'g1').state;
    expect(state.story.nodeId).toBe(YES);
    expect(state.story.visited).toEqual(expect.arrayContaining(['g1', 'g2']));
  });

  it('leaves an old flag branch reading one flag by truthiness', () => {
    const content = withNodes({ id: 'old', kind: 'branch', flag: 'seen', ifSet: YES, ifUnset: NO });
    expect(enterStoryNode(content, game(['kaya'], { seen: true }), 'old').state.story.nodeId).toBe(
      YES,
    );
    expect(enterStoryNode(content, game(['kaya']), 'old').state.story.nodeId).toBe(NO);
  });
});
