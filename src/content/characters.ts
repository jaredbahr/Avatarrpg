/**
 * The ten playable characters — two per element.
 *
 * All original. Set after Korra and before Seven Havens; exact dating remains
 * open. Nobody in this story has met an Avatar. For dialogue and character
 * humor, read docs/writing-guide.md.
 *
 * Both characters of an element share a kit (the plan calls for element kits,
 * not class kits). They differ in stats, in voice, and in how they are drawn —
 * and, from level 5, in the discipline their player commits them to, which is
 * where two earthbenders finally stop being the same earthbender.
 * `statMods` are deltas against the element archetype in `elements.ts`.
 */

import type { CharacterDef, KitEntry } from '../core/types';

/*
 * A kit runs to the discipline gate and stops.
 *
 * Levels 1-3 are the element's fundamentals, shared by both characters of that
 * element. Level 5 is the gate: the player commits to a path, and from there
 * the path's own kit supplies levels 5, 7 and 10 (see `disciplines.ts`). That
 * is why nothing below has an entry above level 5 any more — the abilities that
 * used to sit at 5, 7 and 10 did not go away, they moved into the path each one
 * belongs to.
 *
 * The level-3 choice is deliberately a taste of what is coming: a waterbender
 * who takes Healing Stream at 3 has already met the discipline they can commit
 * to at 5, and one who takes Water Pull has not lost the option.
 */

const FIRE_KIT: readonly KitEntry[] = [
  { level: 1, ability: 'fire_jab' },
  { level: 2, ability: 'fire_blast' },
  { level: 3, choose: ['flame_arc', 'fire_step'] },
  { level: 5, specialize: ['flame_shaping', 'lightning_path'] },
];

const WATER_KIT: readonly KitEntry[] = [
  { level: 1, ability: 'water_whip' },
  { level: 2, ability: 'ice_path' },
  { level: 3, choose: ['healing_stream', 'water_pull'] },
  { level: 5, specialize: ['ice_shaping', 'healing_path'] },
];

const EARTH_KIT: readonly KitEntry[] = [
  { level: 1, ability: 'rock_throw' },
  { level: 2, ability: 'stone_stance' },
  { level: 3, choose: ['earth_wall', 'shockwave'] },
  { level: 5, specialize: ['earth_shaping', 'metalbending_path'] },
];

const AIR_KIT: readonly KitEntry[] = [
  { level: 1, ability: 'air_blast' },
  { level: 2, ability: 'air_shield' },
  { level: 3, choose: ['air_scooter', 'gust'] },
  { level: 5, specialize: ['air_shaping', 'sound_bending'] },
];

const NONBENDER_KIT: readonly KitEntry[] = [
  { level: 1, ability: 'strike' },
  { level: 2, ability: 'take_cover' },
  { level: 3, choose: ['chi_block', 'bolas'] },
  { level: 5, specialize: ['field_craft', 'engineering'] },
];

