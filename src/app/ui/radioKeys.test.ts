import { describe, expect, it } from 'vitest';
import { nextRadioIndex } from './radioKeys';

describe('radio group arrow keys', () => {
  it('moves forward on Right and Down, back on Left and Up', () => {
    expect(nextRadioIndex(0, 'ArrowRight', 3)).toBe(1);
    expect(nextRadioIndex(0, 'ArrowDown', 3)).toBe(1);
    expect(nextRadioIndex(2, 'ArrowLeft', 3)).toBe(1);
    expect(nextRadioIndex(2, 'ArrowUp', 3)).toBe(1);
  });

  it('wraps at both ends', () => {
    expect(nextRadioIndex(2, 'ArrowRight', 3)).toBe(0);
    expect(nextRadioIndex(0, 'ArrowLeft', 3)).toBe(2);
  });

  it('stays on the only option', () => {
    expect(nextRadioIndex(0, 'ArrowRight', 1)).toBe(0);
    expect(nextRadioIndex(0, 'ArrowLeft', 1)).toBe(0);
  });

  it('leaves every other key alone', () => {
    for (const key of ['Enter', ' ', 'Tab', 'Escape', 'Home', 'a']) {
      expect(nextRadioIndex(1, key, 3)).toBeNull();
    }
  });

  it('does nothing in an empty group', () => {
    expect(nextRadioIndex(0, 'ArrowRight', 0)).toBeNull();
  });
});
