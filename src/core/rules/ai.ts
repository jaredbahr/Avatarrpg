/**
 * Enemy AI.
 *
 * One turn is a loop: score every (stand here, use this, on that) it can
 * afford, take the best one, repeat until the AP runs out or nothing scores.
 * It is deterministic under a seed, which is what lets the balance simulator
 * mean anything and what makes a bug reproducible from a save file.
 *
 * Search is ordered so the common case is cheap: try acting from where it
 * already stands first, and only enumerate reachable tiles if that fails. On a
 * 20x12 grid with 4 move points that is the difference between a few dozen
 * evaluations and a few thousand, which matters when the simulator runs
 * thousands of battles.
 *
 * Personality changes the weights, not the algorithm:
 *   aggressive  close the distance, ignore danger
 *   cautious    hold range, respect cover, avoid standing in fire
 *   support     buffing and healing outrank damage
 *   boss        as aggressive, but values reshaping the ground highly
 *
 * Height is a profile opinion rather than a flat constant (ADR 0061, E6): a
 * cautious archer pays 4 per tier for the high ground, support 3, aggressive 1
 * and the boss 0 — the Driller would rather close than climb.
 */

import type { RngCursor } from '../rng';
import type {
  Ability,
  AiProfile,
  BattleState,
  ContentIndex,
  Grid,
  StatusId,
  Unit,
  UnitSize,
  Vec2,
} from '../types';
import { raisedWallTile } from '../state/battleDraft';
import type { BattleDraft } from '../state/battleDraft';
import {
  affectedTiles,
  canUseAbility,
  heightReachBonus,
  isValidTarget,
  knownAbilities,
  resolveAbility,
  sameSide,
  shoveOrigin,
  unitsOnTiles,
  usableAbilities,
  validatingOrigin,
} from './abilities';
import { averageDamage, hitChance, positionHasCover } from './damage';
import { positionObscurement, weatherAt } from './obscurement';
import {
  distance,
  distanceToUnit,
  occupiedCells,
  posKey,
  reachable,
  samePos,
  tileAt,
  withTile,
} from './grid';
import { forecastReactions, shoveLedgeDropDamage } from './reactions';
import { SQUARE_FOOTPRINTS, footprintCells } from './footprint';
import { canMove, effectiveStats, isAlive } from './stats';
import { findCombo } from './surfaces';
import { directAttackThreats, type ThreatBudget } from './directAttackThreats';
import { refreshTurnResources, tickTurnStart } from './turnStart';

/** How much the AI wants to inflict each status, in "points of damage". */
const STATUS_VALUE: Record<StatusId, number> = {
  stunned: 14,
  frozen: 14,
  chiBlocked: 11,
  rooted: 7,
  blinded: 7,
  shocked: 6,
  burning: 6,
  slowed: 5,
  wet: 3,
  chilled: 3,
  guarded: 9,
  inspired: 9,
};

interface Weights {
  readonly damage: number;
  readonly kill: number;
  readonly status: number;
  readonly support: number;
  readonly terrain: number;
  /** Multiplier on how much it dislikes standing somewhere dangerous. */
  readonly selfPreservation: number;
  /** Points lost per tile of distance from the nearest target. */
  readonly closeDistance: number;
  /** Points gained for ending the move in cover. */
  readonly cover: number;
  /** Points gained per elevation tier of the tile it ends its move on. */
  readonly elevation: number;
  /** Friendly-fire aversion. Above 1 means it actively avoids its own side. */
  readonly friendlyFire: number;
}

const WEIGHTS: Record<AiProfile, Weights> = {
  aggressive: {
    damage: 1,
    kill: 25,
    status: 0.8,
    support: 0.5,
    terrain: 0.4,
    selfPreservation: 0.3,
    closeDistance: 1.4,
    cover: 1,
    elevation: 1,
    friendlyFire: 1.5,
  },
  cautious: {
    damage: 1,
    kill: 22,
    status: 1,
    support: 0.8,
    terrain: 0.8,
    selfPreservation: 1.2,
    closeDistance: 0.5,
    cover: 5,
    elevation: 4,
    friendlyFire: 2,
  },
  support: {
    damage: 0.6,
    kill: 18,
    status: 1.2,
    support: 2,
    terrain: 0.6,
    selfPreservation: 1,
    closeDistance: 0.4,
    cover: 4,
    elevation: 3,
    friendlyFire: 2.5,
  },
  boss: {
    damage: 1.1,
    kill: 28,
    status: 1,
    support: 0.4,
    terrain: 1.6,
    selfPreservation: 0.2,
    closeDistance: 1,
    cover: 0,
    elevation: 0,
    friendlyFire: 0.8,
  },
  none: {
    damage: 1,
    kill: 20,
    status: 1,
    support: 1,
    terrain: 0.5,
    selfPreservation: 1,
    closeDistance: 1,
    cover: 1,
    // Unchanged from the old flat value: `none` is not a personality.
    elevation: 1.5,
    friendlyFire: 2,
  },
};

/** How much a surface on one cell hurts: fire burns, oil is a liability. */
function surfaceDanger(draft: BattleDraft, pos: Vec2): number {
  const tile = tileAt(draft.grid, pos);
  if (!tile?.surface) return 0;
  switch (tile.surface.id) {
    case 'fire':
      return 14;
    case 'oil':
      return 5;
    case 'mud':
      return 2;
    case 'water':
      return 1;
    case 'ice':
      return 1;
    default:
      return 0;
  }
}

/** How unpleasant it is to stand on a single cell: fire hurts, oil is a liability. */
function tileDanger(draft: BattleDraft, pos: Vec2): number {
  return propDanger(draft, pos) + surfaceDanger(draft, pos);
}

/**
 * Standing next to something that is about to go off.
 *
 * Deliberately small. This pulls against `candidateTargets` — the AI has to walk
 * into range of the barrel it wants to shoot, and a large penalty here makes it
 * refuse to approach its own best plan. Enough to stop a unit lounging beside a
 * brazier when a clear tile is right there, not enough to override wanting to
 * break it.
 */
