import type { Projection } from '../../render/projection';
import { sheetLocomotion } from '../../content/assets/manifest';

/** Party adults keep their world height when exploration enters combat. */
export function partyScale(projection: Projection | undefined, poseScale = 1): number {
  return (projection === 'oblique' ? 1.25 : 1) * poseScale;
}

// An older 121px body needs the same adult world height as the newer 151px
// sheets.
const ADULT_ENEMIES: Readonly<Record<string, number>> = {
  'unit.enemy.crossbow': 1.23,
};

/**
 * Shared by the visible body, effect sockets and exploration encounter markers.
 * An enemy drawn on a G sheet (the thug, ADR 0059; the quarry bandits, ADR
 * 0060) is packed at the party's size, so it stands at the party's scale.
 */
export function enemyScale(sprite: string, poseScale = 1, projection?: Projection): number {
  if (sheetLocomotion(sprite)?.headings === 8) return partyScale(projection, poseScale);
  return (ADULT_ENEMIES[sprite] ?? 1) * poseScale;
}
