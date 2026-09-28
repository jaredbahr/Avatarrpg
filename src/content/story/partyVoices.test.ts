import { describe, expect, it } from 'vitest';
import { CHARACTERS, CONTENT } from '../index';
import { createGame } from '../../core/state/createGame';
import { resolveDialogue } from '../../core/story/storyEngine';
import type { GameState } from '../../core/types';
import { VOICES } from './partyVoices';

const MOMENTS = [
  ['kaya', 'after_forest'],
  ['tenzo', 'cutting_tea'],
  ['nilak', 'riverside_mira'],
  ['sura', 'discover_runoff_marker'],
  ['bo', 'gate_kinship'],
  ['lin_mei', 'forest_dema'],
  ['nima', 'discover_duck_nest'],
  ['jinu', 'dorin_directions'],
  ['riko', 'escort_chosen'],
  ['wen', 'quarry_assessment'],
] as const;

/**
 * Every voiced node beyond a hero's single moment, derived from VOICES so a new voice is
 * tested without being listed twice. Heroes stay in priority order.
 */
const ROAD_VOICES = [
  ...VOICES.reduce((nodes, voice) => {
    nodes.set(voice.node, [...(nodes.get(voice.node) ?? []), voice.character]);
    return nodes;
  }, new Map<string, string[]>()),
].filter(([node, ids]) => ids.length > 1 || !MOMENTS.some(([, moment]) => moment === node));

function game(ids: readonly string[]): GameState {
  return createGame(CONTENT, {
    seed: 'party-contributions',
    party: ids.map((characterId) => ({ characterId })),
    startNode: 'village_explore',
  });
}

function said(state: GameState, id: string) {
  const node = CONTENT.story.get(id);
  if (node?.kind !== 'dialogue') throw new Error(`Missing dialogue: ${id}`);
  return resolveDialogue(state, node);
}

describe('party contributions in the quarry run', () => {
  it('covers the playable roster in separate scenes', () => {
    expect(MOMENTS.map(([id]) => id).sort()).toEqual(CHARACTERS.map((c) => c.id).sort());
    expect(new Set(MOMENTS.map(([, node]) => node)).size).toBe(CHARACTERS.length);
  });

  it.each(MOMENTS)('%s contributes at %s only when present and conscious', (id, node) => {
    const character = CONTENT.characters.get(id);
    if (!character) throw new Error(id);
    const present = game([id]);
    expect(said(present, node)).toMatchObject({
      speaker: character.name,
      portrait: character.portrait,
    });
    const absent = game([id === 'kaya' ? 'bo' : 'kaya']);
    const unconscious = {
      ...present,
      party: present.party.map((unit) => ({ ...unit, hp: 0 })),
    };
    for (const state of [absent, unconscious]) {
      const fallback = said(state, node);
      expect(fallback.speaker).not.toBe(character.name);
      expect(fallback.portrait).not.toBe(character.portrait);
      expect(fallback.lines.length).toBeGreaterThan(0);
    }
  });

  it('lets both members of each same-element pair contribute', () => {
    for (const element of ['fire', 'water', 'earth', 'air', 'nonbender']) {
      const pair = CHARACTERS.filter((character) => character.element === element);
      const state = game(pair.map((character) => character.id));
      for (const character of pair) {
        const moment = MOMENTS.find(([id]) => id === character.id);
        if (!moment) throw new Error(character.id);
        expect(said(state, moment[1]).speaker).toBe(character.name);
      }
    }
  });

  it('does not repeat outbound offers after the rescue', () => {
    for (const [id, node] of MOMENTS) {
      // Kaya's existing post-battle node is one-shot and has separate win/loss readings.
      if (id === 'kaya') continue;
      const state = game([id]);
      const complete = { ...state, flags: { ...state.flags, act1_complete: true } };
      expect(said(complete, node).speaker).not.toBe(CONTENT.characters.get(id)?.name);
    }
  });
});

describe('party voices along the road and the quarry floor', () => {
  const name = (id: string) => CONTENT.characters.get(id)?.name;

  it('voices only nodes that exist in the story', () => {
    const missing = VOICES.map((voice) => voice.node).filter((node) => !CONTENT.story.has(node));
    expect(missing).toEqual([]);
  });

  it('finds road voices in the authored list', () => {
    expect(ROAD_VOICES.length).toBeGreaterThan(0);
  });

  it.each(ROAD_VOICES)('%s speaks for each listed hero on their own', (node, ids) => {
    for (const id of ids) {
      expect(said(game([id]), node).speaker).toBe(name(id));
      const present = game([id]);
      const unconscious = {
        ...present,
        party: present.party.map((unit) => ({ ...unit, hp: 0 })),
      };
      expect(said(unconscious, node).speaker).not.toBe(name(id));
      const complete = { ...present, flags: { ...present.flags, act1_complete: true } };
      expect(said(complete, node).speaker).not.toBe(name(id));
    }
  });

  it.each(ROAD_VOICES)('%s gives the first listed hero priority', (node, ids) => {
    const [first, ...rest] = ids;
    if (!first) throw new Error(node);
    expect(said(game([...rest, first]), node).speaker).toBe(name(first));
  });

  it.each(ROAD_VOICES)('%s falls back when no listed hero is present', (node, ids) => {
    const outsider = CHARACTERS.find((character) => !ids.some((id) => id === character.id));
    if (!outsider) throw new Error(node);
    const fallback = said(game([outsider.id]), node);
    for (const id of ids) expect(fallback.speaker).not.toBe(name(id));
    expect(fallback.lines.length).toBeGreaterThan(0);
  });
});
