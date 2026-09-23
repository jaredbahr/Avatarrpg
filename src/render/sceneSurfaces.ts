import type { Tile, Vec2 } from '../core/types';
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
