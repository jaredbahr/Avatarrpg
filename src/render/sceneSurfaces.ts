import type { Tile, Vec2 } from '../core/types';
import type { MapView } from './view';

type SurfaceView = Pick<MapView, 'scene' | 'hatch' | 'crispOverlays'>;

/** Complete art is ready for a permanent surface and nothing asks for the plain overlay. */
function permanentArt(view: SurfaceView, ready: boolean, tile: Tile): boolean {
  return ready && !view.hatch && !view.crispOverlays && !!tile.surface && tile.surface.duration < 0;
}

/** The scene paints a heap on this cell and the rules still hold that heap there. */
function registeredHeap(view: SurfaceView, tile: Tile, pos: Vec2): boolean {
  return (
    tile.surface?.id === 'rubble' &&
    tile.surface.spread === 0 &&
    (view.scene?.paintedRubble?.some((cell) => cell.x === pos.x && cell.y === pos.y) ?? false)
  );
}

/** Only complete registered art can replace a permanent surface's normal overlay. */
export function surfaceIsPainted(
  view: SurfaceView,
  ready: boolean,
  tile: Tile,
  pos: Vec2,
): boolean {
  if (!permanentArt(view, ready, tile) || view.scene?.groundMode === 'partial') return false;
  if (tile.surface?.id === 'water') return view.scene?.paintedWater === true;
  return registeredHeap(view, tile, pos);
}

/**
 * A partial scene keeps every live overlay, but over its own heap art the
 * rubble wash is seated: it gathers under the pile and fades out inside the
 * cell instead of filling the cell and inking its bank. The bank is how
 * ability rubble, which has no heap art, reads on any ground; round a painted
 * heap it drew the cell's diamond on the spill the heap stands on.
 */
export function surfaceIsSeated(view: SurfaceView, ready: boolean, tile: Tile, pos: Vec2): boolean {
  return (
    permanentArt(view, ready, tile) &&
    view.scene?.groundMode === 'partial' &&
    registeredHeap(view, tile, pos)
  );
}
