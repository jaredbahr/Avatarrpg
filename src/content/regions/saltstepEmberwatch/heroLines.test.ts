import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../index';
import { createGame } from '../../../core/state/createGame';
import { apply } from '../../../core/state/reducer';
import { resolveDialogue } from '../../../core/story/storyEngine';
import type { GameState } from '../../../core/types';

/**
 * Sura and Wen (Scene 2.4) and Riko (Scene 2.6) speak mid-chain, so each is a `branchWhen` on
 * who is in the party (ADR 0118). These hold the routes: each hero's lines play when that hero
 * is in the party, and the chain is unchanged without them.
 */

function game(party: readonly string[], flags: GameState['flags'] = {}, visited: string[] = []) {
  const initial = createGame(CONTENT, {
    seed: 'saltstep-heroes',
    party: party.map((characterId) => ({ characterId })),
    startNode: 'village_explore',
  });
  return {
    ...initial,
    flags: { ...initial.flags, ...flags },
    story: { ...initial.story, visited: [...initial.story.visited, ...visited] },
  };
}

/** The dialogue nodes shown from `start` until `stop`, in order. */
function walk(state: GameState, start: string, stop: string): string[] {
  let current = apply(CONTENT, state, { type: 'enterNode', nodeId: start }).state;
  const seen: string[] = [];
  for (let count = 0; count < 60 && current.screen === 'dialogue'; count++) {
    const id = current.story.nodeId;
    if (!id || id === stop) break;
    if (seen.at(-1) !== id) seen.push(id);
    current = apply(CONTENT, current, { type: 'advanceDialogue' }).state;
  }
  return seen;
}

describe('Saltstep hero lines', () => {
  it('Sura hears the echo under the boards after either driver', () => {
    for (const flags of [{}, { act1_lost: true }]) {
      const start = flags.act1_lost ? 'mq02_dorin_good_morning' : 'mq02_boshan_tipping';
      const shown = walk(game(['sura', 'kaya']), start, 'mq02_veyra_tea');
      expect(shown.slice(-4)).toEqual([
        'mq02_sura_under_boards',
        'mq02_veyra_hear_what',
        'mq02_sura_twice',
        'mq02_veyra_odd',
      ]);
      expect(walk(game(['kaya', 'bo']), start, 'mq02_veyra_tea')).not.toContain(
        'mq02_sura_under_boards',
      );
    }
  });

  it('Sura remembers the culvert only if the party saw it', () => {
    const node = CONTENT.story.get('mq02_sura_under_boards');
    if (node?.kind !== 'dialogue') throw new Error('mq02_sura_under_boards is not dialogue');
    const plain = resolveDialogue(game(['sura']), node).lines.join(' ');
    const saw = resolveDialogue(game(['sura'], {}, ['cutting_culvert']), node).lines.join(' ');
    expect(plain).not.toContain('Cutting');
    expect(saw).toContain('It did that in the Cutting. Under the road.');
  });

  it('Wen talks pumps with Veyra before the tea', () => {
    expect(walk(game(['wen']), 'mq02_veyra_odd', 'mq02_veyra_tea')).toEqual([
      'mq02_veyra_odd',
      'mq02_wen_long_throw',
      'mq02_veyra_short_person',
      'mq02_wen_napkins',
      'mq02_veyra_causeway',
    ]);
    expect(walk(game(['kaya']), 'mq02_veyra_odd', 'mq02_veyra_tea')).toEqual(['mq02_veyra_odd']);
  });

  it('Riko watches the handcart go', () => {
    expect(walk(game(['riko']), 'mq02_veyra_leaves', 'mq02_two_ways')).toEqual([
      'mq02_veyra_leaves',
      'mq02_riko_packet',
      'mq02_riko_watches',
    ]);
    expect(walk(game(['kaya']), 'mq02_veyra_leaves', 'mq02_two_ways')).toEqual([
      'mq02_veyra_leaves',
    ]);
  });
});
