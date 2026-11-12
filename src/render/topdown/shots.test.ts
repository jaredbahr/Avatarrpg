import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { TopdownVfxData } from '../../content/assets/topdownVfx';
import { shotCel, shotSprite, type Shot } from './shots';

const data = JSON.parse(readFileSync('public/art/topdown/vfx.json', 'utf8')) as TopdownVfxData;
const shot = (look: string, to = { x: 6, y: 2 }): Shot => ({
  look,
  from: { x: 2, y: 2 },
  to,
  feet: [
    { x: 2, y: 3 },
    { x: 6, y: 3 },
  ],
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

  it('flies from the hand to the mark on a lob, its shadow tracking it across the ground', () => {
    const at = (now: number) => shotSprite(shot('shot/rock'), now, data)[1]?.at;
    const ground = (now: number) => shotSprite(shot('shot/rock'), now, data)[0]?.at;
    expect(at(1000)).toEqual({ x: 2, y: 2 });
    expect(at(1200)?.x).toBeCloseTo(4);
    expect(at(1200)?.y).toBeCloseTo(2 - 0.2);
    expect(at(1400)).toEqual({ x: 6, y: 2 });
    expect(ground(1200)).toEqual({ x: 4, y: 3 });
    const [shadow, rock] = shotSprite(shot('shot/rock'), 1100, data);
    expect(shadow).toMatchObject({ z: 'ground', width: 7 / 40, turn: 0 });
    expect(rock?.width).toBe(8 / 40);
    expect(rock?.turn).toBe(0);
    expect(rock?.z).toBe('overActor');
    expect(rock?.image).toBe('art/topdown/vfx.webp');
  });

  it('tumbles a rock or stone a quarter turn every 80 ms; the flask flies as it is', () => {
    expect([0, 80, 170, 250, 330].map((ms) => shotCel(shot('shot/rock'), ms))).toEqual([
      'shot/rock/0',
      'shot/rock/1',
      'shot/rock/2',
      'shot/rock/3',
      'shot/rock/0',
    ]);
    expect(shotCel(shot('shot/stone'), 90)).toBe('shot/stone/1');
    expect(shotCel(shot('shot/jar'), 90)).toBe('shot/jar');
    for (const q of [0, 1, 2, 3]) expect(data.frames[`shot/stone/${q}`]).toBeDefined();
  });

  it('burns the torch on its own outlined cels, and draws nothing before the atlas is in', () => {
    expect(shotCel(shot('shot/torch'), 150)).toBe('shot/torch/2');
    expect(data.frames['shot/torch/5']).toBeDefined();
    expect(shotSprite(shot('shot/jar'), 1100, null)).toEqual([]);
  });
});
