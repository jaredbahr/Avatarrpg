/**
 * Grid geometry, pathfinding and line of sight.
 *
 * Movement is 8-directional. Diagonals cost the same as orthogonal steps and
 * distance is Chebyshev (king-move) everywhere — for movement, for ability
 * range, and for blast radius. One metric for everything is far easier to
 * explain to an eight-year-old than "moves cost this, but range counts that".
 * Corner-cutting is forbidden: a diagonal step is only legal when both
 * orthogonal neighbours it passes between are walkable.
 */

import type {
  Ability,
  Grid,
  MapDef,
  SurfaceDef,
  SurfaceId,
  Tile,
  Unit,
  UnitSize,
  Vec2,
} from '../types';
import { SQUARE_FOOTPRINTS, footprintCells } from './footprint';

export const DIRECTIONS: readonly Vec2[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

export const ORTHOGONAL: readonly Vec2[] = DIRECTIONS.slice(0, 4);

export function vec(x: number, y: number): Vec2 {
  return { x, y };
}

export function posKey(p: Vec2): string {
  return `${p.x},${p.y}`;
}

export function keyToPos(key: string): Vec2 {
  const [x, y] = key.split(',');
  return { x: Number(x), y: Number(y) };
}

export function samePos(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y;
}

export function inBounds(grid: Grid, p: Vec2): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < grid.width && p.y < grid.height;
}

/** The only safe way to read a tile. Returns undefined outside the map. */
export function tileAt(grid: Grid, p: Vec2): Tile | undefined {
  if (!inBounds(grid, p)) return undefined;
  return grid.tiles[p.y * grid.width + p.x];
}

