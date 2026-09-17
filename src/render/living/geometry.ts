/** Riverside positions use tile-centre ground contacts, just like navigation. */
import type { Vec2 } from '../../core/types';

export const FOOT_Y = 0.5;

/** The river sheets carry four poses at 8 fps; a two-tile stride is 500 clip ms.
 * Animator time is 500 ms per tile for the ordinary two-pose, 4 fps sheets.
 */
export function riversideWalkTime(clipTime: number, illustrated: boolean): number {
  return illustrated ? clipTime / 2 : clipTime;
}

/** Tight world-space bounds around a standing villager, above its feet. */
export function hitsVillager(point: Vec2, pos: Vec2): boolean {
  const dx = point.x - (pos.x + 0.5);
  const dy = point.y - (pos.y + FOOT_Y);
  return Math.abs(dx) <= 0.38 && dy >= -1.2 && dy <= 0.08;
}

/** Pebble is painted sideways; target the body, not a radius of nearby road. */
export function hitsPebble(point: Vec2, pos: Vec2): boolean {
  return Math.abs(point.x - (pos.x + 0.55)) <= 0.7 && Math.abs(point.y - (pos.y + 0.6)) <= 0.35;
}
