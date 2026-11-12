import type { MapExit, Vec2 } from '../../core/types';
import type { NpcMarker } from '../../render/renderer';

export interface ResolvedObjectivePointerTarget {
  readonly pos: Vec2;
  readonly label: string;
}

/** Resolve authored targets against the scene's current, actually drawn actors. */
export function resolveObjectivePointerTarget(
  id: string | null,
  exits: readonly MapExit[] | undefined,
  npcs: readonly NpcMarker[],
): ResolvedObjectivePointerTarget | null {
  if (!id) return null;
  const npc = npcs.find(
    (candidate) =>
      (candidate.id === id || candidate.npcId === id) &&
      !candidate.quiet &&
      (candidate.alpha ?? 1) > 0,
  );
  if (npc) return { pos: npc.renderPos ?? npc.pos, label: npc.name };
  return exits?.find((candidate) => candidate.toMapId === id) ?? null;
}

export interface ObjectivePointerBox {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

export type ObjectivePointerSide = 'north' | 'east' | 'south' | 'west';

export interface ObjectivePointerPlacement {
  readonly x: number;
  readonly y: number;
  /** Radians clockwise from the right-pointing glyph. */
  readonly angle: number;
  readonly side: ObjectivePointerSide;
}

/**
 * Put the cue at the nearest inset edge and point it at the actual target.
 * A null result means the target is visible or the cue cannot fit.
 */
export function objectivePointerPlacement(
  target: ObjectivePointerBox,
  width: number,
  height: number,
  topRight?: { left: number; bottom: number },
): ObjectivePointerPlacement | null {
  const inset = 32;
  if (
    !Number.isFinite(target.x) ||
    !Number.isFinite(target.y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= inset * 2 ||
    height <= inset * 2
  )
    return null;

  const side =
    target.x + target.size < 0
      ? 'west'
      : target.x > width
        ? 'east'
        : target.y + target.size < 0
          ? 'north'
          : target.y > height
            ? 'south'
            : null;
  if (!side) return null;

  const targetX = target.x + target.size / 2;
  const targetY = target.y + target.size / 2;
  let x = Math.max(inset, Math.min(targetX, width - inset));
  let y = Math.max(inset, Math.min(targetY, height - inset));
  if (topRight && x + inset > topRight.left && y - inset < topRight.bottom) {
    // Stay on the same edge, clear of the follow-party map in the corner.
    if (side === 'north') x = topRight.left - inset;
    else if (side === 'east') y = topRight.bottom + inset;
    else return null;
    if (x < inset || y > height - inset) return null;
  }

  return {
    x,
    y,
    angle: Math.atan2(targetY - y, targetX - x),
    side,
  };
}