function propDanger(
  draft: BattleDraft,
  pos: Vec2,
  size: UnitSize = 1,
  square: boolean = SQUARE_FOOTPRINTS,
): number {
  let worst = 0;
  for (const prop of draft.props) {
    // A big unit can brush a barrel with any of its cells, not only the anchor.
    // Gate-aware: with the square gate off this stays the anchor's distance, so
    // the shipped 2x1 keeps the danger it was tuned against.
    const near =
      square && size > 1
        ? distanceToUnit(prop.pos, { pos, size }, square) <= 1
        : distance(prop.pos, pos) <= 1;
    if (!near) continue;
    const def = draft.content.props.get(prop.propId);
    if (!def) continue;
    for (const effect of def.onBreak) {
      if (effect.kind === 'damage') worst = Math.max(worst, effect.base * 0.4);
      else if (effect.kind === 'surface' && effect.surface === 'fire') worst = Math.max(worst, 3);
    }
  }
  return worst;
}

/**
 * Danger of standing with the unit's footprint anchored on `pos`.
 *
 * A big unit can have fire or a barrel under any of its cells, not only the
 * anchor that `reachable` reports. Gate-aware: with the square gate off this is
 * the anchor alone, exactly as the shipped AI scored it.
 */
function footprintDanger(
  draft: BattleDraft,
  unit: Pick<Unit, 'size'>,
  pos: Vec2,
  square: boolean,
): number {
  if (!square || unit.size === 1) return tileDanger(draft, pos);
  let danger = propDanger(draft, pos, unit.size, true);
  for (const cell of footprintCells(pos, unit.size, true)) {
    danger = Math.max(danger, surfaceDanger(draft, cell));
  }
  return danger;
}

/**
 * Total danger of walking a path, not just of standing at the end of it.
 *
 * Without this the AI happily strolls through a burning tile to reach a safe
 * one, taking 4 damage and catching fire on the way. It was the single biggest
 * source of simulated party deaths on the oil map.
 */
function pathDanger(
  draft: BattleDraft,
  unit: Pick<Unit, 'size'>,
  path: readonly Vec2[],
  square: boolean,
): number {
  let total = 0;
  for (const step of path) total += footprintDanger(draft, unit, step, square);
  return total;
}

interface Plan {
  readonly score: number;
  readonly ability: Ability;
  readonly target: Vec2;
  /** Tile to stand on before acting; null means act from where it is. */
  readonly moveTo: Vec2 | null;
  readonly movePath: readonly Vec2[];
}

/**
 * Wall planning.
 *
 * A cautious bender will happily raise `earth_wall` across its own firing lane,
 * score the "shaped the ground" points, and then stand there with AP and no
 * legal action for the rest of the fight. Before paying for a wall we ask what
 * it costs the caster: if, from where it *stands*, the world after the wall
 * holds no enemy this unit could still strike, the placement is refused. A cell
 * it could walk to next turn does not count — that shot is already lost this
 * turn, which is the cost being judged, and a full-map search for a way around
 * its own wall belongs to the movement scorer, not here.
 *
 * The one good reason to accept that cost is the wall's defensive purpose:
 * shutting down an attack that can reach the caster on the attacker's next
 * turn. The shared direct-threat query receives the AP and cooldowns that
 * `beginTurn` would provide (with movement held at zero because this rule asks
 * whether this wall breaks the current firing lane), so an enemy that already
 * ended its turn still counts and a cooldown with more than one round left does
 * not. That query also checks every occupied cell of a size-2 defender.
 *
 * Everything below is pure geometry through the same targeting helpers the
 * planner uses, so the preview path stays RNG-free and the answer matches what
 * the AI will actually have available.
 */

/** Could this ability be turned on an enemy at all — damage, shove or a hex? */
function isOffensiveAbility(content: ContentIndex, ability: Ability): boolean {
  return ability.effects.some((effect) => {
    switch (effect.kind) {
      case 'damage':
      case 'push':
      case 'pull':
        return true;
      case 'status':
        return effect.to === 'hit' && content.statuses.get(effect.status)?.kind !== 'buff';
      default:
        return false;
    }
  });
}

/**
 * Enemies this caster can hit from where it stands, keyed by the caster's
 * identity and cell. One turn scores many walls from the same spot, so the scan
 * is paid for once per position rather than once per placement.
 */
type WallTargetCache = Map<string, readonly Unit[]>;

// This cache is scoped to one unchanged BattleDraft scoring pass. Never reuse it
// after the draft changes: its target and threat sets describe one battle snapshot.

/**
 * Battle snapshot for scoring a caster from a prospective standing position.
 *
 * The planner passes hypothetical casters into its scoring helpers, but the
 * draft still contains the unit at its current position. Keep the snapshot's
 * occupancy in step with that hypothetical (including every occupied cell of
 * a size-2 unit), so unit-target validation sees the caster where it would
 * actually stand.
 */
function battleWithHypotheticalCaster(battle: BattleState, caster: Unit): BattleState {
  return {
    ...battle,
    units: battle.units.map((unit) => (unit.id === caster.id ? caster : unit)),
  };
}

