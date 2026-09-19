import type { BattleState, ContentIndex, Unit, Vec2 } from '../types';
import { affectedTiles, isValidTarget, movePoints, usableAbilities } from './abilities';
import { enterCost, occupiedCells, posKey, reachable } from './grid';
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
      .flatMap(occupiedCells)
      .map(posKey),
  );
  if (
    enterCost(
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
      .flatMap(occupiedCells)
      .map(posKey),
  );
  const cells = reachable(
    { grid: battle.grid, blocked, surfaces: content.surfaces, size: attacker.size },
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
    let found = false;
    for (const cell of cells.values()) {
      const caster = { ...attacker, pos: cell.pos };
      const atOrigin = {
        ...projected,
        units: projected.units.map((u) => (u.id === attackerId ? caster : u)),
      };
      for (let y = 0; y < battle.grid.height && !found; y++) {
        for (let x = 0; x < battle.grid.width; x++) {
          const aim = { x, y };
          if (!isValidTarget(content, atOrigin, caster, ability, aim).ok) continue;
          const affected = new Set(affectedTiles(battle.grid, caster, ability, aim).map(posKey));
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
