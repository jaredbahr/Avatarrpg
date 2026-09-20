/**
 * The five paths a player can pick, and the level-1 archetype each one starts
 * from. Characters nudge these numbers; they never replace them.
 *
 * First-pass balance philosophy:
 *   fire       glass cannon — highest Power, thin defence
 *   water      support and setup — soaks targets, the party's dedicated healing
 *   earth      the anchor — most HP and Defence, slowest
 *   air        the mover — weakest hits, best Speed, best positioning
 *   nonbender  the specialist — 5 AP, highest Focus, shuts benders off when it lands
 */

import type { ElementDef, ElementId, UnitStats } from '../core/types';

export type { ElementDef };

export const ELEMENTS: readonly ElementDef[] = [
  {
    id: 'fire',
    name: 'Firebending',
    tagline: 'Hit hardest. Stand somewhere safe.',
    description:
      'Firebenders hit hardest but are easier to punish. They set the ground alight, which is useful until a friend has to cross it.',
    playstyle: 'Stay at range when you can, set up fire, and leave your own flames clear.',
    base: { maxHp: 28, maxAp: 4, maxMove: 4, power: 7, defense: 2, speed: 6, focus: 10 },
    palette: 'fire',
  },
  {
    id: 'water',
    name: 'Waterbending',
    tagline: 'Heal the party. Set up everyone else.',
    description:
      "Waterbenders are the party's dedicated healers and can make targets Wet with water attacks. Wet targets take double lightning damage, and cold can freeze water.",
    playstyle:
      'Wet a dangerous target, then pair it with lightning or cold when the opening is there.',
    base: { maxHp: 26, maxAp: 4, maxMove: 4, power: 5, defense: 2, speed: 5, focus: 15 },
    palette: 'water',
  },
  {
    id: 'earth',
    name: 'Earthbending',
    tagline: 'Stand in front. Rebuild the battlefield.',
    description:
      'Earthbenders have the most health and armour and the slowest turn. They raise walls, drop boulders, and turn the ground into mud that slows and may root.',
    playstyle: 'Block the gap, slow a route, then change the shape of the fight.',
    base: { maxHp: 34, maxAp: 4, maxMove: 4, power: 6, defense: 4, speed: 3, focus: 5 },
    palette: 'earth',
  },
  {
    id: 'air',
    name: 'Airbending',
    tagline: 'Move anywhere. Put them where you want them.',
    description:
      'Airbenders hit the softest and move the best. Their wind pushes and pulls, and it can scatter fire or steam when the field gets crowded.',
    playstyle:
      'Use your speed to put enemies where the party wants them, then push them into hazards or away from your allies.',
    base: { maxHp: 22, maxAp: 4, maxMove: 5, power: 4, defense: 1, speed: 8, focus: 15 },
    palette: 'air',
  },
  {
    id: 'nonbender',
    name: 'Non-bender',
    tagline: 'Five AP. Turn a bender off completely.',
    description:
      'No bending, and it does not matter. Non-benders get five AP each turn, have the highest Focus for critical hits, and can chi-block a bender so they cannot bend for two rounds.',
    playstyle:
      'Use your extra AP to get close, then try to stop a dangerous bender with Chi Block.',
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
