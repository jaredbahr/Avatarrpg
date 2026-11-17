/**
 * The "stay safe" hint (#846).
 *
 * When a hero is low on health, or the enemy could hurt them badly on its next
 * turn, the HUD offers one short line that names something they can really do:
 * heal, Guard, or step out of reach. Nothing here describes the rules in
 * parallel. Who can hit whom comes from `directAttackThreats` (through the
 * movement-threat query the board's own warning uses), every ability named is
 * one the hero can use right now, and every tile is one they can walk to.
 *
 * Pure: no DOM, no state change, no RNG. The scene decides when to draw it and
 * remembers a dismissal in a `guidance.tip.*` flag.
 */

import {
  canUseAbility,
  knownAbilities,
  movePoints,
  targetableTiles,
} from '../../core/rules/abilities';
import { positionHasCover } from '../../core/rules/damage';
import { distance, occupiedCells, posKey, reachable, unitAt } from '../../core/rules/grid';
import { isTableControlled } from '../../core/rules/guests';
import { canMove, isAlive } from '../../core/rules/stats';
import type { Ability, BattleState, ContentIndex, Unit, Vec2 } from '../../core/types';
import type { MovementThreatView } from '../ui/movementThreats';

export type DefendHintKind = 'heal' | 'guard' | 'retreat';

export interface DefendHint {
  readonly kind: DefendHintKind;
  readonly text: string;
}

/** A hero at or under this share of their health is "low". */
export const LOW_HEALTH = 0.4;
/** A hero under this share, standing where an enemy could hit them, is worth a word. */
export const HURT_HEALTH = 0.7;
/** Most tiles asked about when looking for a safe step; the threat query is not free. */
const MAX_STEP_CANDIDATES = 16;

export type ThreatQuery = (
  battle: BattleState,
  defenderId: string,
  destination: Vec2,
) => MovementThreatView;

/** The persistent flag that stops one kind of hint for good (the `guidance.tip.*` family). */
export function defendHintFlag(kind: DefendHintKind): string {
  return `guidance.tip.defend.${kind}`;
}

const isHeal = (ability: Ability): boolean => ability.effects.some((e) => e.kind === 'heal');

/** A guard the hero can put on themselves: Guarded to self, or aimed at someone who may be them. */
function isSelfGuard(ability: Ability): boolean {
  const guards = ability.effects.some((e) => e.kind === 'status' && e.status === 'guarded');
  if (!guards) return false;
  if (ability.targeting.shape === 'self') return true;
  if (ability.effects.some((e) => e.kind === 'status' && e.status === 'guarded' && e.to === 'self'))
    return true;
  return ability.targeting.shape === 'unit' && ability.targeting.allow !== 'enemy';
}

/** A hurt friend (or the hero) this heal could be aimed at right now. */
function healTarget(
  content: ContentIndex,
  battle: BattleState,
  unit: Unit,
  ability: Ability,
): Unit | null {
  if (ability.targeting.shape === 'self') return unit.hp < unit.base.maxHp ? unit : null;
  let best: Unit | null = null;
  for (const tile of targetableTiles(content, battle, unit, ability)) {
    const there = unitAt(battle.units, tile);
    if (!there || there.faction === 'enemy' || there.hp >= there.base.maxHp) continue;
    if (!best || there.hp / there.base.maxHp < best.hp / best.base.maxHp) best = there;
  }
  return best;
}

/**
 * What to say to `unit` during their turn, or null for nothing. `threats` is
 * the board's own threat query, so "could hit here" means exactly what the move
 * preview means by it.
 */
