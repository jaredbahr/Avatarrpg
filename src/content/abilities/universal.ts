/**
 * Abilities everybody has.
 *
 * Two, and each is deliberate. Shove is what makes the battlefield
 * *everybody's* to play with: props are only interesting if a nonbender, a
 * five-year-old, or a character who has spent all their AP can still do something
 * with them. "I pushed the barrel into him" is a complete, powerful, legible turn
 * for the youngest person at the table, and it costs no kit slot to have.
 *
 * Help up is what keeps a fallen hero in the game (#846, ADR 0118): a friend next
 * to them can spend a turn's worth of AP to stand them up once, instead of
 * watching them sit out the rest of the fight.
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

/**
 * The share of their health a helped-up hero rises with. A quarter is a few good hits' worth
 * of margin, not a second life: see ADR 0118 for the numbers behind it and the 2 AP price.
 */
export const HELP_UP_FRACTION = 0.25;

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
      'Push an adjacent person or object one tile away from you. Barrels, carts and braziers can be shoved into position, or into trouble.',
    flavor: 'No bending required. Just lean.',
    fx: 'fx.non.shove',
  }),
  ability({
    id: 'help_up',
    name: 'Help up',
    element: 'nonbender',
    // Half a normal turn: the helper still has a move and an attack, or a heal, left.
    apCost: 2,
    range: 1,
    targeting: { shape: 'unit', allow: 'downed' },
    effects: [{ kind: 'revive', fraction: HELP_UP_FRACTION }],
    tags: ['heal'],
    description:
      'Pull a friend who is down back onto their feet, with a quarter of their health. Each fighter can be helped up once a fight.',
    flavor: 'Nobody gets left on the ground.',
    fx: 'fx.non.rally',
  }),
];

export const UNIVERSAL_ABILITY_IDS: readonly string[] = UNIVERSAL_ABILITIES.map((a) => a.id);
