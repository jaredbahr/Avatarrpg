import type { MapExit, Vec2 } from '../../core/types';
import type { Camera } from '../../render/camera';
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

type MapCorner = Pick<HTMLElement, 'offsetLeft' | 'offsetTop' | 'offsetWidth' | 'offsetHeight'>;

/**
 * Put the cue at the nearest inset edge and point it at the actual target.
 * A null result means the target is visible or the cue cannot fit.
 */
export function objectivePointerPlacement(
  target: ObjectivePointerBox,
  width: number,
  height: number,
  corner?: MapCorner | null,
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
  if (corner?.offsetWidth) {
    const left = corner.offsetLeft - inset;
    const bottom = corner.offsetTop + corner.offsetHeight + inset;
    if (x > left && y < bottom) {
      // A short board can have room beside the map but none below it.
      if (side === 'east' && bottom <= height - inset) y = bottom;
      else if (left >= inset) x = left;
      else return null;
    }
  }

  return {
    x,
    y,
    angle: Math.atan2(targetY - y, targetX - x),
    side,
  };
}

/** The passive cue follows the same camera and wrapper as the canvas. */
export function drawObjectivePointer(
  pointer: HTMLElement | null,
  corner: HTMLElement | null,
  camera: Camera,
  target: ResolvedObjectivePointerTarget | null,
): void {
  if (!pointer) return;
  const { width, height } = camera.viewport;
  const placement =
    target && objectivePointerPlacement(camera.toScreen(target.pos), width, height, corner);
  pointer.hidden = !placement;
  if (!target || !placement) return;
  pointer.style.cssText = `left:${placement.x}px;top:${placement.y}px;--objective-edge-angle:${placement.angle}rad`;
  pointer.setAttribute('aria-label', `${target.label} is off screen to the ${placement.side}.`);
}
