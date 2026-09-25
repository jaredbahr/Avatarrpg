import type { MapDef } from '../../core/types';
import { enemyScale } from '../anim/actorScale';
import { resolveAsset } from '../../content/assets/manifest';

/** A small animal discovery must not inherit the adult conversation-figure scale. */
export function npcPresentationScale(sprite: string, projection: MapDef['projection']): number {
  if (sprite === 'world.turtle_ducks') return 0.6;
  // A painted placeholder person (ADR 0047's relief watch, household adult and
  // Hanru) stands a head taller than the illustrated residents at 1.5; until
  // A1's art lands, bring it down to their height.
  const painted = sprite.startsWith('npc.') && resolveAsset(sprite).kind === 'painter';
  return projection === 'oblique' ? (painted ? 1.4 : 1.5) : 1;
}

/** An encounter marker and its combat actor are the same adult at the same scale. */
export function triggerPresentationScale(
  _map: Pick<MapDef, 'id' | 'projection'>,
  sprite: string,
): number {
  return enemyScale(sprite);
}
