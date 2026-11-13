import { describe, expect, it } from 'vitest';
import { pageStyle } from './style';

describe('the page style', () => {
  it('boots top-down with no style, an unknown one, or the old alias', () => {
    for (const search of ['', '?renderer=canvas', '?style=', '?style=painted', '?style=topdown'])
      expect(pageStyle(search), search).toBe('topdown');
  });

  it('keeps the oblique look and the world-figure test behind their flags', () => {
    expect(pageStyle('?style=oblique&renderer=webgl')).toBe('oblique');
    expect(pageStyle('?skip&style=world')).toBe('world');
  });
});
