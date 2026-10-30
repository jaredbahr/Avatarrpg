import type { ContentIndex, MapDef, Vec2 } from '../types';
import { buildGrid, distance, posKey, reachable, tileAt } from '../rules/grid';

/** Seat the returning party on reachable road, clear of painted rubble and props. */
export function battleReturnTile(content: ContentIndex, map: MapDef, crossing: Vec2): Vec2 | null {
  const grid = buildGrid(map);
  const props = new Set(map.props.map(({ pos }) => posKey(pos)));
  const rubble = map.scene?.paintedRubble ?? [];
  const clear = (pos: Vec2): boolean => {
    const tile = tileAt(grid, pos);
    return Boolean(
      tile &&
      !tile.blocked &&
      tile.surface?.id !== 'water' &&
      tile.surface?.id !== 'rubble' &&
      !props.has(posKey(pos)) &&
      rubble.every((cell) => distance(cell, pos) > 1),
    );
  };
  if (clear(crossing)) return crossing;

  const candidates = [
    ...reachable(
      {
        grid,
        blocked: props,
        surfaces: content.surfaces,
        size: 1,
        climbCost: content.tuning.climbCost,
      },
      crossing,
      grid.width * grid.height * 10,
    ).values(),
  ].filter(({ pos }) => clear(pos));
  const road = candidates.filter(({ pos }) => tileAt(grid, pos)?.terrain === 'road');
  const choices = road.length > 0 ? road : candidates;
  choices.sort(
    (a, b) =>
      a.path.length - b.path.length ||
      a.cost - b.cost ||
      distance(a.pos, crossing) - distance(b.pos, crossing) ||
      Number(b.pos.x > crossing.x) - Number(a.pos.x > crossing.x) ||
      Math.abs(a.pos.y - crossing.y) - Math.abs(b.pos.y - crossing.y) ||
      a.pos.y - b.pos.y ||
      a.pos.x - b.pos.x,
  );
  return choices[0]?.pos ?? null;
}
