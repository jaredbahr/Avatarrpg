import { describe, expect, it } from 'vitest';
import { FIRST_FRAME_SHEET_WAIT_MS, curtainSheetDecision, curtainToneFor } from './Curtain';
import type { SheetLoadState } from '../../render/sheets/store';

const states = (...entries: readonly (readonly [string, SheetLoadState])[]) => new Map(entries);

describe('the first-frame sheet curtain decision', () => {
  it('lifts immediately when the scene has no sprite sheets', () => {
    expect(curtainSheetDecision(states(), 0)).toBe('lift');
  });

  it('lifts immediately when every visible sheet is already resident', () => {
    expect(curtainSheetDecision(states(['unit.kaya', 'ready'], ['npc.mira', 'ready']), 0)).toBe(
      'lift',
    );
  });

  it('holds while any visible sheet is still loading, before the bound', () => {
    expect(curtainSheetDecision(states(['unit.kaya', 'loading']), 0)).toBe('hold');
    expect(
      curtainSheetDecision(
        states(['unit.kaya', 'ready'], ['unit.bo', 'loading']),
        FIRST_FRAME_SHEET_WAIT_MS - 1,
      ),
    ).toBe('hold');
  });

  it('does not wait for a sheet that has already failed', () => {
    // Failed is permanent for the session: waiting would ink every later scene for the full bound.
    expect(curtainSheetDecision(states(['unit.kaya', 'failed']), 0)).toBe('lift');
    expect(curtainSheetDecision(states(['unit.kaya', 'failed'], ['unit.bo', 'ready']), 0)).toBe(
      'lift',
    );
    expect(curtainSheetDecision(states(['unit.kaya', 'failed'], ['unit.bo', 'loading']), 0)).toBe(
      'hold',
    );
  });

  it('lifts at the bound even when a visible sheet never became resident', () => {
    expect(curtainSheetDecision(states(['unit.kaya', 'loading']), FIRST_FRAME_SHEET_WAIT_MS)).toBe(
      'lift',
    );
  });
});

describe('scene curtain table', () => {
  it.each([
    ['title', 'setup', 'ink'],
    ['setup', 'interlude', 'ink'],
    ['interlude', 'explore', 'ink'],
    ['dialogue', 'combat', 'ink'],
  ] as const)('%s to %s uses %s', (from, to, tone) => {
    expect(curtainToneFor(from, to)).toBe(tone);
  });

  it('uses ink for setup and omits unowned transitions', () => {
    expect(curtainToneFor('setup', 'setup')).toBe('ink');
    expect(curtainToneFor(null, 'title')).toBe('none');
  });
});
