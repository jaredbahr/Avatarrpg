import type { Ability, AbilityEffect, AbilityTag, ElementId, Targeting } from '../../core/types';

/**
 * Factory for ability data. Everything optional has a sensible default so the
 * ability files read as a table rather than as boilerplate.
 *
 * Costing convention, kept consistent across all five kits:
 *   1 AP  basic, spammable, ~6-9 damage
 *   2 AP  standard, ~11-15 damage or a strong control effect
 *   3 AP  big: a signature, an area, or a battlefield-shaping surface
 */
export function ability(def: {
  id: string;
  name: string;
  element: ElementId;
  apCost: number;
  range: number;
  targeting: Targeting;
  effects: readonly AbilityEffect[];
  description: string;
  flavor: string;
  fx: string;
  tags?: readonly AbilityTag[];
  cooldown?: number;
  minRange?: number;
  requiresLineOfSight?: boolean;
}): Ability {
  return {
    id: def.id,
    name: def.name,
    element: def.element,
    apCost: def.apCost,
    cooldown: def.cooldown ?? 0,
    range: def.range,
    minRange: def.minRange ?? 0,
    requiresLineOfSight: def.requiresLineOfSight ?? true,
    targeting: def.targeting,
    effects: def.effects,
    tags: def.tags ?? ['attack'],
    description: def.description,
    flavor: def.flavor,
    fx: def.fx,
  };
}

export const enemyTarget: Targeting = { shape: 'unit', allow: 'enemy' };
export const allyTarget: Targeting = { shape: 'unit', allow: 'ally' };
export const anyTarget: Targeting = { shape: 'unit', allow: 'any' };
export const selfTarget: Targeting = { shape: 'self' };
export const tileTarget: Targeting = { shape: 'tile' };
export const blast = (radius: number): Targeting => ({ shape: 'blast', radius });
export const line = (length: number): Targeting => ({ shape: 'line', length });
export const cone = (length: number): Targeting => ({ shape: 'cone', length });
