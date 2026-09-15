/**
 * XP, levels, stat growth and ability unlocks.
 *
 * Curve: XP needed to *reach* level n is `50 * n * (n + 1) / 2 - 50`.
 *   L2 = 100, L3 = 250, L4 = 450, L5 = 700, L10 = 2700
 *
 * Act 1 hands out roughly 900 XP across four fights, which lands a party at
 * about level 4 by the boss — the level the encounters are tuned for.
 *
 * Growth per level: +4 max HP, +1 Power, and earthbenders get +1 Defence every
 * second level because being the wall is their whole job.
 */

import type { CharacterDef, ContentIndex, ElementId, KitEntry, Unit, UnitStats } from '../types';

export const MAX_LEVEL = 10;

export const HP_PER_LEVEL = 4;
export const POWER_PER_LEVEL = 1;
/** Levels at which an earthbender picks up another point of Defence. */
export const EARTH_DEFENSE_EVERY = 2;

/** Total XP required to be at `level`. Level 1 is 0. */
export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return (50 * n * (n + 1)) / 2 - 50;
}

/** XP still needed to reach the next level, or 0 at the cap. */
export function xpToNextLevel(level: number, xp: number): number {
  if (level >= MAX_LEVEL) return 0;
  return Math.max(0, xpForLevel(level + 1) - xp);
}

/** Progress through the current level, 0..1. Used by the XP bar. */
export function levelProgress(level: number, xp: number): number {
  if (level >= MAX_LEVEL) return 1;
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  if (ceiling <= floor) return 1;
  return Math.max(0, Math.min(1, (xp - floor) / (ceiling - floor)));
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

/** Base stats for a character at a level, before statuses. */
export function statsAtLevel(
  content: ContentIndex,
  element: ElementId,
  level: number,
  mods: Partial<UnitStats> = {},
): UnitStats {
  const archetype = content.elements.get(element);
  if (!archetype) throw new Error(`Unknown element "${element}"`);
  const base = archetype.base;
  const steps = Math.max(0, Math.min(MAX_LEVEL, level) - 1);

  const earthDefense = element === 'earth' ? Math.floor(steps / EARTH_DEFENSE_EVERY) : 0;

  return {
    maxHp: base.maxHp + steps * HP_PER_LEVEL + (mods.maxHp ?? 0),
    maxAp: base.maxAp + (mods.maxAp ?? 0),
    maxMove: base.maxMove + (mods.maxMove ?? 0),
    power: base.power + steps * POWER_PER_LEVEL + (mods.power ?? 0),
    defense: base.defense + earthDefense + (mods.defense ?? 0),
    speed: base.speed + (mods.speed ?? 0),
    focus: base.focus + (mods.focus ?? 0),
  };
}

/**
 * Applies the same per-level growth to an authored stat block.
 *
 * Enemies use this so that a bandit at the boss fight is not the same bandit
 * the party met on the forest road three levels ago. Without it the party out-
 * scales the whole act by the second fight — the simulator measured a 99% win
 * rate with static enemies against a levelled party.
 */
export function scaleStats(base: UnitStats, element: ElementId, level: number): UnitStats {
  const steps = Math.max(0, Math.min(MAX_LEVEL, level) - 1);
  if (steps === 0) return base;

  const earthDefense = element === 'earth' ? Math.floor(steps / EARTH_DEFENSE_EVERY) : 0;

  return {
    ...base,
    maxHp: base.maxHp + steps * HP_PER_LEVEL,
    power: base.power + steps * POWER_PER_LEVEL,
    defense: base.defense + earthDefense,
  };
}

export interface KitUnlocks {
  /** Abilities granted outright at this level. */
  readonly granted: readonly string[];
  /** Choices the player must resolve before the next battle. */
  readonly choices: readonly (readonly [string, string])[];
}

/** What a kit hands over on arriving at exactly `level`. */
export function unlocksAtLevel(kit: readonly KitEntry[], level: number): KitUnlocks {
  const granted: string[] = [];
  const choices: (readonly [string, string])[] = [];
  for (const entry of kit) {
    if (entry.level !== level) continue;
    if ('ability' in entry) granted.push(entry.ability);
    else choices.push(entry.choose);
  }
  return { granted, choices };
}

/** Every ability a kit grants outright up to and including `level`. */
export function grantedUpTo(kit: readonly KitEntry[], level: number): string[] {
  const out: string[] = [];
  for (const entry of kit) {
    if (entry.level > level) continue;
    if ('ability' in entry) out.push(entry.ability);
  }
  return out;
}

export interface LevelGain {
  readonly unit: Unit;
  readonly levelsGained: number;
  readonly granted: readonly string[];
  readonly pendingChoices: readonly (readonly [string, string])[];
}

/**
 * Awards XP and levels a unit up as far as the XP takes it.
 *
 * Max HP grows, and current HP grows by the same amount rather than being
 * refilled — levelling up should feel like a reward, not a heal, and a full
 * heal mid-dungeon would flatten the resource pressure the whole slice runs on.
 */
export function awardXp(
  content: ContentIndex,
  unit: Unit,
  amount: number,
  character: CharacterDef | undefined,
): LevelGain {
  if (amount <= 0 || unit.level >= MAX_LEVEL) {
    return { unit, levelsGained: 0, granted: [], pendingChoices: [] };
  }

  const xp = unit.xp + amount;
  const newLevel = levelForXp(xp);
  if (newLevel === unit.level) {
    return { unit: { ...unit, xp }, levelsGained: 0, granted: [], pendingChoices: [] };
  }

  const granted: string[] = [];
  const pendingChoices: (readonly [string, string])[] = [];
  if (character) {
    for (let level = unit.level + 1; level <= newLevel; level++) {
      const unlocks = unlocksAtLevel(character.kit, level);
      granted.push(...unlocks.granted);
      pendingChoices.push(...unlocks.choices);
    }
  }

  const base = character
    ? statsAtLevel(content, unit.element, newLevel, character.statMods)
    : statsAtLevel(content, unit.element, newLevel);

  const hpGain = base.maxHp - unit.base.maxHp;

  return {
    unit: {
      ...unit,
      xp,
      level: newLevel,
      base,
      hp: Math.max(1, Math.min(base.maxHp, unit.hp + hpGain)),
      abilities: [...new Set([...unit.abilities, ...granted])],
    },
    levelsGained: newLevel - unit.level,
    granted,
    pendingChoices,
  };
}

/**
 * Splits an encounter's XP evenly across everyone who was in the party,
 * including the fallen — nobody gets left a level behind for dying once.
 * Remainder goes to the earliest members so the total always balances.
 */
export function splitXp(total: number, members: number): number[] {
  if (members <= 0) return [];
  const each = Math.floor(total / members);
  const remainder = total - each * members;
  return Array.from({ length: members }, (_, i) => each + (i < remainder ? 1 : 0));
}
