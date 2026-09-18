import type { Grid, Vec2 } from '../../core/types';

export const ELEVATION_LIFT = 0.06;

export function elevationAt(grid: Grid, pos: Vec2): number {
  if (pos.x < 0 || pos.y < 0 || pos.x >= grid.width || pos.y >= grid.height) return 0;
  return grid.tiles[pos.y * grid.width + pos.x]?.elevation ?? 0;
}