/** Chebyshev distance — the game's one and only distance metric. */
export function distance(a: Vec2, b: Vec2): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Straight-line distance, used only for tie-breaking so the AI looks sane. */
export function euclidean(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function neighbors(grid: Grid, p: Vec2): Vec2[] {
  const out: Vec2[] = [];
  for (const d of DIRECTIONS) {
    const n = { x: p.x + d.x, y: p.y + d.y };
    if (inBounds(grid, n)) out.push(n);
  }
  return out;
}

/**
 * Every cell a unit stands on. `size` is a side length, so 2 is a 2x2 block
 * until A-6, and the legacy 2x1 boss while the gate is off (see
 * `rules/footprint.ts`). Pass `square` to force the new geometry in tests.
 */
export function occupiedCells(
  unit: Pick<Unit, 'pos' | 'size'>,
  square: boolean = SQUARE_FOOTPRINTS,
): Vec2[] {
  return footprintCells(unit.pos, unit.size, square);
}

/** Whether a unit-targeted ability may resolve against its own caster. */
export function allowsCasterTarget(ability: Pick<Ability, 'targeting'>): boolean {
  if (ability.targeting.shape === 'self') return true;
  return ability.targeting.shape === 'unit' && ability.targeting.allow !== 'enemy';
}

/** Chebyshev distance from a point to the nearest cell of a possibly-large unit. */
export function distanceToUnit(
  from: Vec2,
  unit: Pick<Unit, 'pos' | 'size'>,
  square: boolean = SQUARE_FOOTPRINTS,
): number {
  let best = Infinity;
  for (const cell of occupiedCells(unit, square)) best = Math.min(best, distance(from, cell));
  return best;
}

/** Chebyshev distance between the nearest cells of two possibly-large units. */
export function distanceBetweenUnits(
  first: Pick<Unit, 'pos' | 'size'>,
  second: Pick<Unit, 'pos' | 'size'>,
  square: boolean = SQUARE_FOOTPRINTS,
): number {
  let best = Infinity;
  for (const cell of occupiedCells(first, square)) {
    best = Math.min(best, distanceToUnit(cell, second, square));
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Building a grid from an authored map                                */
/* ------------------------------------------------------------------ */

export const DEFAULT_TILE: Tile = {
  terrain: 'dirt',
  elevation: 0,
  blocked: false,
  blocksSight: false,
  cover: false,
  ramp: false,
  surface: null,
};

/**
 * Turns a MapDef's ASCII rows into a Grid. Unknown legend characters fall back
 * to plain dirt rather than throwing, because the content-validation test
 * already rejects them at a point where the error message is useful.
 */
export function buildGrid(map: MapDef): Grid {
  const tiles: Tile[] = [];
  for (let y = 0; y < map.height; y++) {
    const row = map.rows[y] ?? '';
    for (let x = 0; x < map.width; x++) {
      const ch = row[x] ?? '.';
      const template = map.legend[ch];
      if (!template) {
        tiles.push(DEFAULT_TILE);
        continue;
      }
      const blocked = template.blocked ?? template.terrain === 'wall';
      tiles.push({
        terrain: template.terrain,
        elevation: template.elevation ?? 0,
        blocked,
        blocksSight: template.blocksSight ?? blocked,
        cover: template.cover ?? false,
        ramp: template.ramp ?? false,
        surface: template.surface
          ? {
              id: template.surface,
              duration: template.surfaceDuration ?? -1,
              spread: 0,
            }
          : null,
      });
    }
  }
  return { width: map.width, height: map.height, tiles };
}

/**
 * `buildGrid`, memoised by `MapDef` object. An explore map's tiles never
 * change outside combat, so re-deriving a grid on every settle, reconcile or
 * tap is pure waste. Battle grids are built fresh (`BattleDraft` mutates its
 * own copy for walls, fire spread, etc.) — only callers of a static explore
 * grid should use this.
 */
const exploreGridCache = new WeakMap<MapDef, Grid>();

export function cachedGrid(map: MapDef): Grid {
  const cached = exploreGridCache.get(map);
  if (cached) return cached;
  const built = buildGrid(map);
  exploreGridCache.set(map, built);
  return built;
}

/** Replaces one tile, returning a new grid. Out-of-bounds writes are ignored. */
export function withTile(grid: Grid, p: Vec2, next: Tile): Grid {
  if (!inBounds(grid, p)) return grid;
  const tiles = [...grid.tiles];
  tiles[p.y * grid.width + p.x] = next;
  return { ...grid, tiles };
}

/** Replaces the surface on one tile. `surface: null` clears it. */
export function withSurface(
  grid: Grid,
  p: Vec2,
  surface: { id: SurfaceId; duration: number; spread: number } | null,
): Grid {
  const tile = tileAt(grid, p);
  if (!tile) return grid;
  return withTile(grid, p, { ...tile, surface });
}

/* ------------------------------------------------------------------ */
/* Occupancy                                                           */
/* ------------------------------------------------------------------ */

/** Map of cell key -> unit id, for every living unit. */
export function occupancy(
  units: readonly Unit[],
  square: boolean = SQUARE_FOOTPRINTS,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const u of units) {
    if (u.hp <= 0) continue;
    for (const cell of occupiedCells(u, square)) map.set(posKey(cell), u.id);
  }
  return map;
}

export function unitAt(
  units: readonly Unit[],
  p: Vec2,
  square: boolean = SQUARE_FOOTPRINTS,
): Unit | undefined {
  const key = posKey(p);
  return units.find((u) => u.hp > 0 && occupiedCells(u, square).some((c) => posKey(c) === key));
}

/* ------------------------------------------------------------------ */
/* Movement cost                                                       */
/* ------------------------------------------------------------------ */

export interface MoveContext {
  readonly grid: Grid;
  /** Cell key -> unit id. Cells held by other units are impassable. */
  readonly blocked: ReadonlySet<string>;
  readonly surfaces: ReadonlyMap<SurfaceId, SurfaceDef>;
  /** Footprint side length: every cell of the block must be free and legal. */
  readonly size: UnitSize;
  /**
   * TEMPORARY GATE (see `rules/footprint.ts`, removed in A-6): when true a size
   * 2 unit is a 2x2 square, when false/omitted it is the legacy 2x1. Defaults
   * to `SQUARE_FOOTPRINTS`, so every shipped caller keeps today's behaviour.
   */
  readonly squareFootprints?: boolean;
  /**
   * Extra move points a one-tier climb costs, from
   * `content.tuning.climbCost`. Every shipped context carries it, combat and
   * explore alike. A context that omits it declares no climb rule at all, and
   * a climb in one is refused rather than silently made free — the safe
   * default for a caller that forgot to pass the tuning.
   */
  readonly climbCost?: number;
}

/**
 * Occupancy and surface cost of a footprint on `p`: every cell in bounds and
 * unblocked, none held by another unit, plus the worst surface `moveCost` once.
 * No elevation rule — `standCost` layers that on; `enterCost` deliberately does
 * not, so a large unit can haul itself across a one-tier step.
 */
function footprintCost(ctx: MoveContext, p: Vec2): number | null {
  const square = ctx.squareFootprints ?? SQUARE_FOOTPRINTS;
  const cells = footprintCells(p, ctx.size, square);
  let cost = 1;
  for (const cell of cells) {
    const tile = tileAt(ctx.grid, cell);
    if (!tile || tile.blocked) return null;
    if (ctx.blocked.has(posKey(cell))) return null;
    if (tile.surface) {
      const def = ctx.surfaces.get(tile.surface.id);
      if (def) cost = Math.max(cost, 1 + def.moveCost);
    }
  }
  return cost;
}

/**
 * Cost of putting the unit's whole footprint on `p`, or null when it may not
 * *stand* there. Used for a spawn, a projected destination or a free cell
 * search, and to decide where a move may stop.
 *
 * A 2x2 may stand only on flat ground: all four of its cells must share one
 * elevation. Gated with the square footprint, so the legacy 2x1 boss keeps its
 * old, tier-straddling standability until A-6.
 */
export function standCost(ctx: MoveContext, p: Vec2): number | null {
  const cost = footprintCost(ctx, p);
  if (cost === null) return null;
  const square = ctx.squareFootprints ?? SQUARE_FOOTPRINTS;
  if (!square) return cost;
  let elevation: number | null = null;
  for (const cell of footprintCells(p, ctx.size, square)) {
    const tile = tileAt(ctx.grid, cell);
    if (!tile) return null;
    if (elevation === null) elevation = tile.elevation;
    else if (tile.elevation !== elevation) return null;
  }
  return cost;
}

/**
 * Surcharge for one cell of a step, or null when that cell's step is illegal.
 *
 * A climb of a single tier adds `ctx.climbCost` move points unless either end
 * is a ramp; a drop is free; and a cliff of two or more tiers cannot be
 * crossed in either direction.
 */
function stepClimb(ctx: MoveContext, from: Vec2, to: Vec2): number | null {
  const fromTile = tileAt(ctx.grid, from);
  const toTile = tileAt(ctx.grid, to);
  if (!fromTile || !toTile) return null;
  const tiers = toTile.elevation - fromTile.elevation;
  if (tiers >= 2 || tiers <= -2) return null;
  if (tiers < 1) return 0;
  if (fromTile.ramp || toTile.ramp) return 0;
  return ctx.climbCost ?? null;
}

/**
 * Cost of *entering* `to` from `from`, or null when the step cannot be taken.
 *
 * A large unit steps every cell of its footprint, pairing each one with the cell
 * it comes from: the step is refused when any pair meets a cliff or an unpayable
 * climb, and it pays the worst pair's surcharge once, the same way the footprint
 * pays the worst surface once.
 */
export function enterCost(ctx: MoveContext, from: Vec2, to: Vec2): number | null {
  // Step legality is not standing legality: a 2x2 may cross a one-tier step
  // (straddling it for a moment) even though it may not stop there. The
  // per-cell climb pairing below is what prices and refuses the step.
  const base = footprintCost(ctx, to);
  if (base === null) return null;
  const climb = climbSurcharge(ctx, from, to);
  if (climb === null) return null;
  return base + climb;
}

/** The climb portion of one step's move cost, or null when the step is illegal. */
export function climbSurcharge(ctx: MoveContext, from: Vec2, to: Vec2): number | null {
  const square = ctx.squareFootprints ?? SQUARE_FOOTPRINTS;
  let climb = 0;
  for (const offset of footprintCells({ x: 0, y: 0 }, ctx.size, square)) {
    const cell = stepClimb(
      ctx,
      { x: from.x + offset.x, y: from.y + offset.y },
      { x: to.x + offset.x, y: to.y + offset.y },
    );
    if (cell === null) return null;
    climb = Math.max(climb, cell);
  }
  return climb;
}

/** A diagonal step may not squeeze between impassable orthogonal neighbours. */
function diagonalAllowed(ctx: MoveContext, from: Vec2, to: Vec2): boolean {
  if (from.x === to.x || from.y === to.y) return true;
  // Check the mover's whole footprint, including units standing in the gap.
  return (
    enterCost(ctx, from, { x: to.x, y: from.y }) !== null &&
    enterCost(ctx, from, { x: from.x, y: to.y }) !== null
  );
}

export interface ReachableCell {
  readonly pos: Vec2;
  readonly cost: number;
  /** Tiles walked through, excluding the start and including this cell. */
  readonly path: readonly Vec2[];
}

/**
 * Dijkstra over move points. Returns every cell reachable within `budget`,
 * keyed by position. Used for the move highlight, for pathing, and by the AI
 * when it enumerates (tile, ability, target) triples.
 *
 * The result is the set of cells the unit may *stop* on. A 2x2 may pass through
 * a cell whose footprint straddles a one-tier step, but it may not rest there,
 * so those cells stay out of the map while still being expanded through.
 */
export function reachable(
  ctx: MoveContext,
  start: Vec2,
  budget: number,
): Map<string, ReachableCell> {
  const best = new Map<string, ReachableCell>();
  const stops = new Map<string, ReachableCell>();
  const startEntry: ReachableCell = { pos: start, cost: 0, path: [] };
  best.set(posKey(start), startEntry);
  stops.set(posKey(start), startEntry);

  // Small budgets over a 20x12 grid: a sorted frontier is plenty.
  const frontier: ReachableCell[] = [startEntry];

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.cost - b.cost);
    const current = frontier.shift();
    if (!current) break;
    const known = best.get(posKey(current.pos));
    if (known && known.cost < current.cost) continue;

    for (const d of DIRECTIONS) {
      const next = { x: current.pos.x + d.x, y: current.pos.y + d.y };
      if (!inBounds(ctx.grid, next)) continue;
      if (!diagonalAllowed(ctx, current.pos, next)) continue;
      const step = enterCost(ctx, current.pos, next);
      if (step === null) continue;
      const cost = current.cost + step;
      if (cost > budget) continue;
      const key = posKey(next);
      const prior = best.get(key);
      if (prior && prior.cost <= cost) continue;
      const entry: ReachableCell = {
        pos: next,
        cost,
        path: [...current.path, next],
      };
      best.set(key, entry);
      if (standCost(ctx, next) !== null) stops.set(key, entry);
      frontier.push(entry);
    }
  }

  return stops;
}

