import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { createGame } from '../state/createGame';
import type { GameState } from '../types';
import { applyBackfills, historyRevOf } from './backfill';
import type { BackfillRule } from './backfill';

function save(visited: readonly string[], flags: GameState['flags'] = {}): GameState {
  const base = createGame(CONTENT, {
    seed: 'backfill-773',
    party: [{ characterId: 'kaya' }],
    startNode: 'village_explore',
  });
  return {
    ...base,
    flags: { ...base.flags, ...flags },
    story: { ...base.story, visited: [...visited] },
  };
}

const note: BackfillRule = {
  rev: 1,
  key: 'forest_note',
  when: { kind: 'visited', nodeId: 'after_forest' },
  set: 'read',
};
const traded: BackfillRule = {
  rev: 2,
  key: 'ruon_traded',
  when: { kind: 'visited', nodeId: 'trade_chosen' },
  set: true,
};
const RULES = [note, traded];

describe('backfill rules on load (ADR 0112)', () => {
  it('gives a file older than the rule its declared answer', () => {
    const past = save(['after_forest']);
    expect(applyBackfills(past, 0, RULES).flags.forest_note).toBe('read');
    expect(past.flags.forest_note).toBeUndefined();
  });

  it('answers from what the save holds, and leaves the flag unset when it shows nothing', () => {
    expect(applyBackfills(save(['ruon_choice', 'trade_chosen']), 0, RULES).flags.ruon_traded).toBe(
      true,
    );
    const escorted = save(['ruon_choice', 'escort_chosen'], { ruon_spared: true });
    expect(applyBackfills(escorted, 0, RULES)).toBe(escorted);
  });

  it('leaves a save that has not reached the scene, or already holds a value, alone', () => {
    const before = save(['village_explore']);
    expect(applyBackfills(before, 0, RULES)).toBe(before);
    const held = save(['after_forest'], { forest_note: 'skipped' });
    expect(applyBackfills(held, 0, RULES)).toBe(held);
  });

  it("never reaches a file written at or after the rule's revision", () => {
    // Played on content that sets the flag itself, and it is unset: the player did not do it.
    const current = save(['after_forest', 'trade_chosen']);
    expect(applyBackfills(current, 2, RULES)).toBe(current);
    // A file between the two rules gets only the newer one.
    const between = applyBackfills(current, 1, RULES);
    expect(between.flags).toEqual({ ...current.flags, ruon_traded: true });
  });

  it('applies rules in revision order, so a later rule can read an earlier answer', () => {
    const chained: BackfillRule = {
      rev: 3,
      key: 'forest_note_kept',
      when: { kind: 'flag', key: 'forest_note', op: 'eq', value: 'read' },
      set: true,
    };
    const loaded = applyBackfills(save(['after_forest']), 0, [chained, note]);
    expect(loaded.flags.forest_note_kept).toBe(true);
  });

  it('moves standing by a delta, clamped, exactly once', () => {
    const thanked: BackfillRule = {
      rev: 1,
      key: 'standing.earth',
      when: { kind: 'visited', nodeId: 'after_forest' },
      adjust: 2,
    };
    const once = applyBackfills(save(['after_forest'], { 'standing.earth': 4 }), 0, [thanked]);
    expect(once.flags['standing.earth']).toBe(5);
    // Saved by this build, the file records revision 1, and the delta is not added again.
    expect(applyBackfills(once, historyRevOf([thanked]), [thanked])).toBe(once);
    // Unset standing is neutral, so the delta lands on 0.
    expect(applyBackfills(save(['after_forest']), 0, [thanked]).flags['standing.earth']).toBe(2);
  });

  it('counts a scene as visited', () => {
    const list: BackfillRule = {
      rev: 1,
      node: 'sq01_packing_list',
      when: { kind: 'flag', key: 'pella_asked', op: 'set' },
    };
    const asked = applyBackfills(save(['pella_ask'], { pella_asked: true }), 0, [list]);
    expect(asked.story.visited).toEqual(['pella_ask', 'sq01_packing_list']);
    expect(applyBackfills(asked, 0, [list])).toBe(asked);
    const stranger = save(['village_explore']);
    expect(applyBackfills(stranger, 0, [list])).toBe(stranger);
  });

  it('reports the highest revision, 0 with no rules', () => {
    expect(historyRevOf([])).toBe(0);
    expect(historyRevOf([traded, note])).toBe(2);
  });
});
