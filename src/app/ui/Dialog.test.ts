import { describe, expect, it } from 'vitest';
import { refreshFocusTarget } from './Dialog';

describe('dialog refresh focus', () => {
  it('restores focus to Close when focus was inside the rebuilt body', () => {
    expect(refreshFocusTarget('body', true)).toBe('close');
  });

  it('falls back to the heading when the rebuilt body has no Close control', () => {
    expect(refreshFocusTarget('body', false)).toBe('heading');
  });

  it('does not move focus on the surviving heading or elsewhere in the overlay', () => {
    expect(refreshFocusTarget('overlay', true)).toBeNull();
  });

  it('does not move focus that was outside the overlay', () => {
    expect(refreshFocusTarget('outside', true)).toBeNull();
  });
});
