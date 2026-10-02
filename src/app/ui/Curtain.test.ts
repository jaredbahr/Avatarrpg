import { describe, expect, it } from 'vitest';
import { FIRST_FRAME_SHEET_WAIT_MS, curtainSheetDecision } from './Curtain';
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

  it('holds while any visible sheet is loading or failed before the bound', () => {
    expect(curtainSheetDecision(states(['unit.kaya', 'loading']), 0)).toBe('hold');
    expect(
      curtainSheetDecision(states(['unit.kaya', 'failed']), FIRST_FRAME_SHEET_WAIT_MS - 1),
    ).toBe('hold');
  });

  it('lifts at the bound even when a visible sheet never became resident', () => {
    expect(curtainSheetDecision(states(['unit.kaya', 'loading']), FIRST_FRAME_SHEET_WAIT_MS)).toBe(
      'lift',
    );
  });
});
