import type { Projection } from '../../render/projection';

/** Party adults keep their world height when exploration enters combat. */
export function partyScale(projection: Projection | undefined, poseScale = 1): number {
  return (projection === 'oblique' ? 1.25 : 1) * poseScale;
}