export function defendHintFor(
  content: ContentIndex,
  battle: BattleState,
  unit: Unit,
  threats: ThreatQuery,
): DefendHint | null {
  if (battle.phase !== 'active' || !isAlive(unit) || !isTableControlled(unit)) return null;
  if (!battle.units.some((u) => u.faction === 'enemy' && isAlive(u))) return null;

  const fraction = unit.hp / Math.max(1, unit.base.maxHp);
  const low = fraction <= LOW_HEALTH;
  const here = threats(battle, unit.id, unit.pos);
  const exposed = here.invalidReason === null && here.enemies.length > 0;
  if (!low && !(exposed && fraction <= HURT_HEALTH)) return null;

  const abilities = knownAbilities(content, unit);
  const usable = (ability: Ability): boolean => canUseAbility(content, unit, ability).ok;

  // 1. A heal, when someone needs one and it can be cast now.
  if (low) {
    for (const ability of abilities) {
      if (!isHeal(ability) || !usable(ability)) continue;
      const patient = healTarget(content, battle, unit, ability);
      if (!patient) continue;
      const who = patient.id === unit.id ? 'yourself' : patient.name;
      return {
        kind: 'heal',
        text: `${unit.name} is low on health. ${ability.name} can heal ${who}.`,
      };
    }
  }

  // 2. Guard, which turns the next hits aside.
  const guard = abilities.find((a) => isSelfGuard(a) && usable(a));
  if (guard && (exposed || low)) {
    return {
      kind: 'guard',
      text: `${unit.name} could take a hit. ${guard.name} guards you so it hurts less.`,
    };
  }

  // 3. A step out of reach, or behind cover. Only for a hero who can still walk.
  if (exposed && unit.move > 0 && canMove(content, unit)) {
    const step = safeStep(content, battle, unit, threats);
    if (step) {
      return {
        kind: 'retreat',
        text: step.cover
          ? `${unit.name} could be hit here. Step behind cover so ranged attacks miss more.`
          : `${unit.name} could be hit here. Step out of reach to stay safe.`,
      };
    }
  }

  // Low, and nothing to do on their own turn: point at a friend who can heal.
  if (low) {
    for (const other of battle.units) {
      if (other.id === unit.id || !isAlive(other) || other.faction === 'enemy') continue;
      const ability = knownAbilities(content, other).find(isHeal);
      if (ability) {
        return {
          kind: 'heal',
          text: `${unit.name} is low on health. ${other.name} has ${ability.name}.`,
        };
      }
    }
  }
  return null;
}

/**
 * A tile the hero can walk to where no enemy could reach them next turn, or
 * failing that one with cover. Candidates are the farthest from the nearest
 * enemy first, capped, so the question stays cheap.
 */
function safeStep(
  content: ContentIndex,
  battle: BattleState,
  unit: Unit,
  threats: ThreatQuery,
): { readonly cover: boolean } | null {
  const blocked = new Set(
    battle.units
      .filter((u) => u.id !== unit.id && isAlive(u))
      .flatMap((u) => occupiedCells(u).map(posKey)),
  );
  const cells = reachable(
    {
      grid: battle.grid,
      blocked,
      surfaces: content.surfaces,
      size: unit.size,
      climbCost: content.tuning.climbCost,
    },
    unit.pos,
    movePoints(content, unit),
  );
  const enemies = battle.units.filter((u) => u.faction === 'enemy' && isAlive(u));
  const nearest = (pos: Vec2): number => Math.min(...enemies.map((e) => distance(pos, e.pos)));
  const candidates = [...cells.values()]
    .filter((cell) => posKey(cell.pos) !== posKey(unit.pos))
    .sort((a, b) => nearest(b.pos) - nearest(a.pos) || a.pos.y - b.pos.y || a.pos.x - b.pos.x)
    .slice(0, MAX_STEP_CANDIDATES);
  let coverStep = false;
  for (const cell of candidates) {
    const there = threats(battle, unit.id, cell.pos);
    if (there.invalidReason !== null) continue;
    if (there.enemies.length === 0) return { cover: false };
    if (positionHasCover(content, battle.grid, cell.pos)) coverStep = true;
  }
  return coverStep ? { cover: true } : null;
}
