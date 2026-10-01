import { describe, expect, it } from 'vitest';
import type { PropInstance } from '../../core/types';
import { inspectorSyncDecision } from './Dialog';

const prop = { id: 'prop-1' } as PropInstance;

describe('prop inspector sync decision', () => {
  it('does not rebuild for the same prop reference', () => {
    expect(inspectorSyncDecision(prop, prop)).toBe('unchanged');
  });

  it('refreshes for replacement state and closes only when the prop is absent', () => {
    expect(inspectorSyncDecision(prop, { ...prop })).toBe('refresh');
    expect(inspectorSyncDecision(prop, undefined)).toBe('close');
  });
});
