import type { Vec2 } from '../../core/types';
import { projectGround } from '../../render/projection';
import type { Projection } from '../../render/projection';
import type { ClipName, MeleeDirection } from '../../content/assets/clips';

export type WalkDirection =
  'north' | 'northEast' | 'east' | 'southEast' | 'south' | 'southWest' | 'west' | 'northWest';

/** A unit heading in screen axes; translation never belongs in a direction. */
export function screenDirection(tangent: Vec2, projection: Projection): Vec2 {
  if (projection === 'orthographic') return tangent;
  const projected = projectGround(tangent, projection);
  const length = Math.hypot(projected.x, projected.y);
  return length === 0 ? projected : { x: projected.x / length, y: projected.y / length };
}

/** Select an authored melee contact by its projected screen direction. */
export function screenMeleeDirection(screen: Vec2): MeleeDirection | undefined {
  if (Math.abs(screen.y) <= Math.abs(screen.x)) return undefined;
  return screen.y < 0 ? 'screenUp' : 'screenDown';
}

/** Quantise a screen-space tangent to one of the authored eight-way headings. */
export function walkDirection(tangent: Vec2, previous?: WalkDirection): WalkDirection {
  const x = tangent.x;
  const y = tangent.y;
  if (Math.abs(x) + Math.abs(y) < 0.001) return previous ?? 'east';
  const octant = Math.round(Math.atan2(y, x) / (Math.PI / 4));
  return (['east', 'southEast', 'south', 'southWest', 'west', 'northWest', 'north', 'northEast'][
    (octant + 8) % 8
  ] ?? 'east') as WalkDirection;
}

/** Actions retain their authored side poses; only locomotion has front/back art. */
export function directionalClip(clip: ClipName, direction?: WalkDirection): ClipName {
  if (clip !== 'walk' && clip !== 'idle' && clip !== 'rest') return clip;
  if (!direction || direction === 'east') return clip;
  const suffix = direction[0]?.toUpperCase() + direction.slice(1);
  return `${clip}${suffix}` as ClipName;
}

export function verticalClip(clip: ClipName): boolean {
  return (
    clip === 'walkNorth' ||
    clip === 'walkSouth' ||
    clip === 'idleNorth' ||
    clip === 'idleSouth' ||
    clip === 'restNorth' ||
    clip === 'restSouth'
  );
}
