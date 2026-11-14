import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { createGame } from '../state/createGame';
import type { GameState } from '../types';
import { applyFlagBackfills, backfillValue } from './backfill';
import type { FlagBackfillRule } from './backfill';

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

const constant: FlagBackfillRule = {
  key: 'forest_note',
  setters: ['after_forest'],
  backfill: { value: 'read' },
};
const conditional: FlagBackfillRule = {
  key: 'ruon_traded',
  setters: ['ruon_choice'],
  backfill: { when: { kind: 'visited', nodeId: 'trade_chosen' } },
};

describe('flag backfills on load (#773)', () => {
  it('gives a save past the setter its declared answer', () => {
    const past = save(['after_forest']);
    expect(applyFlagBackfills(past, [constant]).flags.forest_note).toBe('read');
    expect(past.flags.forest_note).toBeUndefined();
  });

  it('answers a condition from what the save holds, and leaves the flag unset when it fails', () => {
    const traded = applyFlagBackfills(save(['ruon_choice', 'trade_chosen']), [conditional]);
    expect(traded.flags.ruon_traded).toBe(true);
    const escorted = save(['ruon_choice', 'escort_chosen'], { ruon_spared: true });
    expect(applyFlagBackfills(escorted, [conditional])).toBe(escorted);
  });

  it('leaves a save that has not reached the setter, or already holds the flag, alone', () => {
    const before = save(['village_explore']);
    expect(applyFlagBackfills(before, [constant])).toBe(before);
    const held = save(['after_forest'], { forest_note: 'skipped' });
    expect(applyFlagBackfills(held, [constant])).toBe(held);
  });

  it('settles: a second load changes nothing', () => {
    const once = applyFlagBackfills(save(['after_forest']), [constant, conditional]);
    expect(applyFlagBackfills(once, [constant, conditional])).toBe(once);
  });

  it('defaults a met condition to true and keeps a declared value', () => {
    const state = save(['trade_chosen']);
    expect(backfillValue(state, { when: { kind: 'visited', nodeId: 'trade_chosen' } })).toBe(true);
    expect(
      backfillValue(state, { when: { kind: 'visited', nodeId: 'trade_chosen' }, value: 2 }),
    ).toBe(2);
    expect(backfillValue(state, { value: false })).toBe(false);
  });
});
