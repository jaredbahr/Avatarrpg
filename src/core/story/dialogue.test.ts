/**
 * Speaker-aware dialogue and gated choices.
 *
 * Avatar is a story about people who mistrust each other on sight and have to
 * work together anyway, so an NPC who reacts to *who walked up* is not flavour —
 * it is the theme, expressed as a mechanic. These tests cover the three pieces
 * that make it work: variants pick the line, `requires` gates the option, and
 * `chooseOption` refuses a locked one even if a tap somehow reaches it.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { createGame } from '../state/createGame';
import type { Condition, ContentIndex, GameState, StoryNode } from '../types';
import { getStanding } from './conditions';
import { chooseOption, npcNode, optionAvailable, resolveDialogue } from './storyEngine';

const HAS_FIRE: Condition = { kind: 'partyHas', element: 'fire' };
const HAS_WATER: Condition = { kind: 'partyHas', element: 'water' };

function game(characterIds: readonly string[]): GameState {
  return createGame(CONTENT, {
    seed: 'dialogue',
    party: characterIds.map((characterId) => ({ characterId })),
    startNode: 'act1_open',
  });
}

/** A content index with extra nodes spliced in, so tests own their fixtures. */
function withNodes(...nodes: StoryNode[]): ContentIndex {
  const story = new Map(CONTENT.story);
  for (const node of nodes) story.set(node.id, node);
  return { ...CONTENT, story };
}

const QUARTERMASTER: StoryNode = {
  id: 'test_quartermaster',
  kind: 'dialogue',
  speaker: 'The Quartermaster',
  portrait: 'portrait.narrator',
  lines: ['State your business.'],
  next: 'act1_open',
  variants: [
    {
      when: HAS_WATER,
      speaker: 'The Quartermaster',
      lines: ['Water Tribe. Of course it is. Say your piece and say it from there.'],
    },
    {
      when: HAS_FIRE,
      lines: ['You have the look of home about you. That buys you a sentence, no more.'],
    },
  ],
};

describe('dialogue variants', () => {
  it('falls back to the base lines when nothing matches', () => {
    // bo is an earthbender: neither variant applies.
    const said = resolveDialogue(game(['bo']), QUARTERMASTER);
    expect(said.lines).toEqual(['State your business.']);
    expect(said.speaker).toBe('The Quartermaster');
  });

  it('greets a waterbender differently from a firebender', () => {
    const toWater = resolveDialogue(game(['nilak']), QUARTERMASTER);
    const toFire = resolveDialogue(game(['kaya']), QUARTERMASTER);
    expect(toWater.lines[0]).toContain('Water Tribe');
    expect(toFire.lines[0]).toContain('look of home');
    expect(toWater.lines).not.toEqual(toFire.lines);
  });

  it('takes the first matching variant, not the best one', () => {
    // A party with both: the water variant is listed first and wins. Ordering is
    // the whole authoring contract — specific cases go above general ones.
    const said = resolveDialogue(game(['kaya', 'nilak']), QUARTERMASTER);
    expect(said.lines[0]).toContain('Water Tribe');
  });

  it('inherits speaker and portrait from the base node when a variant omits them', () => {
    const said = resolveDialogue(game(['kaya']), QUARTERMASTER);
    expect(said.speaker).toBe('The Quartermaster');
    expect(said.portrait).toBe('portrait.narrator');
  });
});

