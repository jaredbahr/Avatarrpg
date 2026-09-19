import type { Tile, Vec2 } from '../core/types';
import type { MapView } from './view';

/** Only complete registered art can replace a permanent surface's normal overlay. */
export function surfaceIsPainted(
  view: Pick<MapView, 'scene' | 'hatch' | 'crispOverlays'>,
  ready: boolean,
  tile: Tile,
  pos: Vec2,
): boolean {
  if (!ready || view.hatch || view.crispOverlays || !tile.surface || tile.surface.duration >= 0)
    return false;
  if (view.scene?.groundMode === 'partial') return false;
  if (tile.surface.id === 'water') return view.scene?.paintedWater === true;
  return (
    tile.surface.id === 'rubble' &&
    tile.surface.spread === 0 &&
    (view.scene?.paintedRubble?.some((cell) => cell.x === pos.x && cell.y === pos.y) ?? false)
  );
}
