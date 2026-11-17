import { describe, expect, it } from 'vitest';
import type { CharacterDef } from '../../core/types';
import { freeCharacters, swapHeroPicks, type HeroDraft } from './PartySetupScene';

const chars = [
  { id: 'kaya', element: 'fire' },
  { id: 'sura', element: 'fire' },
  { id: 'bo', element: 'earth' },
  { id: 'mira', element: 'water' },
] as unknown as CharacterDef[];

const hero = (ownerIndex: number, element: string | null, characterId: string | null): HeroDraft =>
  ({ ownerIndex, element, characterId }) as HeroDraft;

describe('swapHeroPicks', () => {
  it('exchanges picks and keeps owners', () => {
    const heroes = [hero(0, 'fire', 'kaya'), hero(1, 'fire', 'sura')];
    const next = swapHeroPicks(heroes, 1, 0, chars);
    expect(next.map((h) => h.characterId)).toEqual(['sura', 'kaya']);
    expect(next.map((h) => h.ownerIndex)).toEqual([0, 1]);
    expect(heroes[0]?.characterId).toBe('kaya');
  });

  it('gives the displaced hero a free same-element character when the asker had none', () => {
    const heroes = [hero(0, 'fire', 'kaya'), hero(1, 'fire', null)];
    const next = swapHeroPicks(heroes, 1, 0, chars);
    expect(next.map((h) => h.characterId)).toEqual(['sura', 'kaya']);
  });

  it('leaves the displaced hero empty only when nothing is free', () => {
    const heroes = [hero(0, 'fire', 'kaya'), hero(1, 'earth', 'sura'), hero(2, 'fire', null)];
    const next = swapHeroPicks(heroes, 2, 0, chars);
    expect(next[0]?.characterId).toBeNull();
    expect(next[2]?.characterId).toBe('kaya');
  });
});

describe('freeCharacters', () => {
  it('excludes only what other heroes hold', () => {
    const heroes = [hero(0, 'fire', 'kaya'), hero(1, 'fire', 'sura'), hero(2, null, null)];
    expect(freeCharacters(heroes, 1, chars).map((c) => c.id)).toEqual(['sura', 'bo', 'mira']);
  });
});
