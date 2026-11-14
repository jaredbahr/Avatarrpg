import { enemyScale } from '../anim/actorScale';

/** A small animal discovery must not inherit the adult conversation-figure scale. */
export function npcPresentationScale(sprite: string): number {
  return sprite === 'world.turtle_ducks' ? 0.6 : 1;
}

/** An encounter marker and its combat actor are the same adult at the same scale. */
export function triggerPresentationScale(sprite: string): number {
  // The Driller marker is a compact crossing sign, not its four-cell combat body.
  if (sprite === 'unit.enemy.driller') return 1;
  return enemyScale(sprite, 1);
}
