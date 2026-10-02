import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
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
  it('explains the shipped hay bale fuel and every way to douse it', () => {
    const hay = CONTENT.props.get('hay_bale');
    if (!hay) throw new Error('Missing shipped hay bale');
    const copy = propInspectText(
      hay,
      { ...prop, propId: hay.id, hp: hay.hp, burning: undefined },
      CONTENT.statuses,
    );

    expect(copy.notes.map((chip) => chip.text)).toContain('Fire lights it; burns for 2 rounds');
    expect(copy.notes.map((chip) => chip.text)).toContain('Weak to air');
    expect(copy.actions.map((chip) => chip.text)).not.toContain(
      'Put it out with water, cold, or earth',
    );

    const burning = propInspectText(
      hay,
      { ...prop, propId: hay.id, hp: hay.hp, burning: 2 },
      CONTENT.statuses,
    );
    expect(burning.actions.map((chip) => chip.text)).toContain(
      'Put it out with water, cold, or earth',
    );
    expect(burning.notes.map((chip) => chip.text)).toContain('Fire will break it now');
    expect(burning.notes.map((chip) => chip.text)).toContain('Weak to fire or air');
  });

  it('groups actions and facts, uses display names, and omits unusable cover and dousing', () => {
    const copy = propInspectText(def, prop, CONTENT.statuses);
    expect(copy).toMatchObject({
      description: 'A useful test prop.',
      hint: 'Try a clever combo.',
      toughness: '6 / 9 HP',
      burning: 'On fire: 2 rounds left',
    });
    expect(copy.actions.map((chip) => chip.text)).toEqual([
      'Break it: water spills out, it hurts anyone next to it, anyone next to it ends up Blinded, and it knocks back anyone next to it',
      'Shove it',
      'Put it out with earth',
    ]);
    expect(copy.notes.map((chip) => chip.text)).toEqual([
      'Blocks the way',
      'Blocks sight',
      'Fire will break it now',
      'Weak to fire or blows',
      'Shrugs off water and cold',
    ]);
  });

  it('says fire hurts a burning fuel prop that survives the smallest shipped fire hit', () => {
    const copy = propInspectText(
      { ...def, hp: 12 },
      { ...prop, hp: 10, burning: 2 },
      CONTENT.statuses,
    );
    expect(copy.notes.map((chip) => chip.text)).toContain('Fire hurts it now');
    expect(copy.notes.map((chip) => chip.text)).not.toContain('Fire will break it now');
  });

  it('describes radius zero, one, and larger break effects truthfully', () => {
    const copy = propInspectText(
      {
        ...def,
        onBreak: [
          { kind: 'surface', surface: 'fire', duration: 2, radius: 0 },
          { kind: 'damage', base: 2, damageType: 'fire', radius: 0 },
          { kind: 'surface', surface: 'oil', duration: 2, radius: 2 },
          { kind: 'damage', base: 2, damageType: 'fire', radius: 3 },
          { kind: 'status', status: 'blinded', duration: 1, chance: 0.9, radius: 2 },
        ],
      },
      prop,
      CONTENT.statuses,
    );
    expect(copy.actions[0]?.text).toBe(
      'Break it: fire is left where it stood, it hurts anyone standing on it, oil spreads 2 tiles around it, it hurts anyone within 3 tiles, and anyone within 2 tiles may end up Blinded',
    );
  });

  it('uses singular round copy and offers walkable cover', () => {
    const copy = propInspectText(
      { ...def, blocksMove: false, grantsCover: true, fuel: 1, immuneTo: [], douse: ['water'] },
      { ...prop, burning: 1 },
      CONTENT.statuses,
    );
    expect(copy.actions.map((chip) => chip.text)).toContain('Stand on it for cover');
    expect(copy.notes.map((chip) => chip.text)).toContain('Fire will break it now');
    expect(copy.burning).toBe('On fire: 1 round left');
  });

  it('keeps an inert prop to its required break chip and omits empty facts', () => {
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
      CONTENT.statuses,
    );
    expect(copy.actions.map((chip) => chip.text)).toEqual(['Break it']);
    expect(copy.notes).toEqual([]);
    expect(copy.hint).toBeUndefined();
    expect(copy.burning).toBeUndefined();
  });
});
