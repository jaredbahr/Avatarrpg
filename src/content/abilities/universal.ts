/**
 * Abilities everybody has.
 *
 * Exactly one, and it is deliberate. Shove is what makes the battlefield
 * *everybody's* to play with: props are only interesting if a nonbender, a
 * five-year-old, or a character who has spent all their AP can still do something
 * with them. "I pushed the barrel into him" is a complete, powerful, legible turn
 * for the youngest person at the table, and it costs no kit slot to have.
 *
 * It is granted through `ContentIndex.universalAbilities` and resolved by
 * `unitAbilities()` at read time rather than being written onto `Unit.abilities`,
 * so a save made before this existed picks it up on load instead of needing a
 * migration — and so adding a second universal later is one line here.
 *
 * Party members only. Enemies get it by naming it in their own ability list,
 * which keeps every measured enemy win rate in the balance report comparable.
 */

import type { Ability } from '../../core/types';
import { ability, anyTarget } from './helpers';

export const UNIVERSAL_ABILITIES: readonly Ability[] = [
  ability({
    id: 'shove',
    name: 'Shove',
    // `nonbender` because it is not bending — anyone can put their shoulder into
    // a barrel. The element is never checked for a universal, but leaving it
    // honest keeps the ability card's colour right.
    element: 'nonbender',
    apCost: 1,
    range: 1,
    targeting: anyTarget,
    effects: [{ kind: 'push', distance: 1 }],
    tags: ['control', 'mobility'],
    description:
      'Shove whatever is next to you one tile away. Works on people, and works on barrels, carts and braziers — which is usually the better idea.',
    flavor: 'No bending required. Just lean.',
    fx: 'fx.non.shove',
  }),
];

export const UNIVERSAL_ABILITY_IDS: readonly string[] = UNIVERSAL_ABILITIES.map((a) => a.id);
