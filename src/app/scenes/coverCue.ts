import { hasCover } from '../../core/rules/damage';
import { distanceBetweenUnits } from '../../core/rules/grid';
import { SQUARE_FOOTPRINTS } from '../../core/rules/footprint';
import type { Ability, ContentIndex, Grid, Unit, Vec2 } from '../../core/types';

/**
 * The cover cue for an aimed target (#457; ADR 0105): `'covered'` when the shot would take the cover
 * penalty, `'ignored'` when the target is in cover but the ability arcs over it
 * (`requiresLineOfSight: false`), and null when nothing covers it or the blow is melee. It asks
 * `hasCover` itself, with the board's roster and the firing cell, so the cue is the rule, never a
 * second description of it.
 */
export function coverCue(
  content: ContentIndex,
  grid: Grid,
  attacker: Unit,
  defender: Unit,
  ability: Pick<Ability, 'requiresLineOfSight'>,
  units: readonly Unit[],
  origin: Vec2 = attacker.pos,
  square = SQUARE_FOOTPRINTS,
): 'covered' | 'ignored' | null {
  // Melee (adjacent) blows ignore cover: there is nothing between you and the one you hit.
  if (distanceBetweenUnits(attacker, defender, square) <= 1) return null;
  if (!hasCover(content, grid, defender, square, { origin, attacker, units })) return null;
  return ability.requiresLineOfSight ? 'covered' : 'ignored';
}
