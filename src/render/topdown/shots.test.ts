import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { TopdownVfxData } from '../../content/assets/topdownVfx';
import { shotCel, shotSprite, type Shot } from './shots';

const data = JSON.parse(readFileSync('public/art/topdown/vfx.json', 'utf8')) as TopdownVfxData;
const shot = (look: string, to = { x: 6, y: 2 }): Shot => ({
  look,
  from: { x: 2, y: 2 },
  to,
  arc: 0.2,
  start: 1000,
  duration: 400,
});

describe('a top-down shot in flight (#588)', () => {
  it('turns the bolt to the nearest of its eight drawn headings', () => {
    const cel = (to: { x: number; y: number }) => shotCel(shot('shot/bolt', to), 0);
    expect(cel({ x: 6, y: 2 })).toBe('shot/bolt/0');
    expect(cel({ x: 5, y: 5 })).toBe('shot/bolt/1');
    expect(cel({ x: 2, y: 6 })).toBe('shot/bolt/2');
    expect(cel({ x: -2, y: 2.5 })).toBe('shot/bolt/4');
    expect(cel({ x: 2.2, y: -3 })).toBe('shot/bolt/6');
    expect(cel({ x: 5, y: -1 })).toBe('shot/bolt/7');
    for (let i = 0; i < 8; i++) expect(data.frames[`shot/bolt/${i}`]).toBeDefined();
  });

  it('flies from the hand to the mark on a lob, at one art px a world px', () => {
    const at = (now: number) => shotSprite(shot('shot/rock'), now, data)?.at;
    expect(at(1000)).toEqual({ x: 2, y: 2 });
    expect(at(1200)?.x).toBeCloseTo(4);
    expect(at(1200)?.y).toBeCloseTo(2 - 0.2);
    expect(at(1400)).toEqual({ x: 6, y: 2 });
    const sprite = shotSprite(shot('shot/rock'), 1100, data);
    expect(sprite?.width).toBe(8 / 40);
    expect(sprite?.turn).toBe(0);
    expect(sprite?.image).toBe('art/topdown/vfx.webp');
  });

  it('burns the torch on its own cels, and draws nothing before the atlas is in', () => {
    expect(shotCel(shot('vfx13/torch'), 150)).toBe('vfx13/torch/2');
    expect(shotSprite(shot('shot/jar'), 1100, null)).toBeNull();
  });
});