describe('gated choices', () => {
  const GATE: StoryNode = {
    id: 'test_gate',
    kind: 'choice',
    speaker: 'The Gate',
    portrait: 'portrait.narrator',
    prompt: 'The gate is shut.',
    options: [
      { label: 'Knock', detail: 'Politely.', next: 'act1_open' },
      {
        label: 'Bluff them',
        detail: 'Fire Nation colours still frighten people out here.',
        next: 'act1_open',
        requires: HAS_FIRE,
        speaker: { element: 'fire' },
        lockedHint: 'You would need a firebender to sell it.',
        adjust: { fire: 1, earth: -1 },
      },
    ],
  };

  it('offers a gated option only to a party that can take it', () => {
    const locked = GATE.kind === 'choice' ? GATE.options[1] : undefined;
    if (!locked) throw new Error('bad fixture');
    expect(optionAvailable(game(['kaya']), locked)).toBe(true);
    expect(optionAvailable(game(['bo']), locked)).toBe(false);
  });

  it('leaves an ungated option available to anyone', () => {
    const open = GATE.kind === 'choice' ? GATE.options[0] : undefined;
    if (!open) throw new Error('bad fixture');
    expect(optionAvailable(game(['bo']), open)).toBe(true);
  });

  it('refuses a locked option in the rules, not just in the UI', () => {
    /*
     * The UI draws locked options greyed out rather than hiding them, so a tap
     * can still arrive for one the party cannot take — via a stale render, a
     * keyboard, or a test harness. The disabled attribute is not the guard.
     */
    const content = withNodes(GATE);
    const state: GameState = {
      ...game(['bo']),
      story: { ...game(['bo']).story, nodeId: 'test_gate' },
    };

    const result = chooseOption(content, state, 1);
    expect(result.state.story.nodeId, 'it should not have moved on').toBe('test_gate');
    expect(result.events.some((e) => e.type === 'message')).toBe(true);
    const message = result.events.find((e) => e.type === 'message');
    if (message?.type === 'message') expect(message.text).toContain('firebender');
  });

  it('does not rotate the decider when a choice is refused', () => {
    const content = withNodes(GATE);
    const base = game(['bo']);
    const state: GameState = { ...base, story: { ...base.story, nodeId: 'test_gate' } };

    const result = chooseOption(content, state, 1);
    expect(result.state.story.deciderIndex).toBe(state.story.deciderIndex);
  });

  it('applies nation standing when an option is taken', () => {
    const content = withNodes(GATE);
    const base = game(['kaya']);
    const state: GameState = { ...base, story: { ...base.story, nodeId: 'test_gate' } };

    const result = chooseOption(content, state, 1);
    expect(getStanding(result.state.flags, 'fire')).toBe(1);
    expect(getStanding(result.state.flags, 'earth')).toBe(-1);
    expect(result.events.some((e) => e.type === 'standingChanged')).toBe(true);
  });
});

describe('npc routes', () => {
  it('walks the routes in order and falls back to the default node', () => {
    const base = game(['bo']);

    // Elder Mira's epilogue is gated on act1_complete.
    expect(npcNode(CONTENT, base, 'ba_dan_village', 'elder_mira')).toBe('mira_intro');

    const finished: GameState = { ...base, flags: { act1_complete: true } };
    expect(npcNode(CONTENT, finished, 'ba_dan_village', 'elder_mira')).toBe('mira_epilogue');
  });

  it('turns the shopkeeper cold once Ruon has been traded away', () => {
    const base = game(['bo']);
    expect(npcNode(CONTENT, base, 'ba_dan_village', 'shopkeeper_gao')).toBe('gao_friendly');

    const traded: GameState = { ...base, flags: { ruon_traded: true } };
    expect(npcNode(CONTENT, traded, 'ba_dan_village', 'shopkeeper_gao')).toBe('gao_cold');
  });

  it('returns null for an npc that is not there', () => {
    expect(npcNode(CONTENT, game(['bo']), 'ba_dan_village', 'nobody')).toBeNull();
  });
});

describe('act 1 content', () => {
  it('keeps the choice footer in the data rather than in the scene', () => {
    const node = CONTENT.story.get('ruon_choice');
    expect(node?.kind).toBe('choice');
    if (node?.kind !== 'choice') return;
    expect(node.footer?.trim()).toBeTruthy();
  });

  it('moves Earth Kingdom standing in opposite directions on the two roads', () => {
    const node = CONTENT.story.get('ruon_choice');
    if (node?.kind !== 'choice') throw new Error('ruon_choice is not a choice node');
    const [escort, trade] = node.options;
    expect(escort?.adjust?.earth ?? 0).toBeGreaterThan(0);
    expect(trade?.adjust?.earth ?? 0).toBeLessThan(0);
  });
});