export const CHARACTERS: readonly CharacterDef[] = [
  /* ---------------------------------------------------------------- Fire */
  {
    id: 'kaya',
    name: 'Kaya',
    element: 'fire',
    blurb: 'Quick to jump into a fight.',
    bio: 'Kaya grew up in a former Fire Nation colony, answering questions about where she was really from. She left to see the places people kept naming. Usually volunteers before hearing the whole job.',
    statMods: { power: 1, speed: 1, maxHp: -2 },
    kit: FIRE_KIT,
    portrait: 'portrait.kaya',
    sprite: 'unit.fire.kaya',
  },
  {
    id: 'tenzo',
    name: 'Tenzo',
    element: 'fire',
    blurb: 'A cook with a steady flame.',
    bio: 'Tenzo learned firebending at his grandmother’s stove in Republic City. He still sends her money from dockside cooking jobs. Packs enough food for a second travelling party, just in case.',
    statMods: { defense: 1, focus: 3, speed: -1 },
    kit: FIRE_KIT,
    portrait: 'portrait.tenzo',
    sprite: 'unit.fire.tenzo',
  },

  /* --------------------------------------------------------------- Water */
  {
    id: 'nilak',
    name: 'Nilak',
    element: 'water',
    blurb: 'Keeps watch over the wounded.',
    bio: 'Nilak trained at a Northern healing house that promised to treat anyone. When the house turned away people without residency papers or a sponsor, he took his medicine bag to them. He has been treating people on the road ever since.',
    statMods: { maxHp: 2, focus: 3, power: -1 },
    kit: WATER_KIT,
    portrait: 'portrait.nilak',
    sprite: 'unit.water.nilak',
  },
  {
    id: 'sura',
    name: 'Sura',
    element: 'water',
    blurb: 'An ice-fisher with a heavy hand.',
    bio: 'Sura takes cold-storage work beyond her Southern Water Tribe family’s usual fishing routes. Confident on uncertain ice, she is learning to ask about the local waters. Wants to see a sea that stays liquid all year.',
    statMods: { power: 2, speed: 1, defense: -1 },
    kit: WATER_KIT,
    portrait: 'portrait.sura',
    sprite: 'unit.water.sura',
  },

  /* --------------------------------------------------------------- Earth */
  {
    id: 'bo',
    name: 'Bo',
    element: 'earth',
    blurb: 'The foreman who holds the line.',
    bio: 'Bo ran a quarry crew three towns over until the wages stopped. He took road work to keep them fed and checks for their letters in every town. Counts heads whenever the party sets off and takes the heaviest load, even when someone offers.',
    statMods: { maxHp: 4, defense: 1, speed: -1 },
    kit: EARTH_KIT,
    portrait: 'portrait.bo',
    sprite: 'unit.earth.bo',
  },
  {
    id: 'lin_mei',
    name: 'Lin Mei',
    element: 'earth',
    blurb: 'A surveyor who chooses her ground.',
    bio: 'Lin Mei surveys unstable ground for villages that cannot afford to build twice. Carries a notebook full of measurements and arguments with contractors. Gets very quiet when someone ignores a warning.',
    statMods: { power: 1, focus: 5, maxHp: -2 },
    kit: EARTH_KIT,
    portrait: 'portrait.linmei',
    sprite: 'unit.earth.linmei',
  },

  /* ----------------------------------------------------------------- Air */
  {
    id: 'nima',
    name: 'Nima',
    element: 'air',
    blurb: 'Hard to catch, even at rest.',
    bio: 'Nima grew up at a rebuilt Air Temple, helping teachers who were still learning some of the ceremonies themselves. Can sit through a long meditation. Struggles with the meeting afterwards.',
    statMods: { maxMove: 1, speed: 1, maxHp: -1 },
    kit: AIR_KIT,
    portrait: 'portrait.nima',
    sprite: 'unit.air.nima',
  },
  {
    id: 'jinu',
    name: 'Jinu',
    element: 'air',
    blurb: 'A sturdy courier who keeps talking.',
    bio: 'Jinu carries mail between the northern provinces. Knows which rooftops are safe to land on and which families are waiting for letters. Makes little air currents while talking; loose papers are a problem.',
    statMods: { maxHp: 3, power: 1, speed: -1 },
    kit: AIR_KIT,
    portrait: 'portrait.jinu',
    sprite: 'unit.air.jinu',
  },

  /* ----------------------------------------------------------- Non-bender */
  {
    id: 'riko',
    name: 'Riko',
    element: 'nonbender',
    blurb: 'Quick hands and chi-blocking training.',
    bio: 'Riko works escort contracts using chi-blocking learned above a laundry. Her teacher made her practise escapes for months before teaching a strike. Values people who keep promises. Has a weakness for badly acted stage mysteries.',
    statMods: { speed: 2, focus: 5, maxHp: -2 },
    kit: NONBENDER_KIT,
    portrait: 'portrait.riko',
    sprite: 'unit.non.riko',
  },
  {
    id: 'wen',
    name: 'Wen',
    element: 'nonbender',
    blurb: 'A machinist with a heavy gauntlet.',
    bio: 'Wen repaired airships in Republic City until she saved enough for her own tools. Her electrified gauntlet began as a cable tester and has grown difficult to explain to inspectors. Keeps the old drawings to prove it.',
    statMods: { maxHp: 4, defense: 1, speed: -1 },
    kit: NONBENDER_KIT,
    portrait: 'portrait.wen',
    sprite: 'unit.non.wen',
  },
];

export const CHARACTER_BY_ID: ReadonlyMap<string, CharacterDef> = new Map(
  CHARACTERS.map((c) => [c.id, c]),
);

export function charactersForElement(element: CharacterDef['element']): CharacterDef[] {
  return CHARACTERS.filter((c) => c.element === element);
}
