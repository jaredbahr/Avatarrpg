import { describe, expect, it } from 'vitest';
import type { Catalogue } from './inventory';
import { guessAsset, tokens } from './inventory';

const known: Catalogue = {
  portraits: ['kaya', 'linmei', 'mira'],
  units: [
    { key: 'unit.fire.kaya', name: 'kaya' },
    { key: 'unit.earth.linmei', name: 'linmei' },
    { key: 'unit.enemy.thug', name: 'thug' },
  ],
  maps: [
    { id: 'ba_dan_village', words: ['ba', 'dan', 'village'] },
    { id: 'forest_road', words: ['forest', 'road', 'the'] },
  ],
};

describe('tokens', () => {
  it('splits a loose file name into words', () => {
    expect(tokens('Kaya portrait.png')).toEqual(['kaya', 'portrait']);
    expect(tokens('kaya_cast_2.jpg')).toEqual(['kaya', 'cast', '2']);
    expect(tokens('BaDanVillage3840x2560.png')).toEqual(['badanvillage', '3840', 'x', '2560']);
  });
});

describe('guessAsset', () => {
  it('sees a portrait, square or not, and says what to do with it', () => {
    const square = guessAsset('Kaya portrait.png', { width: 1024, height: 1024 }, known);
    expect(square.guess).toEqual({ kind: 'portrait', key: 'portrait.kaya', name: 'kaya' });
    expect(square.confidence).toBe('sure');
    expect(square.verdict).toBe('ok');
    expect(square.next).toBe('npm run art:portrait -- --key kaya --in "Kaya portrait.png"');
    const tall = guessAsset('Lin Mei bust.png', { width: 900, height: 1200 }, known);
    expect(tall.guess).toEqual({ kind: 'portrait', key: 'portrait.linmei', name: 'linmei' });
    expect(tall.verdict).toMatch(/not square/);
  });

  it('sees a sheet frame from the unit, the pose word and the number', () => {
    const frame = guessAsset('kaya_cast_2.jpg', { width: 512, height: 768 }, known, 'jpeg');
    expect(frame.guess).toEqual({ kind: 'frame', unit: 'unit.fire.kaya', clip: 'cast', index: 2 });
    expect(frame.verdict).toMatch(/JPEG frame/);
    expect(frame.next).toMatch(/art\/raw\/unit.fire.kaya\/cast\/2.png/);
    const stride = guessAsset('thug stride 1.png', { width: 1024, height: 1536 }, known, 'png');
    expect(stride.guess).toEqual({
      kind: 'frame',
      unit: 'unit.enemy.thug',
      clip: 'walk',
      index: 1,
    });
    expect(stride.verdict).toBe('ok');
  });

  it('sees a reference figure and a map painting', () => {
    expect(
      guessAsset('kaya reference figure.png', { width: 1024, height: 1536 }, known).guess,
    ).toEqual({
      kind: 'reference',
      unit: 'unit.fire.kaya',
    });
    const map = guessAsset('Ba Dan village 3840x2560.png', { width: 3840, height: 2560 }, known);
    expect(map.guess).toEqual({ kind: 'map', id: 'ba_dan_village' });
    expect(map.verdict).toBe('ok');
    expect(map.next).toBe(
      'npm run art:map -- --map ba_dan_village --in "Ba Dan village 3840x2560.png"',
    );
    expect(guessAsset('forest road.jpg', { width: 1024, height: 614 }, known).verdict).toMatch(
      /too small/,
    );
  });

  it('admits what it cannot place', () => {
    const unknown = guessAsset('IMG_0042.png', { width: 1024, height: 1024 }, known);
    expect(unknown.guess).toEqual({ kind: 'unknown' });
    expect(unknown.confidence).toBe('none');
    expect(unknown.next).toBe('ask what it is');
  });
});
