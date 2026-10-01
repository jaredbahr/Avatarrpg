import { describe, expect, it } from 'vitest';
import type { PropDef, PropInstance } from '../../core/types';
import { propInspectText } from './propInspectText';

const def: PropDef = {
  id: 'test',
  name: 'Test Prop',
  description: 'A useful test prop.',
  sprite: 'prop.test',
  hp: 9,
  blocksMove: true,
  blocksSight: true,
  grantsCover: true,
  pushable: true,
  vulnerableTo: ['fire', 'physical'],
  immuneTo: ['water', 'cold'],
  onBreak: [
    { kind: 'surface', surface: 'water', duration: 2, radius: 1 },
    { kind: 'damage', base: 2, damageType: 'earth', radius: 1 },
    { kind: 'status', status: 'blinded', duration: 1, chance: 1, radius: 1 },
    { kind: 'push', distance: 1, radius: 1 },
  ],
  breakLabel: 'Broken.',
  fuel: 3,
  douse: ['water', 'cold', 'earth'],
  hint: 'Try a clever combo.',
};

const prop: PropInstance = {
  id: 'p0',
  propId: 'test',
  pos: { x: 1, y: 2 },
  hp: 6,
  previous: {
    terrain: 'dirt',
    elevation: 0,
    blocked: false,
    blocksSight: false,
    cover: false,
    surface: null,
  },
  burning: 2,
};

describe('prop inspect text', () => {
  it('covers every action, defense, break result, hint, and live state', () => {
    const copy = propInspectText(def, prop);
    expect(copy).toMatchObject({
      description: 'A useful test prop.',
      hint: 'Try a clever combo.',
      toughness: 'Sturdy 6 / 9',
      burning: 'On fire: 2 rounds left',
    });
    expect(copy.chips.map((chip) => chip.text)).toEqual([
      'Break it: water spills out, and it hurts anyone next to it, and anyone next to it may end up blinded, and it knocks back anyone next to it',
      'Shove it',
      'Hide behind it',
      'Blocks the way',
      'Blocks sight',
      'Burns for 3 rounds',
      'Put it out with water, cold, or earth',
      'Weak to fire or blows',
      'Shrugs off water and cold',
    ]);
  });

  it('keeps an inert prop to its required break chip', () => {
    const copy = propInspectText(
      {
        ...def,
        blocksMove: false,
        blocksSight: false,
        grantsCover: false,
        pushable: false,
        vulnerableTo: [],
        immuneTo: [],
        onBreak: [],
        fuel: undefined,
        douse: undefined,
        hint: undefined,
      },
      { ...prop, burning: undefined },
    );
    expect(copy.chips.map((chip) => chip.text)).toEqual(['Break it']);
    expect(copy.hint).toBeUndefined();
    expect(copy.burning).toBeUndefined();
  });
});
