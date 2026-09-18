import { describe, expect, it } from 'vitest';
import { CHARACTERS, CONTENT } from '../index';
import { createGame } from '../../core/state/createGame';
import { resolveDialogue } from '../../core/story/storyEngine';
import type { GameState } from '../../core/types';

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
