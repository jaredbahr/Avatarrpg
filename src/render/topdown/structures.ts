/**
 * The Earth Wall and rubble on top-down boards (#577). Neither is a prop in the rules: a raised wall
 * is a tile `BattleDraft.raiseWall` swapped for a blocked `wall` (journalled in `temporaryWalls`),
 * and rubble is a surface. The top-down board stands each as a drawing among the figures, through
 * the props' path (#459): `TOPDOWN_OBJECTS` drawings, seated on the cached `hardShadowMask`, sorted
 * by the cell's foot line like a prop.
 *
 * - a **wall** stands on every cell the view lists as raised (`raisedWalls`) whose tile is still a
 *   blocked `wall`, and that no scenery piece of the scene already covers: authored masonry is never
 *   in the journal, and an expired wall has left both the journal and the tile;
 * - a **heap** stands on every `rubble` surface cell the scene does not paint itself
 *   (`paintedRubble`).
 *
 * Read from the view model only, as `sceneForGrid` reads the grid; nothing here touches the rules.
 */
import type { Vec2 } from '../../core/types';
import type { MapView, RenderProp } from '../view';

const key = (p: Vec2): string => `${p.x},${p.y}`;

/** The wall and rubble drawings the board stands, as props (no hp bar, no oblique fallback sprite). */
export function topdownStructures(
  view: Pick<MapView, 'grid' | 'scene' | 'raisedWalls'>,
): RenderProp[] {
  const { grid } = view;
  const scenery = new Set(
    (view.scene?.scenery ?? []).flatMap((piece) => (piece.footprint ?? []).map(key)),
  );
  const out: RenderProp[] = [];
  for (const pos of view.raisedWalls ?? []) {
    const tile = grid.tiles[pos.y * grid.width + pos.x];
    if (!tile || tile.terrain !== 'wall' || !tile.blocked || scenery.has(key(pos))) continue;
    out.push(structure(`wall:${key(pos)}`, 'earth_wall', pos, 'Earth wall'));
  }
  const painted = new Set((view.scene?.paintedRubble ?? []).map(key));
  grid.tiles.forEach((tile, i) => {
    if (tile.surface?.id !== 'rubble') return;
    const pos = { x: i % grid.width, y: Math.floor(i / grid.width) };
    if (!painted.has(key(pos))) out.push(structure(`rubble:${key(pos)}`, 'rubble', pos, 'Rubble'));
  });
  return out;
}

function structure(id: string, kind: string, pos: Vec2, name: string): RenderProp {
  // An empty sprite: until its drawing loads it draws nothing, since the cell already shows it.
  return { id, kind, pos, sprite: '', name, hp: 1, maxHp: 1 };
}

/** The view a top-down board draws: its props, then its raised walls and rubble heaps. */
export function withStructures(view: MapView): MapView {
  const extra = topdownStructures(view);
  return extra.length ? { ...view, props: [...view.props, ...extra] } : view;
}
