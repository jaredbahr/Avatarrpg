import type { Projection } from '../../render/projection';
import { sheetLocomotion } from '../../content/assets/manifest';

/**
 * World px per art px for a figure on an oblique board (ADR 0094; owner, 28
 * October 2026: "1.0x, matching the world"). The G1 figures (the party, the Ba
 * Dan residents, the forest bandits) are drawn one art px to one world px, the
 * painting's grain, so at every integer zoom N an art pixel is exactly N x N
 * device pixels and samples nearest (ADR 0088). It was 1.25, which put 2.5 or
 * 3.75 device pixels on an art pixel and resampled every figure soft.
 */
export const OBLIQUE_FIGURE_SCALE = 1;

/**
 * Adult art not drawn on the G1 grid (the older enemy and placeholder sheets)
 * was sized to stand as tall as a G figure at the old 1.25; this keeps it
 * level with the G1 adults at the new scale.
 */
export const OBLIQUE_LEGACY_ADULT = OBLIQUE_FIGURE_SCALE / 1.25;

/** Party adults keep their world height when exploration enters combat. */
export function partyScale(projection: Projection | undefined, poseScale = 1): number {
  return (projection === 'oblique' ? OBLIQUE_FIGURE_SCALE : 1) * poseScale;
}

// An older 121px body needs the same adult world height as the newer 151px
// sheets.
const ADULT_ENEMIES: Readonly<Record<string, number>> = {
  'unit.enemy.crossbow': 1.23,
};

// An oblique 2x2 diamond is four upright tile-widths across. The Driller's
// 160px source cel is authored as a two-tile-wide orthographic figure, so it
// needs the projection's 2:1 horizontal compensation in oblique combat. It is
// sized by its footprint, not by an adult's height, so the figure scale does
// not apply to it.
const OBLIQUE_ENEMIES: Readonly<Record<string, number>> = {
  'unit.enemy.driller': 2,
};

/**
 * Shared by the visible body, effect sockets and exploration encounter markers.
 * An enemy drawn on a G sheet (the thug, ADR 0059; the quarry bandits, ADR
 * 0062) is packed at the party's size, so it stands at the party's scale; any
 * other adult enemy stands level with them on an oblique board.
 */
export function enemyScale(sprite: string, poseScale = 1, projection?: Projection): number {
  if (sheetLocomotion(sprite)?.headings === 8) return partyScale(projection, poseScale);
  const oblique = projection === 'oblique';
  const projectionScale = oblique ? (OBLIQUE_ENEMIES[sprite] ?? OBLIQUE_LEGACY_ADULT) : 1;
  return (ADULT_ENEMIES[sprite] ?? 1) * projectionScale * poseScale;
}
