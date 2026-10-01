import { describe, expect, it } from 'vitest';
import { refreshFocusTarget } from './Dialog';

describe('dialog refresh focus', () => {
  it('restores focus to Close when focus was inside the rebuilt dialog', () => {
    expect(refreshFocusTarget(true, true)).toBe('close');
  });

  it('falls back to the heading when the rebuilt dialog has no Close control', () => {
    expect(refreshFocusTarget(true, false)).toBe('heading');
  });

  it('does not move focus that was outside the dialog', () => {
    expect(refreshFocusTarget(false, true)).toBeNull();
  });
});
