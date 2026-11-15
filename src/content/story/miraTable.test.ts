/**
 * Mira's table and the reunion (canon DLG-01 and DLG-07; story bible C-13, C-14).
 *
 * The structure is what is held here: five people counted at the table, every
 * answer meeting again at Bo-shan's covered bowl, the names reachable for any
 * party, no absent hero voiced, and the reunion staged between Pella and
 * Bo-shan rather than told. The wording itself is the owner's to change.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../index';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import { resolveDialogue } from '../../core/story/storyEngine';
import type { GameState } from '../../core/types';
import { JOURNAL_NOTES } from '../journal';

function game(characterId: string): GameState {
  return createGame(CONTENT, {
    seed: 'mira-table',
    party: [{ characterId }],
    startNode: 'village_explore',
  });
}

/** Plays from `nodeId` to the next explore node, taking `option` at the choice. */
function play(state: GameState, nodeId: string, option: number) {
  let current = apply(CONTENT, state, { type: 'enterNode', nodeId }).state;
  const heard: { speaker: string; lines: readonly string[] }[] = [];
  const seen = new Set<string>();
  for (let step = 0; current.screen === 'dialogue' && step < 80; step++) {
    const node = CONTENT.story.get(current.story.nodeId ?? '');
    if (node?.kind === 'choice') {
      current = apply(CONTENT, current, { type: 'chooseOption', optionIndex: option }).state;
      continue;
    }
    if (node?.kind === 'dialogue' && !seen.has(node.id)) {
      seen.add(node.id);
      const resolved = resolveDialogue(current, node);
      heard.push({ speaker: resolved.speaker, lines: resolved.lines });
    }
    current = apply(CONTENT, current, { type: 'advanceDialogue' }).state;
  }
  return { state: current, heard, text: heard.flatMap((turn) => turn.lines).join(' ') };
}

describe("Mira's table (DLG-01)", () => {
  const ask = CONTENT.story.get('mira_table_ask');

  it('counts five, and every answer meets again at the covered bowl', () => {
    if (ask?.kind !== 'choice') throw new Error('mira_table_ask moved');
    expect(ask.options).toHaveLength(3);
    for (let option = 0; option < ask.options.length; option++) {
      const run = play(game('sura'), 'mira_intro', option);
      expect(run.state.screen).toBe('explore');
      expect(run.state.story.nodeId).toBe('village_explore');
      expect(run.heard.map((turn) => turn.lines.join(' '))).toContain('Five.');
      expect(run.text).toContain('Don’t take that bowl. That’s his.');
      expect(run.text).toContain('The covered one stays where Pella can see it.');
    }
  });

  it('names the four messengers when asked, with Pella supplying Bo-shan', () => {
    const run = play(game('sura'), 'mira_intro', 0);
    expect(run.text).toContain('Leto. Amri. Hesra. Senn.');
    const last = run.heard.findIndex((turn) => turn.lines.join(' ').includes('Leto'));
    expect(run.heard[last + 1]).toEqual({ speaker: 'Pella', lines: ['Bo-shan.'] });
  });

  it('keeps the names in the journal whichever question the table chose', () => {
    const note = JOURNAL_NOTES.find((entry) => entry.id === 'mira_table');
    expect(note?.when).toEqual({ kind: 'visited', nodeId: 'mira_intro' });
    for (const name of ['Leto', 'Amri', 'Hesra', 'Senn', 'Bo-shan'])
      expect(note?.found).toContain(name);
  });

  it('gives Kaya her line only when she is in the party, and never voices her otherwise', () => {
    const withKaya = play(game('kaya'), 'mira_intro', 2);
    expect(withKaya.heard).toContainEqual({ speaker: 'Kaya', lines: ['We can leave now.'] });
    const without = play(game('bo'), 'mira_intro', 2);
    expect(without.heard.map((turn) => turn.speaker)).not.toContain('Kaya');
    expect(without.heard).toContainEqual({ speaker: 'Pella', lines: ['Are you going now?'] });
  });

  it('stops Pella recounting the five once the table has settled it', () => {
    const tips = CONTENT.story.get('pella_tips');
    if (tips?.kind !== 'dialogue') throw new Error('pella_tips moved');
    const before = resolveDialogue(game('sura'), tips).lines.join(' ');
    const heard = play(game('sura'), 'mira_intro', 1).state;
    const after = resolveDialogue(heard, tips).lines.join(' ');
    expect(before).toContain('five missing');
    expect(after).not.toContain('five missing');
    // SQ-01's entry is untouched: the cart to look for is still on her list.
    expect(after).toContain('cabbages piled above the seat');
    expect(tips.next).toBe('pella_asked');
  });
});

describe('the reunion (DLG-07)', () => {
  it('is staged between Pella and Bo-shan, and ends on the bowl, not a tally', () => {
    const victory = { ...game('sura'), flags: { act1_complete: true, ruon_spared: true } };
    const run = play(victory, 'welcome_home_mira', 0);
    const turns = run.heard.map((turn) => `${turn.speaker}: ${turn.lines.join(' ')}`);
    const from = turns.findIndex((turn) => turn.startsWith('Mira’s Table: Pella comes down'));
    expect(from).toBeGreaterThan(0);
    expect(turns.slice(from + 1, from + 4)).toEqual([
      'Bo-shan: I’m all right.',
      'Pella: You’re shaking.',
      'Bo-shan: I know. Let me sit down a minute.',
    ]);
    expect(turns).toContain('Pella: You said Tuesday.');
    const kept = turns.indexOf('Pella: She kept making it. In case you came back hungry.');
    expect(kept).toBeGreaterThan(from);
    expect(turns[kept + 1]?.startsWith('Gao the Shopkeeper:')).toBe(true);
    // Mira no longer tells it for Pella.
    expect(turns[0]).not.toContain('Pella reached');
  });

  it('keeps Pella’s lost shoe and Hesra’s boot as two different stories', () => {
    const supper = CONTENT.story.get('welcome_home_supper');
    const pella = CONTENT.story.get('pella_home');
    if (supper?.kind !== 'dialogue' || pella?.kind !== 'dialogue') throw new Error('moved');
    expect(supper.lines.join(' ')).toContain('Hesra finds a boot');
    expect(supper.lines.join(' ')).not.toContain('shoe');
    expect(pella.lines.join(' ')).toContain('lost a shoe');
    expect(pella.lines.join(' ')).not.toContain('boot');
  });
});
