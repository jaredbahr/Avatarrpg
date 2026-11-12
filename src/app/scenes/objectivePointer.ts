import type { MapExit, Vec2 } from '../../core/types';
import type { WorldObjectiveTarget } from '../../core/story/world';
import type { NpcMarker } from '../../render/renderer';

export interface ResolvedObjectivePointerTarget {
  readonly pos: Vec2;
  readonly label: string;
}

/** Resolve authored targets against the scene's current, actually drawn actors. */
export function resolveObjectivePointerTarget(
  target: WorldObjectiveTarget | null,
  exits: readonly MapExit[] | undefined,
  npcs: readonly NpcMarker[],
): ResolvedObjectivePointerTarget | null {
  if (!target) return null;
  if (target.kind === 'npc') {
    const npc = npcs.find(
      (candidate) =>
        (candidate.id === target.id || candidate.npcId === target.id) &&
        !candidate.quiet &&
        (candidate.alpha ?? 1) > 0,
    );
    return npc ? { pos: npc.renderPos ?? npc.pos, label: npc.name } : null;
  }
  const exit = exits?.find((candidate) => candidate.toMapId === target.toMapId);
  return exit ? { pos: exit.pos, label: exit.label } : null;
}

export interface ObjectivePointerPoint {
  readonly x: number;
  readonly y: number;
}

export type ObjectivePointerSide = 'north' | 'east' | 'south' | 'west';

export interface ObjectivePointerPlacement {
  readonly x: number;
  readonly y: number;
  /** Degrees clockwise from the upward-pointing glyph. */
  readonly angle: number;
  readonly side: ObjectivePointerSide;
}

/**
 * Intersects the ray from the viewport centre to an off-screen target with an
 * inset CSS-pixel rectangle. A null result means the target is visible or the
 * viewport cannot safely contain the cue.
 */
export function objectivePointerPlacement(
  target: ObjectivePointerPoint,
  width: number,
  height: number,
  inset = 32,
): ObjectivePointerPlacement | null {
  if (
    !Number.isFinite(target.x) ||
    !Number.isFinite(target.y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(inset) ||
    width <= 0 ||
    height <= 0
  )
    return null;

  if (target.x >= 0 && target.x <= width && target.y >= 0 && target.y <= height) return null;

  const centreX = width / 2;
  const centreY = height / 2;
  const dx = target.x - centreX;
  const dy = target.y - centreY;
  if (dx === 0 && dy === 0) return null;

  const safeInset = Math.max(0, inset);
  const halfWidth = width / 2 - safeInset;
  const halfHeight = height / 2 - safeInset;
  if (halfWidth <= 0 || halfHeight <= 0) return null;

  const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dx);
  const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);
  const x = centreX + dx * scale;
  const y = centreY + dy * scale;
  const side = scaleX <= scaleY ? (dx < 0 ? 'west' : 'east') : dy < 0 ? 'north' : 'south';

  return {
    x,
    y,
    angle: (Math.atan2(dy, dx) * 180) / Math.PI + 90,
    side,
  };
}
