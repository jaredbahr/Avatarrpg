/**
 * Combat's data-side bend handoff (ADR 0055, step 7).
 *
 * A bend set belongs to the unit asset, not to an ability. An ability uses it
 * only when it is the unit's element-bending attack: it has an attack tag and
 * damage/control output, and is neither melee nor mobility/support. This is
 * deliberately a presentation predicate; the reducer still owns the one
 * rules-level attack and its damage event.
 */

import type { Ability, Unit, Vec2 } from '../../core/types';
import type { BendAttackCue, BendSetDef } from '../../content/bends';
import type { Heading } from '../../content/assets/clips';
import { HEADINGS } from '../../content/assets/clips';
import { screenDirection, walkHeading } from './direction';
import type { Projection } from '../../render/projection';

export const BEND_EFFECT_NAMESPACE = 'bend:';

export function bendEffectId(id: string): string {
  return `${BEND_EFFECT_NAMESPACE}${id}`;
}

/** See the module comment for the intentionally narrow combat rule. */
export function isBendingAttack(unit: Unit, ability: Ability): boolean {
  if (unit.faction !== 'party' || unit.element !== ability.element) return false;
  if (!ability.tags.includes('attack') && !ability.tags.includes('signature')) return false;
  if (ability.range <= 1 && ability.targeting.shape === 'unit') return false;
  if (
    ability.tags.includes('mobility') ||
    ability.tags.includes('heal') ||
    ability.tags.includes('buff')
  )
    return false;
  return ability.effects.some(
    (effect) =>
      effect.kind === 'damage' ||
      effect.kind === 'status' ||
      effect.kind === 'push' ||
      effect.kind === 'pull',
  );
}

/** The set's first authored attack is the character's current bend attack. */
export function bendAttack(set: BendSetDef, ability: Ability): BendAttackCue | undefined {
  if (set.element !== ability.element) return undefined;
  return Object.values(set.facings)[0]?.attacks[0];
}

/** Quantise the projected caster-to-target vector using the Animator's headings. */
export function bendHeading(
  from: Vec2,
  to: Vec2,
  projection: Projection,
  previous?: Heading,
): Heading {
  const vector = { x: to.x - from.x, y: to.y - from.y };
  return walkHeading(screenDirection(vector, projection), previous);
}

/**
 * Resolve the attack and heading together. A missing set, wrong element or
 * ineligible ability returns undefined, which is the caller's legacy-cast path.
 */
export function resolveBendAttack(
  unit: Unit,
  ability: Ability,
  set: BendSetDef | undefined,
  from: Vec2,
  to: Vec2,
  projection: Projection,
  previous?: Heading,
): { readonly heading: Heading; readonly attack: BendAttackCue } | undefined {
  if (!set || set.unitAsset !== unit.sprite || !isBendingAttack(unit, ability)) return undefined;
  const heading = bendHeading(from, to, projection, previous);
  const attack = set.facings[heading]?.attacks[0];
  return attack ? { heading, attack } : undefined;
}

/** The one rules result is shown at the final visual release's impact. */
export function bendDamageRelease(attack: BendAttackCue): number {
  return attack.damageRelease;
}

/** Namespace bend effect ids when they cross the legacy effect registry. */
export function bendEffectKey(attack: BendAttackCue): string {
  return bendEffectId(attack.effectId);
}

/** All eight headings are retained here as a small contract tripwire. */
export const bendHeadings: readonly Heading[] = HEADINGS;
