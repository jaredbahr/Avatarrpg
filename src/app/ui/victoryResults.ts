/**
 * What each hero takes away from a won fight, for the victory card (#630).
 *
 * The card must say what the result *will* be before the player presses
 * Continue, so it runs the real `resolveBattle` on the current state and reads
 * the events back, rather than repeating the XP and level rules beside them.
 * The reducer is pure, so the dry run changes nothing.
 */

import type { ContentIndex, GameState, Unit } from '../../core/types';
import { apply } from '../../core/state/reducer';
import { MAX_LEVEL, levelProgress, xpToNextLevel } from '../../core/rules/leveling';

export interface VictoryRow {
  readonly unit: Unit;
  readonly xp: number;
  /** The level reached, when this fight levelled the hero up. */
  readonly newLevel: number | null;
  /** Names of the abilities the level-up handed over. */
  readonly learned: readonly string[];
  /** A technique or a path is waiting to be picked after the card. */
  readonly choice: 'ability' | 'discipline' | null;
  /** XP still needed for the next level, 0 at the cap. */
  readonly toNext: number;
  /** Progress through the level the hero is now on, 0..1. */
  readonly progress: number;
}

export function victoryResults(content: ContentIndex, state: GameState): VictoryRow[] {
  if (state.battle?.phase !== 'victory') return [];
  const { state: after, events } = apply(content, state, { type: 'resolveBattle' });
  return after.party.map((unit) => {
    let xp = 0;
    let newLevel: number | null = null;
    const learned: string[] = [];
    let choice: VictoryRow['choice'] = null;
    for (const event of events) {
      if (!('unitId' in event) || event.unitId !== unit.id) continue;
      if (event.type === 'xpGained') xp += event.amount;
      else if (event.type === 'leveledUp') {
        newLevel = event.level;
        for (const id of event.unlocked) learned.push(content.abilities.get(id)?.name ?? id);
      } else if (event.type === 'disciplineOffered') choice = 'discipline';
      else if (event.type === 'levelChoiceOffered') choice ??= 'ability';
    }
    return {
      unit,
      xp,
      newLevel,
      learned,
      choice,
      toNext: xpToNextLevel(unit.level, unit.xp),
      progress: levelProgress(unit.level, unit.xp),
    };
  });
}

/** The one line under a hero's name: what changed, in the card's warm voice. */
export function victoryNote(row: VictoryRow): string {
  const parts: string[] = [];
  if (row.learned.length > 0) parts.push(`Learned ${row.learned.join(' and ')}`);
  if (row.choice === 'ability') parts.push('a new move to choose');
  if (row.choice === 'discipline') parts.push('a path to choose');
  if (parts.length > 0) {
    const text = parts.join(', and ');
    return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
  }
  if (row.unit.level >= MAX_LEVEL) return 'As strong as a hero gets.';
  return `${row.toNext} XP to level ${row.unit.level + 1}.`;
}