function preWallTargets(
  content: ContentIndex,
  battle: BattleState,
  caster: Unit,
  enemies: readonly Unit[],
  aims: readonly Vec2[],
  cache: WallTargetCache,
  squareFootprints: boolean,
): readonly Unit[] {
  const key = `targets|${caster.id}|${posKey(caster.pos)}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const targets = enemies.filter((enemy) =>
    canHitFrom(content, battle, caster, enemy, aims, squareFootprints),
  );
  cache.set(key, targets);
  return targets;
}

/**
 * The aims a stranding check may test: the same candidate tiles the planner
 * scores (`candidateTargets`), plus every cell an enemy occupies. A size-1
 * enemy's cell is already among the candidates; a size-2 unit's far cell only
 * joins the ring when the caster has an area shape, and it is a legal direct
 * aim either way.
 */
function strandingAims(draft: BattleDraft, caster: Unit, enemies: readonly Unit[]): Vec2[] {
  const aims = candidateTargets(draft, caster, usableAbilities(draft.content, caster));
  const seen = new Set(aims.map(posKey));
  for (const enemy of enemies) {
    for (const cell of occupiedCells(enemy, draft.squareFootprints)) {
      const key = posKey(cell);
      if (seen.has(key)) continue;
      seen.add(key);
      aims.push(cell);
    }
  }
  return aims;
}

/**
 * Can the caster turn a usable offensive ability onto `enemy` from where it
 * stands?
 *
 * An enemy counts as hittable when any legal aim's `affectedTiles` cover one of
 * its occupied cells, not only when an occupied cell is itself a legal aim. An
 * area ability can be aimed beside a target — a blast centred next to an enemy
 * still catches it — so the check walks the same candidate aims the planner
 * hands `bestActionFrom` rather than a hand-rolled rule.
 */
function canHitFrom(
  content: ContentIndex,
  battle: BattleState,
  caster: Unit,
  enemy: Unit,
  aims: readonly Vec2[],
  squareFootprints: boolean,
): boolean {
  const cells = new Set(occupiedCells(enemy, squareFootprints).map(posKey));
  for (const ability of usableAbilities(content, caster)) {
    if (!isOffensiveAbility(content, ability)) continue;
    for (const aim of aims) {
      if (!isValidTarget(content, battle, caster, ability, aim, squareFootprints).ok) continue;
      const affected = affectedTiles(content, battle.grid, caster, ability, aim, squareFootprints);
      if (affected.some((tile) => cells.has(posKey(tile)))) return true;
    }
  }
  return false;
}

/**
 * The budget an enemy will have when its own turn starts, or null when it
 * loses that activation outright (Frozen, Stunned). Built through the same
 * turn-start steps `beginTurn` uses, so one-round statuses that tick off before
 * the enemy acts — a lone Chi-Block — are not mistaken for lasting ones.
 *
 * `move` stays zero: this rule asks what the enemy can attack from where it
 * already stands, not what it could walk into range for.
 */
function nextTurnThreatBudget(content: ContentIndex, enemy: Unit): ThreatBudget | null {
  const opening = tickTurnStart(content, enemy);
  if (opening.skipping) return null;
  const next = refreshTurnResources(content, opening.unit, opening.skipping);
  return {
    ap: next.ap,
    move: 0,
    cooldowns: next.cooldowns,
    statuses: next.statuses,
  };
}

/** Enemies that can directly attack the caster on their next activation. */
function preWallThreats(
  content: ContentIndex,
  battle: BattleState,
  caster: Unit,
  enemies: readonly Unit[],
  cache: WallTargetCache,
): readonly Unit[] {
  const key = `threats|${caster.id}|${posKey(caster.pos)}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const threats = enemies.filter((enemy) => {
    const budget = nextTurnThreatBudget(content, enemy);
    if (!budget) return false;
    const result = directAttackThreats(content, battle, enemy.id, caster.id, budget);
    return result.valid && result.threats.length > 0;
  });
  cache.set(key, threats);
  return threats;
}

/** The clear ground a wall would actually fill; units and existing walls are skipped. */
function wallTilesThatRise(
  draft: BattleDraft,
  battle: BattleState,
  tiles: readonly Vec2[],
): Vec2[] {
  const occupied = new Set<string>();
  for (const unit of battle.units) {
    for (const cell of occupiedCells(unit, draft.squareFootprints)) occupied.add(posKey(cell));
  }
  return tiles.filter((pos) => {
    const tile = tileAt(draft.grid, pos);
    return tile !== undefined && !tile.blocked && !occupied.has(posKey(pos));
  });
}

/** The grid exactly as `raiseWall` would leave it for these tiles. */
function gridWithWall(draft: BattleDraft, tiles: readonly Vec2[]): Grid {
  let grid = draft.grid;
  for (const pos of tiles) {
    const tile = tileAt(grid, pos);
    if (!tile) continue;
    grid = withTile(grid, pos, raisedWallTile(tile));
  }
  return grid;
}

/**
 * True when this wall would shut the caster out of every enemy it can hit from
 * where it stands, and is not buying a defensive block in exchange. Exposed so
 * the wall tests can judge one specific placement without the planner's noise.
 */
export function wallStrandsCaster(
  draft: BattleDraft,
  caster: Unit,
  tiles: readonly Vec2[],
  cache: Map<string, readonly Unit[]> = new Map(),
): boolean {
  const content = draft.content;
  const squareFootprints = draft.squareFootprints;
  const before = battleWithHypotheticalCaster(draft.toBattle(), caster);
  const raised = wallTilesThatRise(draft, before, tiles);
  if (raised.length === 0) return false;

  const enemies = opponentsOf(draft, caster);
  if (enemies.length === 0) return false;

  const aims = strandingAims(draft, caster, enemies);
  const targets = preWallTargets(content, before, caster, enemies, aims, cache, squareFootprints);

  // With no ready shot before the wall, the placement costs the caster no
  // target and therefore cannot strand it. Future-turn opportunity is outside
  // this current-turn action scorer.
  if (targets.length === 0) return false;

  // The world exactly as the placement would leave it.
  const after: BattleState = { ...before, grid: gridWithWall(draft, raised) };
  // Still a shot at something it could hit before the wall? Then it costs nothing.
  if (targets.some((enemy) => canHitFrom(content, after, caster, enemy, aims, squareFootprints))) {
    return false;
  }

  // A wall that shuts down a next-turn direct attack is doing its job.
  for (const enemy of preWallThreats(content, before, caster, enemies, cache)) {
    const budget = nextTurnThreatBudget(content, enemy);
    if (!budget) continue;
    const result = directAttackThreats(content, after, enemy.id, caster.id, budget);
    if (result.valid && result.threats.length === 0) return false;
  }
  return true;
}

/**
 * Value of one ability aimed at one tile, from one standing position.
 *
 * `caster` is a hypothetical: when the AI is considering moving first, it is
 * passed a copy with the prospective position, so range and line of sight are
 * evaluated from where it *would* be.
 *
 * Exposed so the prop and ledge tests can price one specific aim without the
 * planner's choice of target getting in the way.
 */
