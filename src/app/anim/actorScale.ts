import type { Projection } from '../../render/projection';
import { sheetLocomotion } from '../../content/assets/manifest';

/**
 * World px per art px for a figure on an oblique board (ADR 0094 and its
 * amendment; owner, 28 October 2026: "1.25× now, redraw later"). The Ba Dan
 * painting and the forest were built round adults about 74 world px tall, so
 * the G1 figures (59 art px) are drawn at 1.25 and resample soft, by the
 * owner's choice, until a native redraw at that height. At 1 they were crisp
 * but stood small beside the doors and tables.
 */
export const OBLIQUE_FIGURE_SCALE = 1.25;

/**
 * Adult art not drawn on the G1 grid (the older enemy and placeholder sheets)
 * was sized to stand as tall as a G figure at 1.25; this keeps it level with
 * the G1 adults at whatever scale they draw (1 at 1.25).
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
