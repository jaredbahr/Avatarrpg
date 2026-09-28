/** Riverside positions use tile-centre ground contacts, just like navigation. */
import type { Vec2 } from '../../core/types';

export const FOOT_Y = 0.5;

/** The life layer draws a figure this many tiles to 128 atlas pixels. */
export const FIGURE_SCALE = 1.45;

/**
 * Walk clip time on the riverside, from the animator's. A four-way sheet
 * plays a fixed 500 ms a tile, a cadence rather than a stride, and keeps it.
 * An eight-way sheet's `walkMsPerTile` is its measured stride at one tile to
 * 128 atlas px (ADR 0050); drawn here at `FIGURE_SCALE`, the same stride
 * covers that much more ground, so the clip runs that much less a tile or
 * the feet slide backwards (ADR 0054).
 */
export function riversideWalkTime(clipTime: number, eightWay: boolean): number {
  return eightWay ? clipTime / FIGURE_SCALE : clipTime;
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
