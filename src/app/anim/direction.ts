import type { Vec2 } from '../../core/types';
import { projectGround } from '../../render/projection';
import type { Projection } from '../../render/projection';
import type { ClipName } from '../../content/assets/clips';

export type WalkDirection = 'north' | 'south' | 'east' | 'west';

/** A unit heading in screen axes; translation never belongs in a direction. */
export function screenDirection(tangent: Vec2, projection: Projection): Vec2 {
  if (projection === 'orthographic') return tangent;
  const projected = projectGround(tangent, projection);
  const length = Math.hypot(projected.x, projected.y);
  return length === 0 ? projected : { x: projected.x / length, y: projected.y / length };
}

/** Keep the current axis through a narrow diagonal band to avoid corner flicker. */
export function walkDirection(tangent: Vec2, previous?: WalkDirection): WalkDirection {
  const x = Math.abs(tangent.x),
    y = Math.abs(tangent.y);
  if (x + y < 0.001) return previous ?? 'east';
  const vertical =
    y > x * 1.15 || (x <= y * 1.15 && (previous === 'north' || previous === 'south'));
  return vertical ? (tangent.y < 0 ? 'north' : 'south') : tangent.x < 0 ? 'west' : 'east';
}

/** Actions retain their authored side poses; only locomotion has front/back art. */
export function directionalClip(clip: ClipName, direction?: WalkDirection): ClipName {
  if (clip !== 'walk' && clip !== 'idle') return clip;
  if (direction === 'north') return clip === 'walk' ? 'walkNorth' : 'idleNorth';
  if (direction === 'south') return clip === 'walk' ? 'walkSouth' : 'idleSouth';
  return clip;
}

export function verticalClip(clip: ClipName): boolean {
  return (
    clip === 'walkNorth' || clip === 'walkSouth' || clip === 'idleNorth' || clip === 'idleSouth'
  );
}
