/**
 * Guest allies (ADR 0116).
 *
 * A guest is a unit of faction `ally`: it fights on the party's side for one
 * battle and is then gone. Story allies (`EncounterDef.allies`, Ruon in the
 * Cutting) are the same kind of unit, so everything here holds for them too.
 *
 * Nothing new is stored. Who takes a guest's turns is its `ai` profile (`none`
 * for a table guest, as for a party member), and whether its fall loses the
 * fight is read off the encounter. That is why the guest mechanic needs no
 * save field and no migration.
 */

import type { EncounterDef, GuestLevel, Unit } from '../types';
import { MAX_LEVEL } from './leveling';
import { isAlive } from './stats';

/** A unit fighting with the party for this battle only: never a party member. */
export function isGuest(unit: Pick<Unit, 'faction'>): boolean {
  return unit.faction === 'ally';
}

/**
 * Whether people take this unit's turns: every party member, and a guest whose
 * encounter declared `control: 'table'`. Everything else runs through the AI.
 */
export function isTableControlled(unit: Pick<Unit, 'faction' | 'ai'>): boolean {
  if (unit.faction === 'party') return true;
  return unit.faction === 'ally' && unit.ai === 'none';
}

/**
 * The level a guest fights at.
 *
 * A fixed number is used as written; `{ partyOffset }` is the party's rounded
 * mean level plus the offset, so a guest met at different points of a free-roam
 * region keeps pace with whoever turns up. Either is clamped to 1..MAX_LEVEL.
 * With no level the guest fights at the encounter's level, as a story ally does.
 */
export function guestLevel(
  level: GuestLevel | undefined,
  party: readonly Pick<Unit, 'level'>[],
  fallback: number,
): number {
  let raw: number;
  if (level === undefined) raw = fallback;
  else if (typeof level === 'number') raw = level;
  else {
    const mean =
      party.length === 0 ? fallback : party.reduce((sum, u) => sum + u.level, 0) / party.length;
    raw = Math.round(mean) + level.partyOffset;
  }
  return Math.max(1, Math.min(MAX_LEVEL, Math.round(raw)));
}

/** How many friendly bodies an encounter adds to the party: its story allies and its guests. */
export function friendlyExtras(encounter: Pick<EncounterDef, 'allies' | 'guests'>): number {
  return encounter.allies.length + (encounter.guests?.length ?? 0);
}

/** True when the encounter declares that a fallen guest loses the fight, and one has fallen. */
export function guestHasFallen(
  units: readonly Unit[],
  encounter: Pick<EncounterDef, 'loseIfGuestFalls'> | undefined,
): boolean {
  if (!encounter?.loseIfGuestFalls) return false;
  return units.some((unit) => isGuest(unit) && !isAlive(unit));
}
