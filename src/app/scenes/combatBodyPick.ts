import { distance, occupiedCells, posKey, samePos } from '../../core/rules/grid';
import type { PropInstance, Unit, Vec2 } from '../../core/types';
import { actorBodyBounds } from '../../render/geometry/actorSilhouette';

export interface BodyPickActor {
  readonly unit: Unit;
  /** The unscaled upright box returned by Camera.spriteBox, after terrain lift. */
  readonly box: { readonly x: number; readonly y: number; readonly size: number };
  readonly scale: number;
  readonly frameHeadroom: number | null;
}

export interface BodyPickResult {
  readonly tile: Vec2;
  readonly unit?: Unit;
}

/**
 * Resolve a pointer which may be over the enlarged upright body of a square 2x2.
 * Ground meaning always wins. The inset rejects transparent-looking margins of
 * the conservative silhouette envelope without asking either backend to read pixels.
 */
export function resolveCombatBodyPick(options: {
  readonly point: { readonly x: number; readonly y: number };
  readonly groundTile: Vec2;
  readonly actors: readonly BodyPickActor[];
  readonly units: readonly Unit[];
  readonly props: readonly PropInstance[];
  readonly protectedTiles: ReadonlySet<string>;
  readonly caster: Vec2 | null;
  readonly legalTargets?: ReadonlySet<string>;
  readonly squareFootprints?: boolean;
}): BodyPickResult {
  const {
    point,
    groundTile,
    actors,
    units,
    props,
    protectedTiles,
    caster,
    legalTargets,
    squareFootprints = true,
  } = options;
  const occupied = units.some((unit) =>
    occupiedCells(unit, squareFootprints).some((cell) => samePos(cell, groundTile)),
  );
  const prop = props.some((candidate) => samePos(candidate.pos, groundTile));
  if (occupied || prop || protectedTiles.has(posKey(groundTile))) return { tile: groundTile };

  // Prefer the later candidate if enlarged bodies happen to overlap.
  for (let index = actors.length - 1; index >= 0; index -= 1) {
    const actor = actors[index];
    if (!actor) continue;
    const { unit, box, scale, frameHeadroom } = actor;
    if (!squareFootprints || unit.size !== 2 || scale <= 1) continue;

    const width = box.size * unit.size;
    const bounds = actorBodyBounds({ ...box, width }, unit.size, frameHeadroom, scale);
    const scaledWidth = width * scale;
    // The atlas rectangle includes transparent breathing room. Eight percent
    // per side leaves the shipped four-tile scaled box about 3.36 tiles wide.
    const inset = scaledWidth * 0.08;
    if (
      point.x < bounds.left + inset ||
      point.x > bounds.right - inset ||
      point.y < bounds.top ||
      point.y > bounds.bottom
    )
      continue;

    const cells = occupiedCells(unit, squareFootprints)
      .filter((cell) => !legalTargets || legalTargets.has(posKey(cell)))
      .sort((a, b) => (caster ? distance(caster, a) - distance(caster, b) : 0));
    const tile = cells[0];
    if (tile) return { tile, unit };
  }
  return { tile: groundTile };
}
