/**
 * Bending practice on a village map (issue #284): the party steps up to a
 * practice ground and each bender throws their bend at a mark, one after the
 * other, so a player can watch the party bend outside a fight.
 *
 * It is presentation only. Nothing here reaches the reducer: the casts are
 * `abilityUsed` events made up for the animator, which plays them through the
 * same choreography combat uses (ADR 0055), so the clip, its painted effect,
 * its hit-stop and its sound are the combat ones. No damage event follows, so
 * nobody is struck and no state changes.
 *
 * Riverside's own practice is Dorin's form drill in `VillageLife`, which
 * records a flag through the reducer; this one records nothing.
 */

import type { Ability, ContentIndex, GameEvent, Unit, Vec2 } from '../../core/types';
import { isBendingAttack } from '../anim/bendHandoff';
import { BA_DAN_CANAL_BRIDGE, BA_DAN_WATER_CELLS } from '../../content/scenes/baDan';

export interface PracticeGround {
  readonly mapId: string;
  /** What the action calls the place, under its name. */
  readonly label: string;
  /** Practice is on offer while the leader stands within `reach` tiles of here (Chebyshev). */
  readonly anchor: Vec2;
  readonly reach: number;
  /** The tile every bend is thrown at. */
  readonly mark: Vec2;
  /** Open water a water bender draws from: the nearest cell to them. */
  readonly water: readonly Vec2[];
}

/**
 * Ba Dan's south canal bank, east of the bridge's foot, inside the demo slice
 * (x 0-13, y 0-9). The bends go north-west at a mark on the canal's near edge,
 * so they burst over the open water, and Sura lifts her water out of the canal.
 * The bridge deck itself is within reach of Mira's table, a seat, where Wait
 * keeps the slot; west of the bridge the house hides a follower.
 */
export const BA_DAN_PRACTICE: PracticeGround = {
  mapId: 'ba_dan_village',
  label: 'Canal bank',
  anchor: { x: BA_DAN_CANAL_BRIDGE.x + 1, y: BA_DAN_CANAL_BRIDGE.y + 2 },
  reach: 1,
  mark: { x: 6, y: 7 },
  water: BA_DAN_WATER_CELLS,
};

const GROUNDS: readonly PracticeGround[] = [BA_DAN_PRACTICE];

const chebyshev = (a: Vec2, b: Vec2): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** The practice ground the leader stands at on this map, or null. */
export function practiceAt(mapId: string | undefined, leader: Vec2): PracticeGround | null {
  return (
    GROUNDS.find(
      (ground) => ground.mapId === mapId && chebyshev(leader, ground.anchor) <= ground.reach,
    ) ?? null
  );
}

/** Whether this map has a practice ground at all, so the scene knows to warm the bends. */
export function hasPractice(mapId: string | undefined): boolean {
  return GROUNDS.some((ground) => ground.mapId === mapId);
}

/** The bend a member practises: the first ability in their kit that plays their bend in combat. */
export function practiceAbility(content: ContentIndex, unit: Unit): Ability | undefined {
  for (const id of unit.abilities) {
    const ability = content.abilities.get(id);
    if (ability && isBendingAttack(unit, ability)) return ability;
  }
  return undefined;
}

/** One practice throw. */
export interface PracticeCast {
  readonly unitId: string;
  readonly sprite: string;
  readonly abilityId: string;
  readonly from: Vec2;
  readonly target: Vec2;
  /** Where a water bender draws from. */
  readonly source?: Vec2;
}

/** The open-water cell nearest `from`, ties to the one nearer the mark, then west. */
function nearestWater(ground: PracticeGround, from: Vec2): Vec2 | undefined {
  let best: Vec2 | undefined;
  const key = (cell: Vec2) => [
    Math.hypot(cell.x - from.x, cell.y - from.y),
    chebyshev(cell, ground.mark),
    cell.x,
    cell.y,
  ];
  for (const cell of ground.water) {
    if (cell.x === ground.mark.x && cell.y === ground.mark.y) continue;
    if (!best) {
      best = cell;
      continue;
    }
    const a = key(cell);
    const b = key(best);
    const i = a.findIndex((v, n) => v !== b[n]);
    if (i >= 0 && (a[i] ?? 0) < (b[i] ?? 0)) best = cell;
  }
  return best;
}

/**
 * Who throws, in party order: every member with a bend to practise who does
 * not stand on the mark. `positions` are where each member is drawn standing,
 * by party index.
 */
export function practiceCasts(
  content: ContentIndex,
  party: readonly Unit[],
  positions: readonly Vec2[],
  ground: PracticeGround,
): PracticeCast[] {
  const casts: PracticeCast[] = [];
  party.forEach((unit, index) => {
    const from = positions[index];
    const ability = practiceAbility(content, unit);
    if (!from || !ability || chebyshev(from, ground.mark) === 0) return;
    const source = ability.element === 'water' ? nearestWater(ground, from) : undefined;
    casts.push({
      unitId: unit.id,
      sprite: unit.sprite,
      abilityId: ability.id,
      from,
      target: ground.mark,
      ...(source ? { source } : {}),
    });
  });
  return casts;
}

/** The events the animator plays for a practice: one cast each, nothing struck. */
export function practiceEvents(casts: readonly PracticeCast[]): GameEvent[] {
  return casts.map((cast) => ({
    type: 'abilityUsed',
    unitId: cast.unitId,
    abilityId: cast.abilityId,
    target: cast.target,
    tiles: [cast.target],
  }));
}

/** The units as the choreography needs them: the party where each is drawn standing. */
export function practiceUnits(party: readonly Unit[], positions: readonly Vec2[]): Unit[] {
  return party.map((unit, index) => ({ ...unit, pos: positions[index] ?? unit.pos }));
}

/** Where each water bender draws from, by unit id, for the animator. */
export function practiceSources(casts: readonly PracticeCast[]): Record<string, Vec2> {
  const sources: Record<string, Vec2> = {};
  for (const cast of casts) if (cast.source) sources[cast.unitId] = cast.source;
  return sources;
}
