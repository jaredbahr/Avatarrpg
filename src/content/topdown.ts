/**
 * The top-down presentation swap (ADR 0104, phase T3): under `?style=topdown` a map registered
 * here is drawn in the top-down style, with its own scene, instead of its oblique painting.
 *
 * Presentation only. The swap replaces a map's `projection` and `scene` and drops the fields that
 * describe the oblique art (`backdrop`, `cameraPaint`); every rules field (rows, legend, spawns,
 * npcs, props, exits, triggers, edges and the rest) stays the very same object, so the rules, the
 * edge contract and saves never tell the two styles apart. Positions stay whole logical cells.
 */
import type { ContentIndex, MapDef, MapScene } from '../core/types';

/** What a map draws as in the top-down style. */
export interface TopDownPresentation {
  readonly projection: 'topdown';
  /** The baked ground plates and scenery, in top-down world px (40 a tile, one art px a world px). */
  readonly scene: MapScene;
  /** Replaces the map's own `cameraCentreMargin` when set; the map's is kept otherwise. */
  readonly cameraCentreMargin?: number;
}

/**
 * The maps that have a top-down presentation, by map id. Empty until the slices land (T3 Ba Dan,
 * T4 the Forest Road, T5 the quarry); a map not listed keeps its oblique (or orthographic) look.
 */
export const TOPDOWN_PRESENTATIONS: ReadonlyMap<string, TopDownPresentation> = new Map();

/** One map in its top-down presentation: the same rules objects, a new projection and scene. */
export function topDownMap(map: MapDef, presentation: TopDownPresentation): MapDef {
  const {
    backdrop: _backdrop,
    cameraPaint: _cameraPaint,
    projection: _projection,
    scene: _scene,
    ...rules
  } = map;
  return {
    ...rules,
    projection: presentation.projection,
    scene: presentation.scene,
    ...(presentation.cameraCentreMargin !== undefined && {
      cameraCentreMargin: presentation.cameraCentreMargin,
    }),
  };
}

/**
 * `content` with every registered map swapped to its top-down presentation. Everything else is the
 * same index entry by reference, and with nothing registered (or none of the registered ids in
 * `content`) the index itself is returned unchanged.
 */
export function withTopDownMaps(
  content: ContentIndex,
  presentations: ReadonlyMap<string, TopDownPresentation> = TOPDOWN_PRESENTATIONS,
): ContentIndex {
  if (![...presentations.keys()].some((id) => content.maps.has(id))) return content;
  const maps = new Map(
    [...content.maps].map(([id, map]) => {
      const presentation = presentations.get(id);
      return [id, presentation ? topDownMap(map, presentation) : map] as const;
    }),
  );
  return { ...content, maps };
}
