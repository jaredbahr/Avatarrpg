import { describe, expect, it } from 'vitest';
import { glyphFor, handoffCopy } from './glyphs';

describe('glyphFor', () => {
  it('prints nothing for touch and mouse', () => {
    expect(glyphFor('confirm', 'touch', 'xbox')).toBeNull();
    expect(glyphFor('cancel', 'mouse', 'playstation')).toBeNull();
  });

  it('prints keyboard keys', () => {
    expect(glyphFor('confirm', 'keyboard', 'xbox')).toBe('Enter');
    expect(glyphFor('cancel', 'keyboard', 'nintendo')).toBe('Esc');
  });

  it('names the confirm button by family', () => {
    expect(glyphFor('confirm', 'gamepad', 'xbox')).toBe('A');
    expect(glyphFor('confirm', 'gamepad', 'playstation')).toBe('✕');
    expect(glyphFor('confirm', 'gamepad', 'nintendo')).toBe('B');
  });

  it('gives every hint a glyph on every device that prints one', () => {
    const keys = [
      'move',
      'confirm',
      'cancel',
      'cycle',
      'slots',
      'endTurn',
      'inspect',
      'map',
      'menu',
      'pan',
    ] as const;
    for (const key of keys) {
      expect(glyphFor(key, 'keyboard', 'xbox')).toBeTruthy();
      for (const family of ['xbox', 'playstation', 'nintendo'] as const)
        expect(glyphFor(key, 'gamepad', family)).toBeTruthy();
    }
  });
});

describe('handoffCopy', () => {
  it('names the device being passed', () => {
    expect(handoffCopy('keyboard', false)).toBe('Pass the keyboard to');
    expect(handoffCopy('keyboard', true)).toBe('Pass the keyboard to');
    expect(handoffCopy('gamepad', false)).toBe('Pass the controller to');
  });

  it('says tablet only for a pointer on a touch screen', () => {
    expect(handoffCopy('touch', true)).toBe('Hand the tablet to');
    expect(handoffCopy('mouse', true)).toBe('Hand the tablet to');
    expect(handoffCopy('mouse', false)).toBe('Next up');
    expect(handoffCopy('touch', false)).toBe('Next up');
  });
});
