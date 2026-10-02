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

// An oblique 2x2 diamond is four upright tile-widths across. The Driller's
// 160px source cel is authored as a two-tile-wide orthographic figure, so it
// needs the projection's 2:1 horizontal compensation in oblique combat.
const OBLIQUE_ENEMIES: Readonly<Record<string, number>> = {
  'unit.enemy.driller': 2,
};

/**
 * Shared by the visible body, effect sockets and exploration encounter markers.
 * An enemy drawn on a G sheet (the thug, ADR 0059; the quarry bandits, ADR
 * 0062) is packed at the party's size, so it stands at the party's scale.
 */
export function enemyScale(sprite: string, poseScale = 1, projection?: Projection): number {
  if (sheetLocomotion(sprite)?.headings === 8) return partyScale(projection, poseScale);
  const projectionScale = projection === 'oblique' ? (OBLIQUE_ENEMIES[sprite] ?? 1) : 1;
  return (ADULT_ENEMIES[sprite] ?? 1) * projectionScale * poseScale;
}
