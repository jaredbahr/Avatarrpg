import type { MapDef } from '../../core/types';

/** A small animal discovery must not inherit the adult conversation-figure scale. */
export function npcPresentationScale(sprite: string, projection: MapDef['projection']): number {
  if (sprite === 'world.turtle_ducks') return 0.6;
  return projection === 'oblique' ? 1.5 : 1;
}

/** These two forest crossing figures use the same adult sheet scale as the party. */
export function triggerPresentationScale(
  map: Pick<MapDef, 'id' | 'projection'>,
  sprite: string,
): number {
  return map.id === 'forest_road' && map.projection === 'oblique' && sprite === 'unit.enemy.thug'
    ? 1.25
    : 1;
}
