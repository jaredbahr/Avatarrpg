/**
 * The five paths a player can pick, and the level-1 archetype each one starts
 * from. Characters nudge these numbers; they never replace them.
 *
 * First-pass balance philosophy:
 *   fire       glass cannon — highest Power, thin defence
 *   water      support and setup — soaks targets, the only real healing
 *   earth      the anchor — most HP and Defence, slowest
 *   air        the mover — weakest hits, best Speed, best positioning
 *   nonbender  the specialist — 5 AP, highest Focus, shuts benders off
 */

import type { ElementId, UnitStats } from '../core/types';

export interface ElementDef {
  readonly id: ElementId;
  readonly name: string;
  /** Shown on the element card during party setup. */
  readonly tagline: string;
  readonly description: string;
  /** How it plays, in one sentence an eight-year-old can act on. */
  readonly playstyle: string;
  readonly base: UnitStats;
  /** CSS custom-property suffix: --c-fire, --c-water, ... */
  readonly palette: string;
}

export const ELEMENTS: readonly ElementDef[] = [
  {
    id: 'fire',
    name: 'Firebending',
    tagline: 'Hit hardest. Stand somewhere safe.',
    description:
      'Firebenders deal the most damage in the game and take the most in return. They set the ground alight, which is wonderful and occasionally a problem for their own side.',
    playstyle: 'Stay at range, set things on fire, and never stand in your own flames.',
    base: { maxHp: 28, maxAp: 4, maxMove: 4, power: 7, defense: 2, speed: 6, focus: 10 },
    palette: 'fire',
  },
  {
    id: 'water',
    name: 'Waterbending',
    tagline: 'Heal the party. Set up everyone else.',
    description:
      'Waterbenders are the only healers, and the only way to make a target Wet — which doubles lightning damage and makes freezing almost certain.',
    playstyle: 'Soak the dangerous enemy first, then let the firebender finish it.',
    base: { maxHp: 26, maxAp: 4, maxMove: 4, power: 5, defense: 2, speed: 5, focus: 15 },
    palette: 'water',
  },
  {
    id: 'earth',
    name: 'Earthbending',
    tagline: 'Stand in front. Rebuild the battlefield.',
    description:
      'Earthbenders have the most health and armour and the slowest turn. They can raise walls, drop boulders, and turn the ground into mud nobody can cross.',
    playstyle: 'Block the gap, then change the shape of the fight.',
    base: { maxHp: 34, maxAp: 4, maxMove: 4, power: 6, defense: 4, speed: 3, focus: 5 },
    palette: 'earth',
  },
  {
    id: 'air',
    name: 'Airbending',
    tagline: 'Move anywhere. Put them where you want them.',
    description:
      'Airbenders hit the softest and move the best. Almost everything they do pushes or pulls — which means every hazard on the map is theirs to use.',
    playstyle: 'Shove enemies into the fire. That is the whole strategy, and it is a good one.',
    base: { maxHp: 22, maxAp: 4, maxMove: 5, power: 4, defense: 1, speed: 8, focus: 15 },
    palette: 'air',
  },
  {
    id: 'nonbender',
    name: 'Non-bender',
    tagline: 'Five AP. Turn a bender off completely.',
    description:
      'No bending, and it does not matter. Non-benders get an extra action every turn, crit more than anyone, and can chi-block a bender so they cannot bend at all.',
    playstyle: 'Get next to the scariest bender and switch them off.',
    base: { maxHp: 30, maxAp: 5, maxMove: 4, power: 6, defense: 3, speed: 7, focus: 20 },
    palette: 'nonbender',
  },
];

export const ELEMENT_BY_ID: ReadonlyMap<ElementId, ElementDef> = new Map(
  ELEMENTS.map((e) => [e.id, e]),
);

export function elementBase(id: ElementId): UnitStats {
  const def = ELEMENT_BY_ID.get(id);
  if (!def) throw new Error(`Unknown element: ${id}`);
  return def.base;
}
