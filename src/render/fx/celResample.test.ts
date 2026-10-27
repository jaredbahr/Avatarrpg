import { describe, expect, it } from 'vitest';
import { dropOrphanPixels, resampleCel } from './celResample';

/** A size x size master: a solid square of `fill`, an ink outline, clear outside. */
function master(size: number, inset: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(size * size * 4);
  for (let y = inset; y < size - inset; y++)
    for (let x = inset; x < size - inset; x++) {
      const edge = x === inset || y === inset || x === size - inset - 1 || y === size - inset - 1;
      px.set(edge ? [0x1b, 0x14, 0x10, 224] : [224, 82, 31, 224], (y * size + x) * 4);
    }
  return px;
}

describe('resampling a cel to its drawn size', () => {
  it('keeps only the master’s colours and its one opacity', () => {
    const out = resampleCel(master(96, 20), 96, 40);
    const colours = new Set<string>();
    for (let i = 0; i < out.length; i += 4) {
      if (out[i + 3] === 0) continue;
      expect(out[i + 3]).toBe(224);
      colours.add(`${out[i]},${out[i + 1]},${out[i + 2]}`);
    }
    expect([...colours].sort()).toEqual(['224,82,31', '27,20,16']);
  });

  it('keeps a one-pixel outline closed at less than half size', () => {
    const out = resampleCel(master(96, 20), 96, 40);
    const at = (x: number, y: number) => [...out.subarray((y * 40 + x) * 4, (y * 40 + x) * 4 + 3)];
    // The square spans 20..75 of 96, so 8..31 of 40: its edge rows and columns stay ink.
    for (let i = 10; i < 30; i++) {
      expect(at(i, 8)).toEqual([27, 20, 16]);
      expect(at(8, i)).toEqual([27, 20, 16]);
    }
    expect(at(20, 20)).toEqual([224, 82, 31]);
  });

  it('is nearest at the master’s size and above', () => {
    const m = master(8, 2);
    expect(resampleCel(m, 8, 8)).toEqual(m);
    const up = resampleCel(m, 8, 16);
    expect([...up.subarray((5 * 16 + 5) * 4, (5 * 16 + 5) * 4 + 4)]).toEqual([
      0x1b, 0x14, 0x10, 224,
    ]);
  });

  it('clears pieces of one or two pixels and keeps anything larger', () => {
    const px = new Uint8ClampedArray(6 * 6 * 4);
    const put = (x: number, y: number) => px.set([9, 9, 9, 255], (y * 6 + x) * 4);
    put(0, 0); // a lone pixel
    put(5, 5);
    put(4, 4); // a diagonal pair
    put(2, 0);
    put(3, 0);
    put(3, 1); // three in a corner
    dropOrphanPixels(px, 6, 6, 2);
    const alive = (x: number, y: number) => px[(y * 6 + x) * 4 + 3] === 255;
    expect([alive(0, 0), alive(5, 5), alive(4, 4)]).toEqual([false, false, false]);
    expect([alive(2, 0), alive(3, 0), alive(3, 1)]).toEqual([true, true, true]);
  });

  it('is deterministic', () => {
    expect(resampleCel(master(96, 30), 96, 37)).toEqual(resampleCel(master(96, 30), 96, 37));
  });
});