export function scoreAbility(
  draft: BattleDraft,
  caster: Unit,
  ability: Ability,
  target: Vec2,
  weights: Weights,
  wallTargets: WallTargetCache,
): number {
  const content = draft.content;
  const squareFootprints = draft.squareFootprints;
  const tiles = affectedTiles(content, draft.grid, caster, ability, target, squareFootprints);
  // Score with the same firing cell resolution uses, so the AI's hit estimate
  // and the actual roll agree on elevation and plunging.
  const origin =
    validatingOrigin(content, draft.grid, caster, ability, target, true, squareFootprints) ??
    caster.pos;
  const struck = unitsOnTiles(draft.units, tiles, squareFootprints).filter(
    (u) => u.id !== caster.id,
  );
  const weather = weatherAt(content, draft.encounterId, draft.round);

  /*
   * Ledge-drop damage is read from the confirm-step forecast rather than
   * re-derived, so a change to the shove pathing or the tier rule reaches the
   * AI for free and the price it pays cannot drift from the number the preview
   * promises. Only the ability's own shove counts here: a unit flung by a
   * prop's on-break push has that fall priced by `scoreProps`, and adding it
   * again would charge the same drop twice. Built lazily: only a shove pays for
   * it, and `forecastReactions` runs on a throwaway draft so the live planning
   * state is untouched.
   */
  let ledgeByUnit: Map<string, number> | null = null;
  const ledgeDropFor = (victimId: string): number => {
    if (!ledgeByUnit) {
      const battle = battleWithHypotheticalCaster(draft.toBattle(), caster);
      // Measure the shove from the same cell resolution fires from, not the
      // anchor. A size-2 caster's second cell can be the validating origin, and
      // its push direction differs from `caster.pos`; omitting it here priced a
      // fall the shot would not deal (or missed one it would).
      const forecast = forecastReactions(
        content,
        battle,
        caster,
        ability,
        target,
        tiles,
        shoveOrigin(content, battle.grid, caster, ability, target, squareFootprints),
        squareFootprints,
      );
      ledgeByUnit = new Map<string, number>();
      for (const shove of forecast.shoves) {
        if (shove.kind !== 'unit' || shove.cause !== 'ability') continue;
        ledgeByUnit.set(shove.id, (ledgeByUnit.get(shove.id) ?? 0) + shove.ledgeDropDamage);
      }
    }
    return ledgeByUnit.get(victimId) ?? 0;
  };

  let score = 0;
  let touchedAnyone = false;

  for (const victim of struck) {
    const friendly = sameSide(caster, victim);
    touchedAnyone = true;

    /*
     * The forecast replays terrain and props, never the ability's own damage to
     * a unit, so it prices a fall against the victim's *current* hit points. In
     * play the damage lands first: a victim the hit is expected to kill pays
     * nothing extra for a corpse, and one left on its last hit point cannot be
     * dropped past the 1-HP floor. Sum the same expected damage the damage
     * effect scores with and price the fall against the HP that is actually
     * left when the shove arrives. Only built for an ability that can shove at
     * all, so a plain attack pays for none of it.
     */
    let fallCap = 0;
    if (isShoveAbility(ability)) {
      let expectedDamage = 0;
      for (const effect of ability.effects) {
        if (effect.kind !== 'damage') continue;
        expectedDamage += averageDamage(
          content,
          draft.grid,
          caster,
          victim,
          effect,
          weather,
          origin,
          squareFootprints,
        );
      }
      fallCap = Math.max(0, victim.hp - expectedDamage - 1);
    }
    // `ledgeDropFor` already totals every push/pull effect's drop for the
    // victim, so it is added once per victim below. Charging it on each
    // qualifying effect counted an N-shove ability's drop N times over.
    let fallPriced = false;

    for (const effect of ability.effects) {
      switch (effect.kind) {
        case 'damage': {
          const expected = averageDamage(
            content,
            draft.grid,
            caster,
            victim,
            effect,
            weather,
            origin,
            squareFootprints,
          );
          if (friendly) {
            score -= expected * weights.friendlyFire;
          } else {
            score += expected * weights.damage;
            if (expected >= victim.hp) score += weights.kill;
          }
          break;
        }
        case 'heal': {
          if (!friendly) break;
          const missing = victim.base.maxHp - victim.hp;
          if (missing <= 0) break;
          score += Math.min(missing, effect.base + effect.scale * 6) * weights.support;
          break;
        }
        case 'status': {
          if (effect.to === 'self') break;
          const value = STATUS_VALUE[effect.status] * effect.chance;
          const def = content.statuses.get(effect.status);
          const beneficial = def?.kind === 'buff';
          if (friendly === beneficial)
            score += value * (beneficial ? weights.support : weights.status);
          else score -= value * weights.friendlyFire;
          break;
        }
        case 'push':
        case 'pull': {
          const fall = fallPriced ? 0 : Math.min(ledgeDropFor(victim.id), fallCap);
          fallPriced = true;
          if (friendly) {
            // A friendly unit thrown over a lip still takes the fall. The direct
            // and prop-break paths both charge their friendly damage, so the
            // shove has to as well: without this an action that dropped an ally
            // and an enemy together scored as though only the enemy fell.
            score -= fall * weights.friendlyFire;
            break;
          }
          // Shoving somebody into fire is worth more than the shove itself.
          score += 2;
          // Over a ledge more still, up to the HP the hit leaves: the forecast
          // respects the 1-HP floor, but against the victim's full pool, so the
          // cap above is the part the ability's own damage moves.
          score += fall * weights.damage;
          break;
        }
        default:
          break;
      }
    }
  }

  for (const effect of ability.effects) {
    switch (effect.kind) {
      case 'status':
        if (effect.to === 'self') {
          const def = content.statuses.get(effect.status);
          if (def?.kind === 'buff') score += STATUS_VALUE[effect.status] * weights.support;
        }
        break;
      case 'surface': {
        // Reshaping the ground is only worth anything *near somebody*. Without
        // this gate a terrain-happy unit (the boss, with its mud churn) scores
        // positively every single turn and never advances on the party — which
        // is exactly the stalemate the simulator caught.
        const painted = effect.area === 'area' ? tiles : [target];
        const opponents = opponentsOf(draft, caster);
        let value = 0;

        for (const pos of painted) {
          const nearestOpponent = opponents.reduce(
            (best, o) => Math.min(best, distanceToUnit(pos, o, squareFootprints)),
            Infinity,
          );
          if (nearestOpponent > 2) continue;

          value += nearestOpponent <= 1 ? 1.2 : 0.5;

          const tile = tileAt(draft.grid, pos);
          const combo = findCombo(content, tile?.surface?.id ?? null, effect.surface);
          if (!combo) continue;
          const occupant = draft.unitAt(pos);
          value += combo.chainThroughExisting ? 8 : 3;
          if (occupant && !sameSide(caster, occupant)) value += 6;
          if (occupant && sameSide(caster, occupant)) value -= 6;
        }

        if (value === 0) break;
        score += value * weights.terrain;
        touchedAnyone = true;
        break;
      }
      case 'wall': {
        // Same gate: a wall in empty countryside accomplishes nothing.
        const opponents = opponentsOf(draft, caster);
        const near = tiles.some((pos) =>
          opponents.some((o) => distanceToUnit(pos, o, squareFootprints) <= 2),
        );
        if (!near) break;
        // Refuse a placement that seals the caster off from every enemy. A wall
        // that shuts a usable attack down is the defensive case and is allowed
        // through; one that merely walls the caster in is not.
        if (wallStrandsCaster(draft, caster, tiles, wallTargets)) return -Infinity;
        score += 4 * weights.terrain;
        touchedAnyone = true;
        break;
      }
      case 'dash':
        // Handled by the movement scorer; a bare dash is not an attack.
        score += 0.5;
        touchedAnyone = true;
        break;
      case 'grantAp':
        score += 4 * weights.support;
        break;
      case 'cleanse': {
        const self = draft.unit(caster.id);
        const relieved = self?.statuses.filter((s) => effect.statuses.includes(s.id)) ?? [];
        score += relieved.length * 5 * weights.support;
        break;
      }
      default:
        break;
    }
  }

  const propValue = scoreProps(draft, caster, ability, tiles, weights);
  if (propValue !== 0) {
    score += propValue;
    // Without this the plan scores well and is then thrown away at the check
    // below, which is the single easiest way to build a prop-blind AI.
    touchedAnyone = true;
  }

  if (!touchedAnyone) return -Infinity;

  // Spend AP where it buys the most.
  return score / Math.max(1, ability.apCost);
}

