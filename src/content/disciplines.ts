/**
 * Disciplines — the paths a character commits to at level 5.
 *
 * Each character already brings a different early tool; the gate adds a second
 * decision about their future craft. An earthbender can take the quarry road
 * and shape the ground, or learn to bend the metal in a bandit's armour.
 *
 * Two rules hold the whole thing together:
 *
 *  1. **Every element has exactly one path with `requiresFlag: null`.** That is
 *     the floor. A table that skipped every optional beat still arrives at the
 *     gate with something real to take, and `validateContent` fails the build
 *     if an element ever loses its unconditional path.
 *  2. **A rare path is gated by a story flag, never by a roll.** Metalbending
 *     is rare because somebody has to teach it, and the seeded RNG is never
 *     asked. A kid who wants metalbending can go and find the teacher; a kid
 *     who rolls badly can do nothing at all, which is why we do not roll.
 *
 * Non-benders get the same structure with different fiction — a school of
 * training rather than a rarer art. Nothing in `src/core/` asks whether a unit
 * bends, so the shape is identical on purpose.
 *
 * The flags below are not set anywhere in Act 1. Act 1 ends at level 4 and the
 * gate is at 5, so no shipped story beat reaches this yet; the teacher scenes
 * that set them are Act 2 content. Until then the rare paths are reachable
 * through `setFlags`, a test fixture, or the balance simulator.
 */

import type { DisciplineDef, KitEntry } from '../core/types';

const ladder = (
  fifth: string,
  seventh: string | readonly [string, string],
  tenth: string,
): readonly KitEntry[] => [
  { level: 5, ability: fifth },
  typeof seventh === 'string' ? { level: 7, ability: seventh } : { level: 7, choose: seventh },
  { level: 10, ability: tenth },
];

/** Story flags that open a rare path. Act 2 beats will set these. */
export const DISCIPLINE_FLAGS = {
  lightning: 'learned_lightning',
  healing: 'learned_healing',
  metalbending: 'learned_metalbending',
  sound: 'learned_soundbending',
  engineering: 'learned_engineering',
} as const;

