import { expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { npcPresentationScale, triggerPresentationScale } from './exploreMarkerScale';

it('sizes only the small animal discovery below adult NPCs', () => {
  expect(npcPresentationScale('world.turtle_ducks', 'oblique')).toBe(0.6);
  for (const sprite of ['npc.elder', 'npc.kid', 'world.runoff_marker', 'world.tea_station']) {
    expect(npcPresentationScale(sprite, 'oblique')).toBe(1.5);
    expect(npcPresentationScale(sprite, undefined)).toBe(1);
  }
  // The painter body is about 0.57 tiles high; a 96-pixel tile should show a
  // roughly 33-pixel animal, while the party's 121-pixel sheet body is 113px.
  const animal = 0.57 * 96 * npcPresentationScale('world.turtle_ducks', 'oblique');
  expect(animal).toBeGreaterThan(25);
  expect(animal).toBeLessThan(35);
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
    expect(triggerPresentationScale(map, trigger?.sprite ?? '')).toBe(1.25);
  }
  expect(map.npcs.find((npc) => npc.id === 'duck_nest')?.pos).toEqual({ x: 2, y: 9 });
  expect(triggerPresentationScale({ id: 'quarry_gate', projection: 'oblique' }, 'npc.guard')).toBe(
    1,
  );
  expect(
    triggerPresentationScale({ id: 'ambush_road', projection: 'oblique' }, 'unit.enemy.thug'),
  ).toBe(1);
});