/**
 * What breaking a prop in `tiles` is worth.
 *
 * A prop is not a unit, so `unitsOnTiles` never sees one and none of the scoring
 * above applies. What matters is not the prop but what it is holding: an oil
 * flask beside three people is a good target and an identical flask in an empty
 * corner is worthless, so everything here is valued by who is standing in the
 * blast, using the same friendly/hostile weights as a direct hit. Only a prop
 * this ability's own damage opens is priced at all; a shove that merely moves
 * one is not a break and is worth nothing here.
 *
 * Pure arithmetic, no RNG — `scoreAbility` is called from the preview path and
 * determinism depends on it staying that way.
 */
function scoreProps(
  draft: BattleDraft,
  caster: Unit,
  ability: Ability,
  tiles: readonly Vec2[],
  weights: Weights,
): number {
  const squareFootprints = draft.squareFootprints;
  const props = draft.propsOnTiles(tiles);
  if (props.length === 0) return 0;

  const damage = ability.effects.find((e) => e.kind === 'damage');
  let total = 0;

  // Only a prop whose break shoves somebody needs a battle snapshot, so build
  // it the first time a push effect actually lands on a victim.
  let shoveBattle: BattleState | null = null;
  const battleForShove = (): BattleState => {
    if (!shoveBattle) shoveBattle = battleWithHypotheticalCaster(draft.toBattle(), caster);
    return shoveBattle;
  };

  for (const prop of props) {
    const def = draft.content.props.get(prop.propId);
    if (!def) continue;

    // Would this actually open it? A plan that chips a barrel is worth much
    // less than one that bursts it.
    let breaks = false;
    if (damage && damage.kind === 'damage' && !def.immuneTo.includes(damage.damageType)) {
      const dealt = def.vulnerableTo.includes(damage.damageType) ? damage.base * 2 : damage.base;
      breaks = dealt >= prop.hp;
    }
    /*
     * A shove on its own never opens a prop, so it never runs `onBreak`.
     * `resolveAbility` moves a shove-targeted prop through `shoveProp`, which
     * cannot damage it — and the only damaging surface is fire at 4, which opens
     * no prop whose break would move or hurt the people beside it. Reading
     * `onBreak` off a shoved cart priced a cabbage burst resolution never
     * delivers, and its break push awarded a ledge drop for a victim the shove
     * never moves. Only a break this ability deals itself earns the forecast.
     */
    if (!breaks) continue;

    let value = 0;
    for (const effect of def.onBreak) {
      const radius = Math.max(1, effect.radius);
      for (const victim of draft.living()) {
        if (victim.id === caster.id) continue;
        if (distanceToUnit(prop.pos, victim, squareFootprints) > radius) continue;
        const friendly = sameSide(caster, victim);

        switch (effect.kind) {
          /*
           * Each component carries its own weight and the total is NOT weighted
           * again on the way out. Damage through a barrel is still damage: an
           * earlier version multiplied the whole result by `terrain` as well,
           * which halved it and made a brazier that hits two people score worse
           * than a single club swing.
           */
          case 'damage':
            value += friendly ? -effect.base * weights.friendlyFire : effect.base * weights.damage;
            break;
          case 'status': {
            const worth = STATUS_VALUE[effect.status] * effect.chance;
            value += friendly ? -worth * weights.friendlyFire : worth * weights.status;
            break;
          }
          case 'push': {
            // A burst prop can knock people over an edge too. Price that fall
            // through the same forecast the confirm preview reads.
            const drop = shoveLedgeDropDamage(
              draft.content,
              battleForShove(),
              caster,
              victim.id,
              prop.pos,
              effect.distance,
              'push',
              squareFootprints,
            );
            value += friendly ? -2 - drop * weights.friendlyFire : 2 + drop * weights.damage;
            break;
          }
          case 'surface': {
            // Only the ground-shaping half is a terrain decision, so only this
            // half takes the terrain weight.
            const tile = tileAt(draft.grid, prop.pos);
            const combo = findCombo(draft.content, tile?.surface?.id ?? null, effect.surface);
            const worth = combo?.chainThroughExisting ? 8 : 3;
            value += (friendly ? -worth : worth) * weights.terrain;
            break;
          }
        }
      }
    }

    // A shove with no affected unit or break consequence has no tactical value.
    // Leave it at zero so the planner falls through to repositioning instead of
    // spending AP nudging an empty prop back and forth.
    total += value;
  }

  return total;
}

/** Enemy units the caster would like to be near. */
function opponentsOf(draft: BattleDraft, unit: Unit): Unit[] {
  return draft.living().filter((u) => !sameSide(unit, u));
}

