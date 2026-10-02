import { footprintFoot } from '../core/rules/footprint';
import type { Vec2 } from '../core/types';
import type { Projection } from './projection';

/** Render-only foot point for upright actor presentation. */
export function renderFoot(pos: Vec2, size: 1 | 2, square: boolean, projection: Projection): Vec2 {
  return projection === 'oblique' && square && size === 2
    ? { x: pos.x + 1.5, y: pos.y + 1.5 }
    : footprintFoot(pos, size, square);
}
