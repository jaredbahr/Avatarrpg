import { describe, expect, it } from 'vitest';
import { newImage, pixelAt, setPixel } from './lib/image';
import { alphaBounds } from './lib/trim';
import { normaliseProp } from './prop';

describe('transparent prop intake', () => {
  it('keeps aspect, green material, clear margins and a common ground line', () => {
    const source = newImage(512, 512);
    for (let y = 120; y < 312; y++)
      for (let x = 100; x < 356; x++) setPixel(source, x, y, [0, 180, 20, 255]);
    const packed = normaliseProp(source, 'hay');
    const bounds = alphaBounds(packed);
    expect(packed.width).toBe(256);
    expect(packed.height).toBe(256);
    expect(bounds).not.toBeNull();
    if (!bounds) throw new Error('Missing prop');
    expect(bounds.width / bounds.height).toBeCloseTo(256 / 192, 1);
    expect(bounds.x + bounds.width / 2).toBeCloseTo(128, 0);
    expect(bounds.y + bounds.height).toBe(Math.round(256 * 0.85));
    expect(pixelAt(packed, 128, bounds.y + 5)).toEqual([0, 180, 20, 255]);
    expect(pixelAt(packed, 0, 0)[3]).toBe(0);
  });

  it('refuses empty or opaque source art instead of shipping a background square', () => {
    const source = newImage(32, 32);
    expect(() => normaliseProp(source, 'barrel')).toThrow(/empty/);
    source.data.fill(255);
    expect(() => normaliseProp(source, 'barrel')).toThrow(/transparent/);
    expect(() => normaliseProp(source, 'unknown')).toThrow(/Unknown prop/);
  });
});