/** Best ability+target from a given standing position. */
function bestActionFrom(
  draft: BattleDraft,
  caster: Unit,
  abilities: readonly Ability[],
  weights: Weights,
  candidateTargets: readonly Vec2[],
): { score: number; ability: Ability; target: Vec2 } | null {
  const battle = battleWithHypotheticalCaster(draft.toBattle(), caster);
  // One scoring pass, one wall-target scan: every wall on the board is judged
  // from this caster's position before the pass ends.
  const wallTargets: WallTargetCache = new Map();
  let best: { score: number; ability: Ability; target: Vec2 } | null = null;

  for (const ability of abilities) {
    for (const target of candidateTargets) {
      const valid = isValidTarget(
        draft.content,
        battle,
        caster,
        ability,
        target,
        draft.squareFootprints,
      );
      if (!valid.ok) continue;
      const score = scoreAbility(draft, caster, ability, target, weights, wallTargets);
      if (score === -Infinity || score <= 0) continue;
      if (!best || score > best.score) best = { score, ability, target };
    }
  }
  return best;
}

/**
 * Tiles worth aiming at: every cell an opponent occupies, plus — for area
 * shapes — the tiles around them, so a blast can be centred between two
 * targets rather than always on one of them.
 */
export function candidateTargets(
  draft: BattleDraft,
  caster: Unit,
  abilities: readonly Ability[],
): Vec2[] {
  const wantsArea = abilities.some(
    (a) =>
      a.targeting.shape === 'blast' ||
      a.targeting.shape === 'cone' ||
      a.targeting.shape === 'line' ||
      a.targeting.shape === 'tile',
  );

  const out: Vec2[] = [];
  const seen = new Set<string>();
  const push = (pos: Vec2) => {
    const key = posKey(pos);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(pos);
  };

  for (const opponent of opponentsOf(draft, caster)) {
    // A size-2 opponent stands on two cells; both are targets, and for area
    // shapes both of their neighbourhoods are, so a blast can land between a
    // boss's cells rather than only on its anchor.
    for (const cell of occupiedCells(opponent, draft.squareFootprints)) {
      push(cell);
      if (!wantsArea) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          push({ x: cell.x + dx, y: cell.y + dy });
        }
      }
    }
  }

  /*
   * Props, but only ones that are near somebody.
   *
   * This is the gate the whole feature hangs on: `bestActionFrom` only scores
   * targets this function emits, so a barrel that is never enumerated can never
   * be scored, however clever the scoring is. The proximity rule mirrors the
   * surface gate in `scoreAbility` — without it a unit will happily spend its
   * turn shooting scenery on the far side of the map.
   */
  const opponents = opponentsOf(draft, caster);
  for (const prop of draft.props) {
    const nearest = opponents.reduce(
      (best, o) => Math.min(best, distanceToUnit(prop.pos, o, draft.squareFootprints)),
      Infinity,
    );
    if (nearest > 2) continue;
    push(prop.pos);
  }

  // Allies matter for support profiles and for buff/heal abilities.
  for (const friend of draft.living()) {
    if (!sameSide(caster, friend)) continue;
    push(friend.pos);
  }
  push(caster.pos);

  return out;
}

/**
 * Longest reach the unit currently has, for deciding whether it is "in the
 * fight". A range-3-plus line-of-sight ability gains the height-reach bonus
 * when it fires down from higher ground, so the estimate is measured against
 * each opponent's cells with the same rule `validatingOrigin` applies.
 */
export function bestReach(draft: BattleDraft, unit: Unit): number {
  let reach = 1;
  const opponents = opponentsOf(draft, unit);
  for (const ability of usableAbilities(draft.content, unit)) {
    if (ability.effects.every((e) => e.kind === 'dash')) continue;
    let abilityReach = ability.range;
    for (const opponent of opponents) {
      for (const target of occupiedCells(opponent, draft.squareFootprints)) {
        const origin = validatingOrigin(
          draft.content,
          draft.grid,
          unit,
          ability,
          target,
          false,
          draft.squareFootprints,
        );
        if (!origin) continue;
        abilityReach = Math.max(
          abilityReach,
          ability.range +
            heightReachBonus(
              draft.content,
              ability,
              tileAt(draft.grid, origin)?.elevation ?? 0,
              tileAt(draft.grid, target)?.elevation ?? 0,
            ),
        );
      }
    }
    reach = Math.max(reach, abilityReach);
  }
  return reach;
}

/** A shove ability moves a target against its will. */
function isShoveAbility(ability: Ability): boolean {
  return ability.effects.some((effect) => effect.kind === 'push' || effect.kind === 'pull');
}

/**
 * The points a unit gives up for standing on a shoveable lip, before its
 * profile's self-preservation scales them.
 */
const LEDGE_EDGE_RISK = 3;

/**
 * Standing where an adjacent enemy's shove would send it over an edge risks a
 * free fall. The trajectory has to match, not just the board: an enemy north of
 * a lip whose only drop is east pushes the unit south, away from the fall, and
 * cannot turn that lip into a shortcut. Kept deliberately small and
 * deterministic: it nudges a unit back from the lip without outbidding cover or
 * closing the distance.
 *
 * Exposed so the ledge tests can price one standing tile directly, without the
 * planner's choice of move in the way.
 */
export function ledgeExposure(draft: BattleDraft, unit: Unit, pos: Vec2): number {
  const squareFootprints = draft.squareFootprints;
  /*
   * The square 2x2 cannot be knocked off a non-ramp ledge at all: `slideFrom`
   * turns the lip into a wall for the whole block (its strict rule), so it
   * never reports a drop. Mirror that here — the position score must not pay for
   * a fall the shove cannot deal. With the gate off a size-2 unit keeps the
   * legacy 2x1 exposure it was tuned against.
   */
  if (squareFootprints && unit.size > 1) return 0;
  const battle = {
    ...draft.toBattle(),
    units: draft.units.map((candidate) =>
      candidate.id === unit.id ? { ...candidate, pos } : candidate,
    ),
  };
  /*
   * A size-2 unit stands on two cells and an attacker may only be able to reach
   * the trailing one — its anchor is two tiles away, so checking adjacency and
   * targeting from `pos` alone missed a shover that can legally hit the
   * footprint. Test every occupied cell and aim at whichever one the attacker
   * actually reaches. The slide still runs from the anchor, exactly as
   * `draft.shove` does.
   */
  const cells = occupiedCells({ ...unit, pos }, squareFootprints);
  for (const other of draft.living()) {
    if (sameSide(unit, other)) continue;
    for (const cell of cells) {
      if (distanceToUnit(cell, other, squareFootprints) > 1) continue;
      for (const ability of knownAbilities(draft.content, other)) {
        if (!isShoveAbility(ability)) continue;
        // Blast and tile shoves measure from the aimed cell, not the shover, and
        // a self-target cannot hit this unit. This deliberately narrow term
        // ignores those area-origin trajectories.
        if (
          ability.targeting.shape === 'self' ||
          ability.targeting.shape === 'blast' ||
          ability.targeting.shape === 'tile'
        )
          continue;
        if (!isValidTarget(draft.content, battle, other, ability, cell, squareFootprints).ok)
          continue;
        for (const effect of ability.effects) {
          if (effect.kind !== 'push' && effect.kind !== 'pull') continue;
          const origin = shoveOrigin(
            draft.content,
            draft.grid,
            other,
            ability,
            cell,
            squareFootprints,
          );
          const slide = draft.slideFrom(draft.moveContext(unit), pos, origin, 1, effect.kind);
          if (!samePos(slide.pos, pos) && slide.ledgeDropTiers > 0) return LEDGE_EDGE_RISK;
        }
      }
    }
  }
  return 0;
}

