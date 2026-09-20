import type { MapDef } from '../../core/types';
import { enemyScale } from '../anim/actorScale';

/** A small animal discovery must not inherit the adult conversation-figure scale. */
export function npcPresentationScale(sprite: string, projection: MapDef['projection']): number {
  if (sprite === 'world.turtle_ducks') return 0.6;
  return projection === 'oblique' ? 1.5 : 1;
}

/** An encounter marker and its combat actor are the same adult at the same scale. */
export function triggerPresentationScale(
  _map: Pick<MapDef, 'id' | 'projection'>,
  sprite: string,
): number {
  return enemyScale(sprite);
}
