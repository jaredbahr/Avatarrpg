import type { MapDef } from '../../core/types';
import { OBLIQUE_LEGACY_ADULT, enemyScale, partyScale } from '../anim/actorScale';
import { resolveAsset, sheetLocomotion } from '../../content/assets/manifest';

/** A small animal discovery must not inherit the adult conversation-figure scale. */
export function npcPresentationScale(sprite: string, projection: MapDef['projection']): number {
  if (sprite === 'world.turtle_ducks') return 0.6;
  // A resident on a G sheet (issue #284) is packed at the party's size, so it
  // stands at the party's scale and casts the party's shadow.
  if (sheetLocomotion(sprite)?.headings === 8) return partyScale(projection);
  // A painted placeholder person (Hanru, ADR 0047) stands a head taller than
  // the illustrated residents at 1.5; until A1's art lands, bring it down to
  // their height: 1.4 beside a 1.25 party, scaled with the figures since
  // (ADR 0094). Objects shown as NPCs (the tea station, the runoff marker) are
  // sized against the world, not an adult, and keep 1.5.
  const painted = sprite.startsWith('npc.') && resolveAsset(sprite).kind === 'painter';
  return projection === 'oblique' ? (painted ? 1.4 * OBLIQUE_LEGACY_ADULT : 1.5) : 1;
}

/** An encounter marker and its combat actor are the same adult at the same scale. */
export function triggerPresentationScale(
  map: Pick<MapDef, 'id' | 'projection'>,
  sprite: string,
): number {
  // The Driller marker is a compact crossing sign, not its four-cell combat body.
  if (sprite === 'unit.enemy.driller') return 1;
  return enemyScale(sprite, 1, map.projection);
}