/**
 * How good it is to simply be standing on a tile, before any ability.
 *
 * Comfort (cover, high ground) only counts once the unit is actually close
 * enough to do something. Otherwise a cautious unit will happily sit on a
 * rubble tile across the map forever, which is the other half of the stalemate
 * the simulator found.
 */
function positionScore(
  draft: BattleDraft,
  unit: Unit,
  pos: Vec2,
  weights: Weights,
  reach: number,
  square: boolean,
): number {
  const opponents = opponentsOf(draft, unit);
  if (opponents.length === 0) return 0;

  let nearest = Infinity;
  for (const opponent of opponents) {
    nearest = Math.min(nearest, distanceToUnit(pos, opponent, square));
  }

  // Danger is deliberately *not* folded in here: callers weight the positional
  // part down when comparing it against an attack's value, and standing in a
  // fire tile is a real HP cost that should never be discounted alongside it.
  let score = -nearest * weights.closeDistance;

  if (nearest > reach) {
    // Out of the fight entirely: closing is the only thing that matters.
    score -= (nearest - reach) * 4;
    return score;
  }

  /*
   * Read the whole footprint: a big unit is in cover when any of its cells is,
   * and the same for the cloud-like obscurement that stands in for it. This is
   * gate-aware: with the square gate off it is the anchor alone, exactly as the
   * shipped AI scored it.
   */
  const cells = square ? footprintCells(pos, unit.size, true) : [pos];
  if (cells.some((cell) => positionHasCover(draft.content, draft.grid, cell))) {
    score += weights.cover;
  }
  // A cloud is cover that the opponent can still shoot into, so it is worth a
  // fraction of real cover — a full steam cloud scores a full `weights.cover`.
  let cloud = 0;
  for (const cell of cells) {
    cloud = Math.max(cloud, positionObscurement(draft.content, draft.grid, cell));
  }
  score += weights.cover * cloud;
  const tile = tileAt(draft.grid, pos);
  score += (tile?.elevation ?? 0) * weights.elevation;
  // An edge is only worth holding if nobody can turn it into a shortcut down.
  score -= ledgeExposure(draft, unit, pos) * weights.selfPreservation;

  return score;
}

/**
 * Runs one AI unit's whole turn against the draft.
 *
 * The loop is capped rather than run to exhaustion, because a unit with banked
 * AP and a 1-AP ability could otherwise spend a long time discovering that
 * nothing is worth doing.
 */
export function planAiTurn(draft: BattleDraft, unitId: string, rng: RngCursor): void {
  const content = draft.content;
  let acted = 0;

  for (let iteration = 0; iteration < 8; iteration++) {
    const unit = draft.unit(unitId);
    if (!unit || !isAlive(unit)) return;
    if (unit.ap <= 0 && unit.move <= 0) return;

    const weights = WEIGHTS[unit.ai] ?? WEIGHTS.none;
    const abilities = usableAbilities(content, unit).filter(
      (a) => canUseAbility(content, unit, a).ok,
    );
    const targets = candidateTargets(draft, unit, abilities);
    const reach = bestReach(draft, unit);

    // 1. Anything good from right here?
    const here =
      abilities.length > 0 ? bestActionFrom(draft, unit, abilities, weights, targets) : null;

    // 2. Anything better after moving? Only searched when standing still is
    //    weak, and only over tiles the unit can actually reach this turn.
    let plan: Plan | null = here
      ? {
          score: here.score,
          ability: here.ability,
          target: here.target,
          moveTo: null,
          movePath: [],
        }
      : null;

    if (canMove(content, unit) && unit.move > 0 && abilities.length > 0) {
      const cells = reachable(draft.moveContext(unit), unit.pos, unit.move);
      for (const cell of cells.values()) {
        if (cell.cost === 0) continue;
        const hypothetical: Unit = { ...unit, pos: cell.pos };
        const action = bestActionFrom(draft, hypothetical, abilities, weights, targets);
        if (!action) continue;
        // Moving costs nothing in AP, but standing somewhere bad costs plenty.
        const danger = footprintDanger(draft, unit, cell.pos, draft.squareFootprints);
        const pathRisk = pathDanger(draft, unit, cell.path, draft.squareFootprints);
        const adjusted =
          action.score +
          positionScore(draft, unit, cell.pos, weights, reach, draft.squareFootprints) * 0.25 -
          danger * weights.selfPreservation -
          pathRisk * weights.selfPreservation * 0.8 -
          cell.cost * 0.05;
        if (!plan || adjusted > plan.score) {
          plan = {
            score: adjusted,
            ability: action.ability,
            target: action.target,
            moveTo: cell.pos,
            movePath: cell.path,
          };
        }
      }
    }

    if (plan) {
      if (plan.moveTo && plan.movePath.length > 0) {
        walk(draft, unitId, plan.movePath);
        const moved = draft.unit(unitId);
        if (!moved || !isAlive(moved)) return;
      }
      const caster = draft.unit(unitId);
      if (!caster) return;
      if (!canUseAbility(content, caster, plan.ability).ok) return;
      const valid = isValidTarget(
        content,
        draft.toBattle(),
        caster,
        plan.ability,
        plan.target,
        draft.squareFootprints,
      );
      if (!valid.ok) continue;

      draft.spendAp(unitId, plan.ability.apCost);
      draft.setCooldown(unitId, plan.ability.id, plan.ability.cooldown);
      const acting = draft.unit(unitId);
      if (!acting) return;
      resolveAbility(draft, acting, plan.ability, plan.target, rng);
      acted++;
      continue;
    }

    // 3. Nothing worth doing. Reposition instead, then stop.
    if (canMove(content, unit) && unit.move > 0) {
      repositionToward(draft, unitId, weights, reach);
    }
    if (acted === 0) {
      // Deterministic jitter keeps two identical bandits from mirroring each
      // other forever when neither has a move worth making.
      rng.int(0, 3);
    }
    return;
  }
}

