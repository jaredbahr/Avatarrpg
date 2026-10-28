import { expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { enemyScale, partyScale } from '../anim/actorScale';
import { npcPresentationScale, triggerPresentationScale } from './exploreMarkerScale';

it('sizes only the small animal discovery below adult NPCs', () => {
  expect(npcPresentationScale('world.turtle_ducks', 'oblique')).toBe(0.6);
  for (const sprite of ['world.runoff_marker', 'world.tea_station']) {
    expect(npcPresentationScale(sprite, 'oblique')).toBe(1.5);
    expect(npcPresentationScale(sprite, undefined)).toBe(1);
  }
  // The painter body is about 0.57 tiles high; a 96-pixel tile should show a
  // roughly 33-pixel animal, while the party's 121-pixel sheet body is 113px.
  const animal = 0.57 * 96 * npcPresentationScale('world.turtle_ducks', 'oblique');
  expect(animal).toBeGreaterThan(25);
  expect(animal).toBeLessThan(35);
});

it('brings the painted placeholder person down to the old illustrated residents’ height', () => {
  // Level with the residents: 1.4 beside the old 1.25 party, so 1.4 x 0.8 at 1 (ADR 0094).
  expect(npcPresentationScale('npc.hanru', 'oblique')).toBeCloseTo(1.12, 9);
  expect(npcPresentationScale('npc.hanru', undefined)).toBe(1);
});

it('stands every resident on a G sheet at the party’s scale (issue #284)', () => {
  for (const sprite of [
    'npc.elder',
    'npc.shopkeeper',
    'npc.kid',
    'npc.dorin',
    'npc.guard',
    'npc.household',
  ]) {
    expect(npcPresentationScale(sprite, 'oblique')).toBe(partyScale('oblique'));
    expect(npcPresentationScale(sprite, undefined)).toBe(partyScale(undefined));
  }
});

it('uses the existing forest attacker at both crossings without changing their areas', () => {
  const map = CONTENT.maps.get('forest_road');
  if (!map) throw new Error('Missing forest');
  for (const [id, x] of [
    ['road_depart', 4],
    ['battle_forest_road', 8],
  ] as const) {
    const trigger = map.triggers?.find((item) => item.id === id);
    expect(trigger?.sprite).toBe('unit.enemy.thug');
    expect(trigger?.area[0]).toEqual({ x, y: 4 });
    expect(trigger?.area.every((pos) => pos.x === x)).toBe(true);
    expect(triggerPresentationScale(map, trigger?.sprite ?? '')).toBe(
      enemyScale('unit.enemy.thug', 1, map.projection),
    );
  }
  expect(map.npcs.find((npc) => npc.id === 'duck_nest')?.pos).toEqual({ x: 2, y: 9 });
  // A person on a G sheet (the relief watch, issue #284) stands at the party's scale anywhere.
  expect(triggerPresentationScale({ id: 'quarry_gate', projection: 'oblique' }, 'npc.guard')).toBe(
    partyScale('oblique'),
  );
  expect(
    triggerPresentationScale({ id: 'ambush_road', projection: 'oblique' }, 'unit.enemy.thug'),
  ).toBe(enemyScale('unit.enemy.thug', 1, 'oblique'));
  // The G thug (ADR 0059) stands at the party's scale on the map's projection: 1, the world's grain (ADR 0094).
  expect(enemyScale('unit.enemy.thug', 1, 'oblique')).toBe(1);
});

it('keeps the Driller crossing marker compact when its oblique combat body is compensated', () => {
  expect(
    triggerPresentationScale({ id: 'quarry_floor', projection: 'oblique' }, 'unit.enemy.driller'),
  ).toBe(1);
  expect(enemyScale('unit.enemy.driller', 1, 'oblique')).toBe(2);
});
