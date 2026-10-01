import { describe, expect, it } from 'vitest';
import type { PropInstance } from '../../core/types';
import { propInspectorSyncDecision } from './PropInspector';

const prop = { id: 'prop-1' } as PropInstance;

describe('prop inspector sync decision', () => {
  it('does not rebuild for the same prop reference', () => {
    expect(propInspectorSyncDecision(prop, prop)).toBe('unchanged');
  });

  it('refreshes for replacement state and closes only when the prop is absent', () => {
    expect(propInspectorSyncDecision(prop, { ...prop })).toBe('refresh');
    expect(propInspectorSyncDecision(prop, undefined)).toBe('close');
  });
});
