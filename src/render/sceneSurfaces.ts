import type { SurfaceId, Tile, Vec2 } from '../core/types';
import { surfaceIntensity } from './surfaceRendering';
import type { MapView } from './view';

/**
 * Only complete registered art can replace a permanent surface's normal overlay.
 * A partial scene keeps every live overlay except its registered rubble cells:
 * their authored heap already carries the ink outline that marks the hazard,
 * and the wash over it drew the tile diamond the heap's spill is painted to hide.
 */
export function surfaceIsPainted(
  view: Pick<MapView, 'scene' | 'hatch' | 'crispOverlays'>,
  ready: boolean,
  tile: Tile,
  pos: Vec2,
): boolean {
  if (!ready || view.hatch || view.crispOverlays || !tile.surface || tile.surface.duration >= 0)
    return false;
  if (tile.surface.id === 'water')
    return view.scene?.groundMode !== 'partial' && view.scene?.paintedWater === true;
  return (
    tile.surface.id === 'rubble' &&
    tile.surface.spread === 0 &&
    (view.scene?.paintedRubble?.some((cell) => cell.x === pos.x && cell.y === pos.y) ?? false)
  );
}

/** A surface's slot in WebGL's map texel, packed as terrain * 8 + slot. */
export const SURFACE_INDEX: Record<SurfaceId, number> = {
  water: 1,
  ice: 2,
  fire: 3,
  mud: 4,
  steam: 5,
  oil: 6,
  rubble: 7,
};

/**
 * The slot and strength WebGL packs for a tile. Strength thins as a surface
 * burns down; art that replaces a surface keeps its slot at zero strength, so
 * the shader draws nothing there yet a neighbour of the same material meets it
 * without a bank, as Canvas's `surfaceEdges` reads the grid.
 */
export function surfaceTexel(tile: Tile, painted: boolean): [number, number] {
  const { surface } = tile;
  return surface
    ? [SURFACE_INDEX[surface.id] ?? 0, painted ? 0 : surfaceIntensity(surface.duration)]
    : [0, 0];
}
