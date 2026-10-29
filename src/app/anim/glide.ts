import type { Vec2 } from '../../core/types';

/**
 * The point a glide from `from` to `to` has reached `elapsed` ms in: an
 * ease-in-out over `ms`, arriving exactly at `to` (and at once when `ms` is 0).
 */
export function glidePoint(from: Vec2, to: Vec2, elapsed: number, ms: number): Vec2 {
  const t = ms <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / ms));
  const k = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
}
