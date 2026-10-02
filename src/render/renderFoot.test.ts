import { describe, expect, it } from 'vitest';
import { renderFoot } from './renderFoot';

describe('renderFoot', () => {
  it('stands an oblique square 2x2 on the centre of its front cell', () => {
    expect(renderFoot({ x: 15, y: 5 }, 2, true, 'oblique')).toEqual({
      x: 16.5,
      y: 6.5,
    });
  });

  it('keeps the orthographic square 2x2 foot unchanged', () => {
    expect(renderFoot({ x: 15, y: 5 }, 2, true, 'orthographic')).toEqual({ x: 16, y: 6.5 });
  });

  it.each(['orthographic', 'oblique'] as const)(
    'keeps 1x1 and gate-off 2x1 placement unchanged in %s',
    (projection) => {
      expect(renderFoot({ x: 15, y: 5 }, 1, true, projection)).toEqual({
        x: 15.5,
        y: 5.5,
      });
      expect(renderFoot({ x: 15, y: 5 }, 2, false, projection)).toEqual({
        x: 16,
        y: 5.5,
      });
    },
  );
});
