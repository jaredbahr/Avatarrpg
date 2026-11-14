import { sheetLocomotion } from '../../content/assets/manifest';

/**
 * World px per art px for a party figure: the top-down and orthographic boards draw the art at its
 * own size, so this is only the pose's own scale. The oblique board's 1.25 figure scale (ADR 0094)
 * retired with it (ADR 0104 T7).
 */
export function partyScale(poseScale = 1): number {
  return poseScale;
}

/**
 * Shared by the visible body, effect sockets and exploration encounter markers.
 * An enemy drawn on an eight-heading sheet is packed at the party's size, so it
 * stands at the party's scale.
 */
export function enemyScale(sprite: string, poseScale = 1): number {
  if (sheetLocomotion(sprite)?.headings === 8) return partyScale(poseScale);
  return poseScale;
}