/** Shortest path from `start` to `goal` within `budget`, or null. */
export function findPath(
  ctx: MoveContext,
  start: Vec2,
  goal: Vec2,
  budget: number,
): ReachableCell | null {
  if (samePos(start, goal)) return { pos: start, cost: 0, path: [] };
  return reachable(ctx, start, budget).get(posKey(goal)) ?? null;
}

/**
 * Cost of walking an explicit path. Returns null if any step is illegal, which
 * is how the reducer validates a path that arrived from the UI (or a save file)
 * rather than trusting it.
 */
export function pathCost(ctx: MoveContext, start: Vec2, path: readonly Vec2[]): number | null {
  let from = start;
  let total = 0;
  for (const step of path) {
    if (distance(from, step) !== 1) return null;
    if (!diagonalAllowed(ctx, from, step)) return null;
    const cost = enterCost(ctx, from, step);
    if (cost === null) return null;
    total += cost;
    from = step;
  }
  // A move ends where the unit stands, so the destination footprint must be
  // flat even though individual straddling steps were legal.
  if (path.length > 0 && standCost(ctx, from) === null) return null;
  return total;
}

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

/** Every in-bounds tile within Chebyshev `radius` of `center`, center included. */
export function blastTiles(grid: Grid, center: Vec2, radius: number): Vec2[] {
  const out: Vec2[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const p = { x: center.x + dx, y: center.y + dy };
      if (inBounds(grid, p)) out.push(p);
    }
  }
  return out;
}