/** Walks a path one tile at a time so surfaces get their say on every step. */
function walk(draft: BattleDraft, unitId: string, path: readonly Vec2[]): void {
  const unit = draft.unit(unitId);
  if (!unit) return;
  let spent = 0;
  const ctx = draft.moveContext(unit);
  let from = unit.pos;

  for (const step of path) {
    const current = draft.unit(unitId);
    if (!current || !isAlive(current)) break;
    const cost = 1 + surfaceExtraCost(draft, step);
    if (spent + cost > current.move) break;
    draft.placeUnit(unitId, step);
    spent += cost;
    from = step;
  }

  const moved = draft.unit(unitId);
  if (!moved) return;
  draft.replace({ ...moved, move: Math.max(0, moved.move - spent) });
  if (spent > 0) {
    draft.emit({ type: 'unitMoved', unitId, path: [...path], cost: spent });
  }
  void ctx;
  void from;
}

function surfaceExtraCost(draft: BattleDraft, pos: Vec2): number {
  const tile = tileAt(draft.grid, pos);
  if (!tile?.surface) return 0;
  return draft.content.surfaces.get(tile.surface.id)?.moveCost ?? 0;
}

/** Walks toward the most attractive reachable tile when no ability is worth using. */
function repositionToward(
  draft: BattleDraft,
  unitId: string,
  weights: Weights,
  reach: number,
): void {
  const unit = draft.unit(unitId);
  if (!unit || unit.move <= 0) return;

  const cells = reachable(draft.moveContext(unit), unit.pos, unit.move);
  let best: { pos: Vec2; path: readonly Vec2[]; score: number } | null = null;

  for (const cell of cells.values()) {
    const danger = footprintDanger(draft, unit, cell.pos, draft.squareFootprints);
    const pathRisk = pathDanger(draft, unit, cell.path, draft.squareFootprints);
    const score =
      positionScore(draft, unit, cell.pos, weights, reach, draft.squareFootprints) -
      danger * weights.selfPreservation -
      pathRisk * weights.selfPreservation * 0.8 -
      cell.cost * 0.05;
    if (!best || score > best.score) best = { pos: cell.pos, path: cell.path, score };
  }

  if (!best || best.path.length === 0) return;
  walk(draft, unitId, best.path);
}

/* ------------------------------------------------------------------ */
/* Exposed for tests and for the hint system                           */
/* ------------------------------------------------------------------ */

/** Best single action the AI would take right now, without taking it. */
export function previewAiPlan(draft: BattleDraft, unitId: string) {
  const unit = draft.unit(unitId);
  if (!unit) return null;
  const weights = WEIGHTS[unit.ai] ?? WEIGHTS.none;
  const abilities = usableAbilities(draft.content, unit);
  const targets = candidateTargets(draft, unit, abilities);
  return bestActionFrom(draft, unit, abilities, weights, targets);
}

/** Exposed so the balance report can explain *why* a profile behaves as it does. */
export function weightsFor(profile: AiProfile): Weights {
  return WEIGHTS[profile] ?? WEIGHTS.none;
}

/**
 * The occupied cell nearest a point, for the "if it moves" half of a threat
 * estimate. A size-2 unit stands on two cells and either may be the closer
 * firing position; checking both keeps the reach and the hit elevation honest.
 * Ties keep `occupiedCells` order (the anchor first), so the result is
 * deterministic.
 */
function nearestOccupiedCell(unit: Unit, pos: Vec2, square: boolean): Vec2 {
  let best = unit.pos;
  let bestDistance = distance(best, pos);
  for (const cell of occupiedCells(unit, square)) {
    const cellDistance = distance(cell, pos);
    if (cellDistance < bestDistance) {
      best = cell;
      bestDistance = cellDistance;
    }
  }
  return best;
}

/** Utility used by the hint system: how threatened is this tile? */
export function threatAt(draft: BattleDraft, unit: Unit, pos: Vec2): number {
  let threat = 0;
  const weather = weatherAt(draft.content, draft.encounterId, draft.round);
  const square = draft.squareFootprints;
  const targetElevation = tileAt(draft.grid, pos)?.elevation ?? 0;
  for (const opponent of opponentsOf(draft, unit)) {
    const maxMove = effectiveStats(draft.content, opponent).maxMove;
    for (const ability of usableAbilities(draft.content, opponent)) {
      // The threatening enemy reaches a tile further when it stands higher
      // than this tile, using the same height-reach rule as target validation.
      //
      // When the tile is already in reach, `validatingOrigin` picks the firing
      // cell. Otherwise the estimate is "could it close and hit from here", so
      // the origin is the occupied cell it would move from — the nearest one,
      // ties going to `occupiedCells` order. Falling back to the anchor alone
      // would ignore a size-2 opponent's second cell, which can be a step
      // closer and higher, changing both the height reach and the hit
      // elevation.
      const origin =
        validatingOrigin(draft.content, draft.grid, opponent, ability, pos, false, square) ??
        nearestOccupiedCell(opponent, pos, square);
      const reach =
        ability.range +
        heightReachBonus(
          draft.content,
          ability,
          tileAt(draft.grid, origin)?.elevation ?? 0,
          targetElevation,
        );
      if (distance(origin, pos) > reach + maxMove) continue;
      const damage = ability.effects
        .filter((e): e is Extract<typeof e, { kind: 'damage' }> => e.kind === 'damage')
        .reduce(
          (sum, e) => sum + e.base + e.scale * effectiveStats(draft.content, opponent).power,
          0,
        );
      const hit = hitChance(
        draft.content,
        draft.grid,
        opponent,
        { ...unit, pos },
        weather,
        origin,
        square,
      );
      threat += damage * (hit / 100);
    }
  }
  return threat;
}
