import { expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { enemyScale, partyScale } from '../anim/actorScale';
import { npcPresentationScale, triggerPresentationScale } from './exploreMarkerScale';

it('sizes only the small animal discovery below adult NPCs', () => {
  expect(npcPresentationScale('world.turtle_ducks')).toBe(0.6);
  for (const sprite of ['world.runoff_marker', 'world.tea_station', 'npc.hanru'])
    expect(npcPresentationScale(sprite)).toBe(1);
  // The painter body is about 0.57 tiles high; a 96-pixel tile should show a
  // roughly 33-pixel animal at the oblique board's old 1.5 NPC scale, and a
  // smaller one now that adults draw at 1.
  const animal = 0.57 * 96 * npcPresentationScale('world.turtle_ducks');
  expect(animal).toBeLessThan(35);
});

it('stands every resident on an eight-heading sheet at the party’s scale (issue #284)', () => {
  for (const sprite of [
    'npc.elder',
    'npc.shopkeeper',
    'npc.kid',
    'npc.dorin',
    'npc.guard',
    'npc.household',
  ])
    expect(npcPresentationScale(sprite)).toBe(partyScale());
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
    expect(triggerPresentationScale(trigger?.sprite ?? '')).toBe(enemyScale('unit.enemy.thug', 1));
  }
  expect(map.npcs.find((npc) => npc.id === 'duck_nest')?.pos).toEqual({ x: 2, y: 9 });
  expect(triggerPresentationScale('unit.enemy.thug')).toBe(enemyScale('unit.enemy.thug', 1));
});

it('keeps the Driller crossing marker compact', () => {
  expect(triggerPresentationScale('unit.enemy.driller')).toBe(1);
});