/**
 * Tiles along a ray from `origin` toward `target`, excluding the origin.
 * Stops at the first sight-blocking tile so a Fire Wall cannot be cast through
 * a cliff. Length is measured in tiles, not in steps of the ray.
 */
export function lineTiles(grid: Grid, origin: Vec2, target: Vec2, length: number): Vec2[] {
  const dx = Math.sign(target.x - origin.x);
  const dy = Math.sign(target.y - origin.y);
  if (dx === 0 && dy === 0) return [];

  // Snap to the nearest of the eight compass rays so the preview always
  // matches what the player tapped.
  const out: Vec2[] = [];
  let cursor = origin;
  for (let i = 0; i < length; i++) {
    cursor = { x: cursor.x + dx, y: cursor.y + dy };
    if (!inBounds(grid, cursor)) break;
    out.push(cursor);
    const tile = tileAt(grid, cursor);
    if (tile?.blocked) break;
  }
  return out;
}

/**
 * A widening wedge from `origin` toward `target`. Row 1 is one tile, row 2 is
 * three, row 3 is five — the classic tactics cone, cheap to compute and easy
 * to read on the grid.
 */
export function coneTiles(grid: Grid, origin: Vec2, target: Vec2, length: number): Vec2[] {
  const dx = Math.sign(target.x - origin.x);
  const dy = Math.sign(target.y - origin.y);
  if (dx === 0 && dy === 0) return [];

  const out: Vec2[] = [];
  const seen = new Set<string>();
  for (let step = 1; step <= length; step++) {
    const center = { x: origin.x + dx * step, y: origin.y + dy * step };
    const spread = step - 1;
    for (let offset = -spread; offset <= spread; offset++) {
      // Spread perpendicular to the ray. For diagonals that means walking the
      // anti-diagonal, which keeps the wedge symmetric.
      const p =
        dx === 0
          ? { x: center.x + offset, y: center.y }
          : dy === 0
            ? { x: center.x, y: center.y + offset }
            : { x: center.x - dx * Math.max(0, offset), y: center.y + dy * Math.max(0, -offset) };
      if (!inBounds(grid, p)) continue;
      const key = posKey(p);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

/**
 * Connected run of a surface starting at `from`, walking orthogonally.
 * Lightning into a puddle shocks the whole puddle, and this is the puddle.
 */
export function connectedSurface(grid: Grid, from: Vec2, surface: SurfaceId): Vec2[] {
  const start = tileAt(grid, from);
  if (!start || start.surface?.id !== surface) return [];

  const out: Vec2[] = [];
  const seen = new Set<string>([posKey(from)]);
  const queue: Vec2[] = [from];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    out.push(current);
    for (const d of ORTHOGONAL) {
      const n = { x: current.x + d.x, y: current.y + d.y };
      const key = posKey(n);
      if (seen.has(key)) continue;
      const tile = tileAt(grid, n);
      if (!tile || tile.surface?.id !== surface) continue;
      seen.add(key);
      queue.push(n);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Line of sight                                                       */
/* ------------------------------------------------------------------ */

/**
 * The cells strictly between `from` and `to` on the symmetric Bresenham line.
 * Neither endpoint is included, so an origin or a destination tile can never
 * block (or obscure) its own line. Obscurement walks the same path as sight so
 * the two can never disagree about which tiles a shot crosses.
 */
export function lineBetween(from: Vec2, to: Vec2): Vec2[] {
  const cells: Vec2[] = [];
  if (samePos(from, to)) return cells;

  let x0 = from.x;
  let y0 = from.y;
  const x1 = to.x;
  const y1 = to.y;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  for (;;) {
    if (x0 === x1 && y0 === y1) return cells;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
    if (x0 === x1 && y0 === y1) return cells;
    cells.push({ x: x0, y: y0 });
  }
}

/**
 * Symmetric Bresenham line of sight. The origin and destination tiles never
 * block; anything between them that is `blocksSight` (a wall, a solid prop or
 * a tree) does. Steam and weather never block sight — they obscure, so the
 * shot can still be taken, at a penalty the preview shows.
 */
export function hasLineOfSight(grid: Grid, from: Vec2, to: Vec2): boolean {
  for (const cell of lineBetween(from, to)) {
    const tile = tileAt(grid, cell);
    if (!tile) return false;
    if (tile.blocksSight) return false;
  }
  return true;
}
