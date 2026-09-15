/**
 * The ten playable characters — two per element.
 *
 * All original. The era is roughly forty years after Korra: Republic City has
 * airships and electrified gauntlets, the Earth Kingdom's outer provinces are
 * still putting themselves back together, and nobody in this story has ever met
 * an Avatar.
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
    blurb: 'Reckless. Fast. Already moving.',
    bio: 'Grew up in a Fire Nation colony that stopped being a colony before she was born, and has been proving she belongs somewhere ever since. Hits first and works the rest out afterwards.',
    statMods: { power: 1, speed: 1, maxHp: -2 },
    kit: FIRE_KIT,
    portrait: 'portrait.kaya',
    sprite: 'unit.fire.kaya',
  },
  {
    id: 'tenzo',
    name: 'Tenzo',
    element: 'fire',
    blurb: 'Patient. Precise. Waits for the opening.',
    bio: 'A dockside cook from Republic City who learned firebending from his grandmother over a stove. Treats a fight like a kitchen: control the heat, and nothing burns that should not.',
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
    blurb: 'Healer first. Always watching the party.',
    bio: 'Trained at a small Northern healing house that takes anyone who asks. Left because the house would not treat the people who needed it most, and has been travelling ever since.',
    statMods: { maxHp: 2, focus: 3, power: -1 },
    kit: WATER_KIT,
    portrait: 'portrait.nilak',
    sprite: 'unit.water.nilak',
  },
  {
    id: 'sura',
    name: 'Sura',
    element: 'water',
    blurb: 'Ice first. Ask questions later.',
    bio: 'A Southern Water Tribe ice-fisher who found out she was very good at turning a fishing hole into a wall. Cheerfully certain that most problems freeze.',
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
    blurb: 'The wall. Nothing gets past.',
    bio: 'Quarry foreman from three towns over, built like the thing he digs out of the ground. Joined up because the quarry stopped paying and his crew still had to eat.',
    statMods: { maxHp: 4, defense: 1, speed: -1 },
    kit: EARTH_KIT,
    portrait: 'portrait.bo',
    sprite: 'unit.earth.bo',
  },
  {
    id: 'lin_mei',
    name: 'Lin Mei',
    element: 'earth',
    blurb: 'Reads the ground. Rewrites it.',
    bio: 'A surveyor who maps unstable ground for a living, which turns out to be excellent training for deciding where a fight should happen. Never raises her voice.',
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
    blurb: 'Never where you swung.',
    bio: 'Raised at a rebuilt Air Temple by people who were themselves only one generation into the tradition. Takes the philosophy seriously and the rules loosely.',
    statMods: { maxMove: 1, speed: 1, maxHp: -1 },
    kit: AIR_KIT,
    portrait: 'portrait.nima',
    sprite: 'unit.air.nima',
  },
  {
    id: 'jinu',
    name: 'Jinu',
    element: 'air',
    blurb: 'Talks constantly. Usually right.',
    bio: 'A courier who flies mail between the northern provinces and has opinions about every road in them. Airbends the way other people fidget — all the time, mostly unconsciously.',
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
    blurb: 'Chi-blocker. Turns benders off.',
    bio: 'Learned chi-blocking from a teacher who would not say where she learned it. Has no particular grudge against benders and no particular patience for them either.',
    statMods: { speed: 2, focus: 5, maxHp: -2 },
    kit: NONBENDER_KIT,
    portrait: 'portrait.riko',
    sprite: 'unit.non.riko',
  },
  {
    id: 'wen',
    name: 'Wen',
    element: 'nonbender',
    blurb: 'Engineer. Brought a gauntlet.',
    bio: 'Republic City machinist who builds what she needs and then improves it in the field. The electrified glove was supposed to be for repairing airship cabling.',
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
