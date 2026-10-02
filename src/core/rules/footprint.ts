/**
 * Unit footprints.
 *
 * `size` is a side length in tiles: 1 is a single tile and 2 is a 2x2 block.
 * A unit is anchored on the top-left cell of its block — the minimum x and
 * minimum y — so the extra cells always extend right and down from `pos`.
 *
 * TEMPORARY COMPATIBILITY GATE — keep until the post-A-6 plumbing cleanup.
 * The Driller spec (approved 2026-09-30) makes size 2 a 2x2 square that may
 * only stand on flat ground. A-6 flipped the shipped semantics together with
 * the Driller content. While `SQUARE_FOOTPRINTS` is false,
 * size 2 resolves to the old 2-wide, 1-tall cell set. Every consumer takes the
 * flag as an optional parameter (defaulting to this constant), which lets tests
 * exercise the legacy geometry without mutating module state. A later cleanup
 * deletes the constant and legacy branch, leaving `footprintCells(pos, size)`.
 */

import type { UnitSize, Vec2 } from '../types';

/** Size 2 is a 2x2 square in shipped play; false remains injectable for compatibility tests. */
export const SQUARE_FOOTPRINTS = true;

/**
 * The cells a unit anchored at `pos` occupies, row-major: the anchor, the cell
 * to its right, the cell below, then the cell below-right. A size-1 unit is its
 * anchor alone. With `square` false, size 2 is the legacy 2x1 pair instead.
 */
export function footprintCells(
  pos: Vec2,
  size: UnitSize,
  square: boolean = SQUARE_FOOTPRINTS,
): Vec2[] {
  if (size === 1) return [{ x: pos.x, y: pos.y }];
  if (!square) {
    return [
      { x: pos.x, y: pos.y },
      { x: pos.x + 1, y: pos.y },
    ];
  }
  return [
    { x: pos.x, y: pos.y },
    { x: pos.x + 1, y: pos.y },
    { x: pos.x, y: pos.y + 1 },
    { x: pos.x + 1, y: pos.y + 1 },
  ];
}

/**
 * The unit's "foot": the centre of its front (bottom) row, in tile units. An
 * anchor-relative point for presentation code that wants the ground contact
 * rather than the top-left corner — size 1 lands at {x+0.5, y+0.5}.
 *
 * With the square gate on, the front row is the block's bottom row; with it off
 * the legacy 2x1 keeps its single-row foot one tile right of the anchor. Mirrors
 * `footprintCells`, so consumers can pass the same flag they use there.
 */
export function footprintFoot(
  pos: Vec2,
  size: UnitSize,
  square: boolean = SQUARE_FOOTPRINTS,
): Vec2 {
  if (size === 1) return { x: pos.x + 0.5, y: pos.y + 0.5 };
  if (!square) return { x: pos.x + size / 2, y: pos.y + 0.5 };
  return { x: pos.x + size / 2, y: pos.y + size - 0.5 };
}

/**
 * The one-tile step a push or pull takes, shared by `BattleDraft.slideFrom` and
 * the confirm-step forecast so the two can never disagree on direction.
 *
 * With the square gate on, the direction is an interval: a push moves away from
 * the origin along each axis and a pull toward it, and an origin level with — or
 * inside — the footprint contributes no motion on that axis. That is what stops
 * a 2x2 from sliding sideways when the shover lines up with its middle. With the
 * gate off the original anchor-relative `sign()` is kept, because it is what the
 * shipped 2x1 boss and every existing test were tuned against. For size 1 the
 * two forms are identical.
 */
export function shoveStep(
  from: Vec2,
  origin: Vec2,
  size: UnitSize,
  mode: 'push' | 'pull',
  square: boolean = SQUARE_FOOTPRINTS,
): Vec2 {
  const sign = mode === 'push' ? 1 : -1;
  if (!square) {
    return { x: Math.sign(from.x - origin.x) * sign, y: Math.sign(from.y - origin.y) * sign };
  }
  const cells = footprintCells(from, size, true);
  const minX = Math.min(...cells.map((cell) => cell.x));
  const maxX = Math.max(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  const maxY = Math.max(...cells.map((cell) => cell.y));
  return {
    x: (origin.x < minX ? 1 : origin.x > maxX ? -1 : 0) * sign,
    y: (origin.y < minY ? 1 : origin.y > maxY ? -1 : 0) * sign,
  };
}
