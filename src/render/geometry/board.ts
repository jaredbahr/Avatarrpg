/**
 * What the tiles imply for drawing, worked out once per grid.
 *
 * The rules keep elevation, blocking and surfaces per tile; a picture needs
 * them per edge: which way a ledge faces, where a pool meets dry ground, which
 * sides of a wall run look out on open ground. Pure functions over the grid,
 * shared by both backends so a fight reads the same on each (ADR 0002). None
 * of this is per frame: the backends key the result on a signature of the
 * grid and rebuild only when a tile's footing changes.
 */

import type { Grid, TerrainId, Tile, Vec2 } from '../../core/types';

export interface Edges {
  readonly n: boolean;
  readonly e: boolean;
  readonly s: boolean;
  readonly w: boolean;
}

/**
 * The relief of one tile: what stands above it and what it stands above.
 *
 * Elevation is drawn as cliff bands (ADR 0008). The raised tile keeps its
 * place, so taps and the camera never move; the step down is a face drawn
 * inside the *lower* tile along the edge it shares with the ledge. From the
 * three-quarter view only a south-facing step shows its face; a step to the
 * side shows as a shadow line.
 */
export interface TileRelief {
  /** Tiers the ground drops from the tile to the north, when that tile is higher. */
  readonly faceDrop: number;
  /** Tiers the tile to the west / east stands above this one. */
  readonly westDrop: number;
  readonly eastDrop: number;
  /** For a raised tile: which of its edges look down on lower ground. */
  readonly rim: Edges | null;
  /** For a blocked tile that is not a tree (a wall, a hut, a pit): which of its edges face open ground. */
  readonly solid: Edges | null;
  /**
   * What each edge looks out on, in n/e/s/w order: the neighbour's ground
   * material, or null where the join needs no dressing. The neighbour's
   * material is what the painter bleeds into this tile, so a road ends under
   * grass rather than on a bare line.
   */
  readonly seams: readonly (SeamMaterial | null)[] | null;
}

/**
 * A ground material as a join sees it. Standing water is its own material, so
 * the pond joins a dry bank the same way the road joins grass — the rules care
 * about the tile's surface, and the picture cares about what the edge meets.
 */
export type SeamMaterial = TerrainId | 'water';

const NONE: Edges = { n: false, e: false, s: false, w: false };

function at(grid: Grid, x: number, y: number): Tile | undefined {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return undefined;
  return grid.tiles[y * grid.width + x];
}

const any = (edges: Edges): boolean => edges.n || edges.e || edges.s || edges.w;

/** A tree is blocked grass; every other blocked tile is a built or rocky mass. */
export function isCanopy(tile: Tile): boolean {
  return tile.blocked && tile.terrain === 'grass';
}

/** Relief for every tile that has any, keyed by the tile's index in the grid. */
export function boardRelief(grid: Grid): ReadonlyMap<number, TileRelief> {
  const out = new Map<number, TileRelief>();
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const tile = at(grid, x, y);
      if (!tile) continue;
      const north = at(grid, x, y - 1);
      const west = at(grid, x - 1, y);
      const east = at(grid, x + 1, y);
      const south = at(grid, x, y + 1);

      const faceDrop = north ? Math.max(0, north.elevation - tile.elevation) : 0;
      const westDrop = west ? Math.max(0, west.elevation - tile.elevation) : 0;
      const eastDrop = east ? Math.max(0, east.elevation - tile.elevation) : 0;

      const lower = (other: Tile | undefined): boolean =>
        other !== undefined && other.elevation < tile.elevation;
      const rimEdges: Edges = {
        n: lower(north),
        e: lower(east),
        s: lower(south),
        w: lower(west),
      };
      const rim = tile.elevation > 0 && any(rimEdges) ? rimEdges : null;

      const open = (other: Tile | undefined): boolean =>
        other !== undefined && !(other.blocked && !isCanopy(other));
      const solidEdges: Edges =
        tile.blocked && !isCanopy(tile)
          ? { n: open(north), e: open(east), s: open(south), w: open(west) }
          : NONE;
      const solid = any(solidEdges) ? solidEdges : null;

      // A blocked tile is a mass standing on the ground, so it has no join of
      // its own; the ground around it is dressed by the open tiles themselves.
      const mine = material(tile);
      // A join is ground meeting ground: a ledge keeps its cliff face, and two
      // tiles of one material need nothing between them.
      const join = (other: Tile | undefined): SeamMaterial | null =>
        other && other.elevation === tile.elevation && material(other) !== mine
          ? material(other)
          : null;
      const sides = [join(north), join(east), join(south), join(west)];
      const seams = !tile.blocked && sides.some((other) => other !== null) ? sides : null;

      if (faceDrop === 0 && westDrop === 0 && eastDrop === 0 && !rim && !solid && !seams) continue;
      out.set(y * grid.width + x, { faceDrop, westDrop, eastDrop, rim, solid, seams });
    }
  }
  return out;
}

/** The material a tile's ground presents to the edges around it. */
export function seamMaterial(tile: Tile): SeamMaterial {
  if (tile.surface?.id === 'water' || tile.terrain === 'water_deep') return 'water';
  return tile.terrain;
}

/** The material an edge of a tile meets, or null off the map. */
function material(tile: Tile | undefined): SeamMaterial | null {
  return tile ? seamMaterial(tile) : null;
}

/**
 * Which sides of a surfaced tile border something other than the same
 * surface, so a pool can be drawn as one shape with a rim round the outside
 * instead of a rim round every tile. Off the map counts as a bank.
 */
export function surfaceEdges(grid: Grid, pos: Vec2): Edges {
  const tile = at(grid, pos.x, pos.y);
  const id = tile?.surface?.id ?? null;
  if (!id) return NONE;
  const differs = (other: Tile | undefined): boolean => (other?.surface?.id ?? null) !== id;
  return {
    n: differs(at(grid, pos.x, pos.y - 1)),
    e: differs(at(grid, pos.x + 1, pos.y)),
    s: differs(at(grid, pos.x, pos.y + 1)),
    w: differs(at(grid, pos.x - 1, pos.y)),
  };
}

/**
 * The decor the WebGL backend bakes is cut into square chunks of this many
 * tiles, so a chunk at the sharpest bake still fits the 2048 px texture limit
 * every iPad accepts and a big explore map is a handful of textures.
 */
export const DECOR_CHUNK = 8;

export function decorChunks(grid: Grid): { cols: number; rows: number } {
  return {
    cols: Math.ceil(grid.width / DECOR_CHUNK),
    rows: Math.ceil(grid.height / DECOR_CHUNK),
  };
}

/**
 * Everything the decor depends on, so a backend knows when to rebuild it.
 * Standing water is in here because it is a join material: a puddle that
 * appears or dries changes the shore the ground around it is dressed with.
 */
export function decorSignature(grid: Grid): string {
  let signature = `${grid.width}x${grid.height}`;
  for (const tile of grid.tiles) {
    signature += `|${tile.terrain}${tile.elevation}${tile.blocked ? 'b' : ''}${tile.cover ? 'c' : ''}${
      tile.surface?.id === 'water' ? 'w' : ''
    }`;
  }
  return signature;
}
