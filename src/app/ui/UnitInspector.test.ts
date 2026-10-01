import { describe, expect, it } from 'vitest';
import type { Unit } from '../../core/types';
import { unitInspectorSyncDecision } from './UnitInspector';

const unit = { id: 'unit-1', hp: 4 } as Unit;

describe('unit inspector sync decision', () => {
  it('does not rebuild for the same unit reference', () => {
    expect(unitInspectorSyncDecision(unit, unit)).toBe('unchanged');
  });

  it('refreshes replacement state, including a fallen unit', () => {
    expect(unitInspectorSyncDecision(unit, { ...unit, hp: 0 })).toBe('refresh');
  });

  it('closes only when the unit no longer exists in the battle', () => {
    expect(unitInspectorSyncDecision(unit, undefined)).toBe('close');
  });
});
