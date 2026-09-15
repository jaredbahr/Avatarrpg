/**
 * Applying, upgrading, and ticking statuses.
 *
 * Two behaviours here are worth knowing before you read the callers:
 *
 *  - **Upgrades.** A StatusDef may declare `upgradeFrom`. Applying Chilled to
 *    something that is already Chilled becomes Frozen, because Frozen lists
 *    Chilled in its `upgradeFrom`. The table drives this, not the ability.
 *  - **Clears.** Applying Wet removes Burning, because Wet lists it in
 *    `clears`. Again: the table, not the ability.
 *
 * Everything returns new objects. Nothing here mutates a Unit.
 */

import type { ContentIndex, StatusId, StatusInstance, Unit } from '../types';

export interface StatusApplication {
  readonly unit: Unit;
  /** What actually landed — may differ from what was asked for, via upgrade. */
  readonly applied: StatusId | null;
  readonly cleared: readonly StatusId[];
}

/** Finds a status that upgrades from `id` and is already primed on this unit. */
function findUpgrade(content: ContentIndex, unit: Unit, id: StatusId): StatusId | null {
  for (const def of content.statuses.values()) {
    if (!def.upgradeFrom) continue;
    if (!def.upgradeFrom.includes(id)) continue;
    if (unit.statuses.some((s) => s.id === id)) return def.id;
  }
  return null;
}

export function applyStatus(
  content: ContentIndex,
  unit: Unit,
  id: StatusId,
  duration?: number,
): StatusApplication {
  const upgraded = findUpgrade(content, unit, id);
  const finalId = upgraded ?? id;

  const def = content.statuses.get(finalId);
  if (!def) return { unit, applied: null, cleared: [] };

  const finalDuration = duration ?? def.defaultDuration;

  // An upgrade consumes the status it grew out of.
  const consumed: StatusId[] = upgraded ? [id] : [];
  const cleared = [...consumed, ...def.clears];

  const kept: StatusInstance[] = [];
  const actuallyCleared: StatusId[] = [];
  let existing: StatusInstance | null = null;

  for (const s of unit.statuses) {
    if (s.id === finalId) {
      existing = s;
      continue;
    }
    if (cleared.includes(s.id)) {
      actuallyCleared.push(s.id);
      continue;
    }
    kept.push(s);
  }

  const next: StatusInstance = existing
    ? {
        id: finalId,
        // Refreshing takes the longer of the two durations rather than stacking.
        duration: Math.max(existing.duration, finalDuration),
        stacks: Math.min(def.maxStacks, existing.stacks + 1),
      }
    : { id: finalId, duration: finalDuration, stacks: 1 };

  return {
    unit: { ...unit, statuses: [...kept, next] },
    applied: finalId,
    cleared: actuallyCleared,
  };
}

export function removeStatus(unit: Unit, id: StatusId): Unit {
  if (!unit.statuses.some((s) => s.id === id)) return unit;
  return { ...unit, statuses: unit.statuses.filter((s) => s.id !== id) };
}

export function removeStatuses(
  unit: Unit,
  ids: readonly StatusId[],
): { unit: Unit; removed: StatusId[] } {
  const removed = unit.statuses.filter((s) => ids.includes(s.id)).map((s) => s.id);
  if (removed.length === 0) return { unit, removed: [] };
  return { unit: { ...unit, statuses: unit.statuses.filter((s) => !ids.includes(s.id)) }, removed };
}

export interface StatusTick {
  readonly unit: Unit;
  readonly expired: readonly StatusId[];
  /** Damage-over-time to apply, already summed. Applied by the caller so that
   *  death and the resulting events are handled in one place. */
  readonly tickDamage: { readonly amount: number; readonly source: StatusId }[];
}

/**
 * Counts every status on this unit down by one and reports what fell off.
 * Called at the *owner's* turn start, which is why a 2-round Burning always
 * gets two ticks no matter where the owner sits in the initiative order.
 */
export function tickStatuses(content: ContentIndex, unit: Unit): StatusTick {
  const kept: StatusInstance[] = [];
  const expired: StatusId[] = [];
  const tickDamage: { amount: number; source: StatusId }[] = [];

  for (const s of unit.statuses) {
    const def = content.statuses.get(s.id);
    if (def && def.tickDamage > 0) {
      tickDamage.push({ amount: def.tickDamage, source: s.id });
    }
    const duration = s.duration - 1;
    if (duration <= 0) {
      expired.push(s.id);
      continue;
    }
    kept.push({ ...s, duration });
  }

  return { unit: { ...unit, statuses: kept }, expired, tickDamage };
}

/** Damage type a status ticks for, so incoming multipliers still apply. */
export function tickDamageType(content: ContentIndex, id: StatusId) {
  return content.statuses.get(id)?.tickDamageType ?? 'pure';
}

export function describeStatus(content: ContentIndex, id: StatusId): string {
  return content.statuses.get(id)?.name ?? id;
}
