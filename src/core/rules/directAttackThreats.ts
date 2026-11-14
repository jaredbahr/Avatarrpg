import type { BattleState, ContentIndex, Unit, Vec2 } from '../types';
import {
  affectedTiles,
  canReachFromHeight,
  isValidTarget,
  movePoints,
  usableAbilities,
} from './abilities';
import { distance, occupiedCells, posKey, reachable, samePos, standCost } from './grid';
import { canMove, isAlive } from './stats';

/** Caller chooses the resource/status snapshot; no next-turn timing is inferred. */
export type ThreatBudget = Pick<Unit, 'ap' | 'move' | 'cooldowns' | 'statuses'>;

export interface DirectAttackWitness {
  readonly abilityId: string;
  readonly path: readonly Vec2[];
  readonly moveCost: number;
  readonly origin: Vec2;
  readonly aim: Vec2;
  readonly affectedDefenderCells: readonly Vec2[];
}

export type DirectAttackThreatResult =
  | { readonly valid: false; readonly reason: string }
  | { readonly valid: true; readonly threats: readonly DirectAttackWitness[] };

/**
 * Possible direct attack geometry after ordinary movement, one witness per
 * ability. Not AI intent, damage certainty, or a declaration that an empty
 * result is safe: prop/terrain chains, multiple casts, dashes and movement
 * contact effects are outside this query. Hazardous paths are geometric routes,
 * not promises that the attacker survives or retains its actions along them.
 *
 * Query on selection/confirmation, not every frame. Callers may cache by battle
 * identity, attacker, explicit budget and defender destination. A proposed
 * destination replaces the defender's occupancy before enemy paths are found.
 * No source state or RNG is changed.
 */
export function directAttackThreats(
  content: ContentIndex,
  battle: BattleState,
  attackerId: string,
  defenderId: string,
  budget: ThreatBudget,
  destination?: Vec2,
): DirectAttackThreatResult {
  const source = battle.units.find((u) => u.id === attackerId && isAlive(u));
  const defender = battle.units.find((u) => u.id === defenderId && isAlive(u));
  if (!source || !defender || attackerId === defenderId) {
    return { valid: false, reason: 'Select distinct living attacker and defender units.' };
  }
  if (![budget.ap, budget.move].every((n) => Number.isFinite(n) && n >= 0)) {
    return { valid: false, reason: 'Supply finite nonnegative action and movement budgets.' };
  }
  const pos = destination ?? defender.pos;
  if (!Number.isInteger(pos.x) || !Number.isInteger(pos.y)) {
    return { valid: false, reason: 'The defender destination must be a grid cell.' };
  }
  const occupiedByOthers = new Set(
    battle.units
      .filter((u) => u.id !== defenderId && isAlive(u))
      .flatMap((unit) => occupiedCells(unit))
      .map(posKey),
  );
  if (
    standCost(
      {
        grid: battle.grid,
        blocked: occupiedByOthers,
        surfaces: content.surfaces,
        size: defender.size,
      },
      pos,
    ) === null
  ) {
    return { valid: false, reason: 'The defender destination is blocked.' };
  }
  const projectedDefender = { ...defender, pos };
  const attacker: Unit = { ...source, ...budget };
  const projected: BattleState = {
    ...battle,
    units: battle.units.map((u) =>
      u.id === defenderId ? projectedDefender : u.id === attackerId ? attacker : u,
    ),
  };
  const blocked = new Set(
    projected.units
      .filter((u) => u.id !== attackerId && isAlive(u))
      .flatMap((unit) => occupiedCells(unit))
      .map(posKey),
  );
  const cells = reachable(
    {
      grid: battle.grid,
      blocked,
      surfaces: content.surfaces,
      size: attacker.size,
      climbCost: content.tuning.climbCost,
    },
    attacker.pos,
    canMove(content, attacker) ? movePoints(content, attacker) : 0,
  );
  const defenderCells = occupiedCells(projectedDefender);
  const threats: DirectAttackWitness[] = [];
  for (const ability of usableAbilities(content, attacker)) {
    if (!ability.effects.some((e) => e.kind === 'damage')) continue;
    // A displacement before damage needs an ordered effect forecast instead.
    const firstDamage = ability.effects.findIndex((e) => e.kind === 'damage');
    if (
      ability.effects.slice(0, firstDamage).some((e) => ['dash', 'push', 'pull'].includes(e.kind))
    )
      continue;
    const shape = ability.targeting;
    const reach = Math.ceil(
      ability.range +
        (canReachFromHeight(ability) ? Math.max(0, content.tuning.heightReachBonus) : 0),
    );
    let found = false;
    for (const cell of cells.values()) {
      const caster = { ...attacker, pos: cell.pos };
      const atOrigin = {
        ...projected,
        units: projected.units.map((u) => (u.id === attackerId ? caster : u)),
      };
      const casterCells = occupiedCells(caster);
      // Self abilities accept any aim. Other shapes have to reach the aim
      // from a footprint cell, even when they hit a different defender cell.
      const minX = shape.shape === 'self' ? 0 : Math.max(0, cell.pos.x - reach);
      const minY = shape.shape === 'self' ? 0 : Math.max(0, cell.pos.y - reach);
      const last = casterCells[casterCells.length - 1]!;
      const maxX =
        shape.shape === 'self'
          ? battle.grid.width - 1
          : Math.min(battle.grid.width - 1, last.x + reach);
      const maxY =
        shape.shape === 'self'
          ? battle.grid.height - 1
          : Math.min(battle.grid.height - 1, last.y + reach);
      // Keep the original row-major first witness. Only filter aims which
      // cannot reach a defender footprint cell under the existing shape rule.
      for (let y = minY; y <= maxY && !found; y++) {
        for (let x = minX; x <= maxX; x++) {
          const aim = { x, y };
          if (
            (shape.shape === 'unit' || shape.shape === 'tile') &&
            !defenderCells.some((pos) => samePos(pos, aim))
          )
            continue;
          if (
            shape.shape === 'blast' &&
            !defenderCells.some((pos) => distance(pos, aim) <= shape.radius)
          )
            continue;
          if (!isValidTarget(content, atOrigin, caster, ability, aim).ok) continue;
          const affected = new Set(
            affectedTiles(content, battle.grid, caster, ability, aim).map(posKey),
          );
          const caught = defenderCells.filter((p) => affected.has(posKey(p)));
          if (caught.length === 0) continue;
          threats.push({
            abilityId: ability.id,
            path: cell.path,
            moveCost: cell.cost,
            origin: cell.pos,
            aim,
            affectedDefenderCells: caught,
          });
          found = true;
          break;
        }
      }
      if (found) break;
    }
  }
  return { valid: true, threats };
}
