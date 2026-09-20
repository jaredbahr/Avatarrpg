/**
 * Outlines of tile sets.
 *
 * A move range or a blast area is a set of tiles. Drawn as a square per tile
 * it reads as a grid of boxes; drawn as one rounded outline it reads as a
 * region on the ground, which is the feel a board without visible grid lines
 * needs. This traces the boundary of a tile set into closed loops (outer
 * edges and holes alike) and rounds them, in tile units, so both backends
 * draw the same shape from the same points.
 *
 * Pure geometry: no canvas, no camera, so it is unit-tested in Node.
 */

import type { Vec2 } from '../../core/types';

/** How far a corner is cut per rounding pass; 0.25 is Chaikin's classic. */
const CUT = 0.25;

/**
 * Directed edge around a tile, clockwise in screen space (y down): top edge
 * runs east, right edge south, bottom edge west, left edge north. Chaining
 * these gives outer loops running clockwise and holes counter-clockwise.
 */
const SIDES: readonly { dx: number; dy: number; from: Vec2; to: Vec2 }[] = [
  { dx: 0, dy: -1, from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
  { dx: 1, dy: 0, from: { x: 1, y: 0 }, to: { x: 1, y: 1 } },
  { dx: 0, dy: 1, from: { x: 1, y: 1 }, to: { x: 0, y: 1 } },
  { dx: -1, dy: 0, from: { x: 0, y: 1 }, to: { x: 0, y: 0 } },
];

const key = (p: Vec2): string => `${p.x},${p.y}`;

interface Edge {
  readonly from: Vec2;
  readonly to: Vec2;
  used: boolean;
}

/**
 * Traces the boundary of `tiles` into closed loops of corner points, in tile
 * units, where tile (x, y) covers [x, x + 1] × [y, y + 1].
 *
 * Tiles that touch only at a corner stay separate loops, because at a corner
 * shared by two regions the walk always takes the tightest right turn, which
 * keeps it on the tile it came from. A region with a gap inside it yields the
 * outer loop and the hole as two loops; `isHole` tells them apart.
 */
export function traceRegions(tiles: readonly Vec2[]): Vec2[][] {
  const members = new Set(tiles.map(key));
  const edges: Edge[] = [];
  const outgoing = new Map<string, Edge[]>();

  for (const tile of tiles) {
    for (const side of SIDES) {
      if (members.has(key({ x: tile.x + side.dx, y: tile.y + side.dy }))) continue;
      const edge: Edge = {
        from: { x: tile.x + side.from.x, y: tile.y + side.from.y },
        to: { x: tile.x + side.to.x, y: tile.y + side.to.y },
        used: false,
      };
      edges.push(edge);
      const list = outgoing.get(key(edge.from)) ?? [];
      list.push(edge);
      outgoing.set(key(edge.from), list);
    }
  }

  const loops: Vec2[][] = [];
  for (const start of edges) {
    if (start.used) continue;
    const loop: Vec2[] = [start.from];
    let current = start;
    current.used = true;
    for (;;) {
      const candidates = (outgoing.get(key(current.to)) ?? []).filter((e) => !e.used);
      if (candidates.length === 0) break;
      const next = candidates.length === 1 ? candidates[0] : tightestTurn(current, candidates);
      if (!next) break;
      if (key(next.from) === key(start.from) && next === start) break;
      loop.push(current.to);
      next.used = true;
      current = next;
      if (key(current.to) === key(start.from)) break;
    }
    if (loop.length >= 4) loops.push(loop);
  }
  return loops;
}

/** Of several edges leaving a corner, the one that turns right hardest. */
function tightestTurn(incoming: Edge, candidates: readonly Edge[]): Edge | undefined {
  const dx = incoming.to.x - incoming.from.x;
  const dy = incoming.to.y - incoming.from.y;
  let best: Edge | undefined;
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const cx = candidate.to.x - candidate.from.x;
    const cy = candidate.to.y - candidate.from.y;
    // Cross product in screen space: positive is a right (clockwise) turn.
    const cross = dx * cy - dy * cx;
    const dot = dx * cx + dy * cy;
    // Right turn first, then straight on, then left.
    const score = cross > 0 ? 2 : dot > 0 ? 1 : 0;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

/** Twice the signed area; negative for clockwise loops in screen space (y down). */
export function signedArea(loop: readonly Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    if (!a || !b) continue;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum;
}

/** A hole runs the opposite way round to an outer loop. */
export function isHole(loop: readonly Vec2[]): boolean {
  return signedArea(loop) < 0;
}

/**
 * Rounds a loop by cutting every corner, `iterations` times. Points along a
 * straight edge stay on it, so a long side stays straight and only the
 * corners soften. The cut is a fraction of each edge, which is why the loops
 * are rounded *before* collinear points are merged: on unit edges every
 * corner is cut a quarter tile in, whatever the length of the side, and no
 * tile in the set becomes ambiguous.
 */
export function chaikin(points: readonly Vec2[], iterations = 2, closed = true): Vec2[] {
  let current: Vec2[] = [...points];
  for (let pass = 0; pass < iterations; pass++) {
    const next: Vec2[] = [];
    const count = current.length;
    if (count < 3) return current;
    const last = closed ? count : count - 1;
    if (!closed) {
      const first = current[0];
      if (first) next.push(first);
    }
    for (let i = 0; i < last; i++) {
      const a = current[i];
      const b = current[(i + 1) % count];
      if (!a || !b) continue;
      next.push({ x: a.x + (b.x - a.x) * CUT, y: a.y + (b.y - a.y) * CUT });
      next.push({ x: a.x + (b.x - a.x) * (1 - CUT), y: a.y + (b.y - a.y) * (1 - CUT) });
    }
    if (!closed) {
      const end = current[count - 1];
      if (end) next.push(end);
    }
    current = next;
  }
  return current;
}

/** Drops points that sit on the straight line between their neighbours. */
export function simplify(loop: readonly Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  const count = loop.length;
  for (let i = 0; i < count; i++) {
    const prev = loop[(i - 1 + count) % count];
    const here = loop[i];
    const next = loop[(i + 1) % count];
    if (!prev || !here || !next) continue;
    const cross = (here.x - prev.x) * (next.y - here.y) - (here.y - prev.y) * (next.x - here.x);
    if (cross !== 0) out.push(here);
  }
  return out;
}

/** The outline of a tile set, traced and rounded, ready to draw. */
export function contourLoops(tiles: readonly Vec2[], iterations = 2): Vec2[][] {
  return traceRegions(tiles).map((loop) => chaikin(loop, iterations, true));
}
