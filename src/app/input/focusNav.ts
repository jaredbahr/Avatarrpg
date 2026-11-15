/**
 * Spatial focus (ADR 0112 §1, rule 3).
 *
 * On a screen made of ordinary controls a direction moves focus to the control
 * that lies that way, as a TV remote does. This is the geometry only: boxes in,
 * an index out, so the rule is tested without a browser.
 */

import type { Direction } from './actions';

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

interface Span {
  readonly near: number;
  readonly far: number;
}

const gap = (a: Span, b: Span): number => Math.max(0, a.near - b.far, b.near - a.far);
const middle = (span: Span): number => (span.near + span.far) / 2;

/**
 * The control a direction leads to from `from`, or null when none lies that
 * way. A control straight ahead (overlapping the one focus is on, seen along
 * the direction) is taken before one off to the side, and one within 45° of
 * the direction before one further round; within each, the nearest wins. So
 * Down from a column of buttons stays in the column while it has a next
 * button, and still reaches a row of buttons below and to the side.
 */
export function nextFocusIndex(
  boxes: readonly Box[],
  from: number,
  direction: Direction,
): number | null {
  const origin = boxes[from];
  if (!origin) return null;
  const horizontal = direction === 'left' || direction === 'right';
  const forward = direction === 'right' || direction === 'down' ? 1 : -1;
  // Along the direction, and across it.
  const along = (box: Box): Span =>
    horizontal ? { near: box.left, far: box.right } : { near: box.top, far: box.bottom };
  const across = (box: Box): Span =>
    horizontal ? { near: box.top, far: box.bottom } : { near: box.left, far: box.right };

  let best: { index: number; tier: number; score: number } | null = null;
  for (const [index, box] of boxes.entries()) {
    if (index === from) continue;
    const ahead = (middle(along(box)) - middle(along(origin))) * forward;
    if (ahead <= 0.5) continue;
    const side = gap(across(box), across(origin));
    const offset = Math.abs(middle(across(box)) - middle(across(origin)));
    const tier = side === 0 ? 0 : offset <= ahead ? 1 : 2;
    const distance = gap(along(box), along(origin));
    const score = distance + side * 3 + offset * 0.01 + ahead * 0.001;
    if (!best || tier < best.tier || (tier === best.tier && score < best.score))
      best = { index, tier, score };
  }
  return best?.index ?? null;
}
