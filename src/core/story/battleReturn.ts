import type { MapDef, Vec2 } from '../types';
import { buildGrid, distance, posKey, tileAt } from '../rules/grid';

/** Seat the returning party beside a crossing, clear of painted rubble and props. */
export function battleReturnTile(map: MapDef, crossing: Vec2): Vec2 | null {
  const grid = buildGrid(map);
  const props = new Set(map.props.map(({ pos }) => posKey(pos)));
  const rubble = map.scene?.paintedRubble ?? [];
  const candidates: Vec2[] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const pos = { x, y };
      if (distance(pos, crossing) === 0) continue;
      const tile = tileAt(grid, pos);
      if (!tile || tile.blocked || tile.surface?.id === 'water' || tile.surface?.id === 'rubble')
        continue;
      if (props.has(posKey(pos)) || rubble.some((cell) => distance(cell, pos) <= 1)) continue;
      candidates.push(pos);
    }
  }
  candidates.sort(
    (a, b) =>
      distance(a, crossing) - distance(b, crossing) ||
      Number(tileAt(grid, b)?.terrain === 'road') - Number(tileAt(grid, a)?.terrain === 'road') ||
      Number(b.x > crossing.x) - Number(a.x > crossing.x) ||
      Math.abs(a.y - crossing.y) - Math.abs(b.y - crossing.y) ||
      a.y - b.y ||
      a.x - b.x,
  );
  return candidates[0] ?? null;
}
