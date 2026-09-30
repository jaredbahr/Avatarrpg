import { describe, expect, it } from 'vitest';
import { readImage } from './lib/image';
import { alphaBounds } from './lib/trim';
import { expandPropSource } from './prop-family';
import { normaliseProp } from './prop';

const EXPECTED_HEIGHTS: Readonly<Record<string, number>> = {
  barrel: 174,
  cart: 169,
  brazier: 159,
  rubble: 143,
  flask: 102,
  hay: 123,
};

describe('PixelLab prop family packing', () => {
  it.each(Object.entries(EXPECTED_HEIGHTS))(
    '%s keeps its approved visible height and footing',
    (name, height) => {
      const source = readImage(`media/art-sources/prop-family-v1/${name}.png`);
      const packed = normaliseProp(expandPropSource(source), name);
      const bounds = alphaBounds(packed);
      expect(packed.width).toBe(256);
      expect(packed.height).toBe(256);
      expect(bounds).not.toBeNull();
      if (!bounds) throw new Error(`Missing packed ${name}`);
      expect(bounds.height).toBeGreaterThanOrEqual(height - 2);
      expect(bounds.height).toBeLessThanOrEqual(height + 2);
      // Odd-width silhouettes centre on a half pixel; one pixel is the tolerance.
      expect(Math.abs(bounds.x + bounds.width / 2 - 128)).toBeLessThanOrEqual(1);
      expect(bounds.y + bounds.height).toBe(name === 'cart' ? 241 : 218);
    },
  );
});