export const DISCIPLINES: readonly DisciplineDef[] = [
  /* ----------------------------------------------------------------- Fire */
  {
    id: 'flame_shaping',
    name: 'Flame Shaping',
    element: 'fire',
    blurb: 'Control the heat. Nothing burns that should not.',
    description:
      'The disciplined road: walls of fire to choose where the fight happens, a heat shield to survive standing in it, and dragonfire when the line finally has to break.',
    flavor: 'Every cook knows it. Most firebenders forget it.',
    requiresFlag: null,
    lockedHint: '',
    statMods: { defense: 1 },
    kit: ladder('fire_wall', 'heat_shield', 'dragon_breath'),
    icon: 'fx.fire.wall',
  },
  {
    id: 'lightning_path',
    name: 'Lightning',
    element: 'fire',
    blurb: 'Cold fire. Doubles on anything wet.',
    description:
      'The rare road. Lightning at range, then a line of it down a whole rank, then the storm. Pair it with a waterbender and the fight is usually over early.',
    flavor: 'Separation, then release. Never hesitate halfway.',
    requiresFlag: DISCIPLINE_FLAGS.lightning,
    lockedHint: 'Find someone willing to teach the separation. Very few are.',
    statMods: { power: 1, maxHp: -2 },
    kit: ladder('lightning', 'lightning_arc', 'lightning_storm'),
    icon: 'fx.fire.lightning',
  },

  /* ---------------------------------------------------------------- Water */
  {
    id: 'ice_shaping',
    name: 'Ice Shaping',
    element: 'water',
    blurb: 'Freeze it. Then walk over it.',
    description:
      'Turn the battlefield to ice: spikes through a rank, a wave that moves everybody, and the octopus form when they get close enough to regret it.',
    flavor: 'Most problems freeze.',
    requiresFlag: null,
    lockedHint: '',
    statMods: { power: 1 },
    kit: ladder('ice_spikes', ['tidal_wave', 'ice_shield'], 'octopus_form'),
    icon: 'fx.water.spikes',
  },
  {
    id: 'healing_path',
    name: 'Healing',
    element: 'water',
    blurb: 'The only thing that undoes a bad round.',
    description:
      'Hands-on healing that nearly doubles the Healing Stream, a mist that clears a chi block off the whole group, and Life Tide — every debuff in the party gone at once.',
    flavor: 'The house took anyone who asked. She still does.',
    requiresFlag: DISCIPLINE_FLAGS.healing,
    lockedHint: 'A healing house has to take you in. Ask at the northern water tribes.',
    statMods: { focus: 5, power: -1 },
    kit: ladder('healing_hands', 'purifying_mist', 'life_tide'),
    icon: 'fx.water.heal',
  },

  /* ---------------------------------------------------------------- Earth */
  {
    id: 'earth_shaping',
    name: 'Earth Shaping',
    element: 'earth',
    blurb: 'Decide where the fight happens.',
    description:
      'Mud to bog them down, a boulder or the sense to read the whole field, and a fissure that splits the ground open and leaves the crack behind as cover.',
    flavor: 'Half of winning a fight is choosing where it happens.',
    requiresFlag: null,
    lockedHint: '',
    statMods: { maxHp: 2 },
    kit: ladder('mudslide', ['seismic_sense', 'boulder'], 'fissure'),
    icon: 'fx.earth.mudslide',
  },
  {
    id: 'metalbending_path',
    name: 'Metalbending',
    element: 'earth',
    blurb: 'There is earth inside the metal. Find it.',
    description:
      'Reach and armour. A steel cable that drags anyone out of cover, plate pulled together out of whatever metal you are carrying, and finally seizing the metal on them and crushing it inward.',
    flavor: 'It was a belt buckle a moment ago.',
    requiresFlag: DISCIPLINE_FLAGS.metalbending,
    lockedHint: 'Someone has to show you the earth still in the ore. Try the rail towns.',
    statMods: { defense: 1, speed: -1 },
    kit: ladder('metal_cable', 'metal_armor', 'metalbending'),
    icon: 'fx.earth.metal',
  },

  /* ------------------------------------------------------------------ Air */
  {
    id: 'air_shaping',
    name: 'Air Shaping',
    element: 'air',
    blurb: 'Never where you swung.',
    description:
      'The classical road: a cyclone that gathers a scattered line into one knot, a cushion that catches whoever is falling, and the tornado.',
    flavor: 'Evade first. Always.',
    requiresFlag: null,
    lockedHint: '',
    statMods: { maxMove: 1 },
    kit: ladder('cyclone', 'air_cushion', 'tornado'),
    icon: 'fx.air.cyclone',
  },
  {
    id: 'sound_bending',
    name: 'Sound Bending',
    element: 'air',
    blurb: 'Airbending is not always quiet.',
    description:
      'Air as pressure rather than wind: a boom that knocks a line down, a shout that takes the turn off whoever is in front of you, and a strike that goes straight through armour.',
    flavor: 'Find the note the thing is already singing. Then sing it louder.',
    requiresFlag: DISCIPLINE_FLAGS.sound,
    lockedHint: 'The temples do not teach it. Somebody outside them does.',
    statMods: { power: 1, focus: 3 },
    kit: ladder('sonic_boom', 'deafening_shout', 'shatterpoint'),
    icon: 'fx.air.sonic',
  },

  /* ----------------------------------------------------------- Non-bender */
  {
    id: 'field_craft',
    name: 'Field Craft',
    element: 'nonbender',
    blurb: 'Smoke, cover, and getting everyone back up.',
    description:
      'The road that keeps the party moving: smoke nobody can see through, a shield to hold the line or a shout that hands a friend their turn back, and the full pressure-point sequence.',
    flavor: 'Somebody has to stand in front.',
    requiresFlag: null,
    lockedHint: '',
    statMods: { maxHp: 2 },
    kit: ladder('smoke_bomb', ['shield_bash', 'rally'], 'pressure_points'),
    icon: 'fx.non.smoke',
  },
  {
    id: 'engineering',
    name: 'Engineering',
    element: 'nonbender',
    blurb: 'No bending required. That was always the argument.',
    description:
      'Republic City workshop tech: the electrified glove, a mine that leaks fuel for a firebender to light, and an array that stops every bender inside it from bending at all.',
    flavor: 'The glove was supposed to be for repairing airship cabling.',
    requiresFlag: DISCIPLINE_FLAGS.engineering,
    lockedHint: 'You need a workshop, a schematic, and somebody who owes you a favour.',
    statMods: { focus: 5, maxMove: -1 },
    kit: ladder('electrified_glove', 'shock_mine', 'disruptor_array'),
    icon: 'fx.non.glove',
  },
];

export const DISCIPLINE_BY_ID: ReadonlyMap<string, DisciplineDef> = new Map(
  DISCIPLINES.map((d) => [d.id, d]),
);

export function disciplinesForElement(element: DisciplineDef['element']): DisciplineDef[] {
  return DISCIPLINES.filter((d) => d.element === element);
}
