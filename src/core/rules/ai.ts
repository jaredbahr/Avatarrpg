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
 */

import type { RngCursor } from '../rng';
import type { Ability, AiProfile, StatusId, Unit, Vec2 } from '../types';
import type { BattleDraft } from '../state/battleDraft';
import {
  affectedTiles,
  canUseAbility,
  isValidTarget,
  resolveAbility,
  sameSide,
  unitsOnTiles,
  usableAbilities,
} from './abilities';
import { averageDamage, hitChance, positionHasCover } from './damage';
import { distance, distanceToUnit, euclidean, posKey, reachable, tileAt } from './grid';
import { effectiveStats, isAlive } from './stats';
import { findCombo } from './surfaces';

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
    friendlyFire: 2,
  },
};

/** How unpleasant it is to stand on a tile: fire hurts, oil is a liability. */
function tileDanger(draft: BattleDraft, pos: Vec2): number {
  const tile = tileAt(draft.grid, pos);
  let danger = propDanger(draft, pos);
  if (!tile?.surface) return danger;
  switch (tile.surface.id) {
    case 'fire':
      danger += 14;
      break;
    case 'oil':
      danger += 5;
      break;
    case 'mud':
      danger += 2;
      break;
    case 'water':
      danger += 1;
      break;
    case 'ice':
      danger += 1;
      break;
    default:
      break;
  }
  return danger;
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
function propDanger(draft: BattleDraft, pos: Vec2): number {
  let worst = 0;
  for (const prop of draft.props) {
    if (distance(prop.pos, pos) > 1) continue;
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
 * Total danger of walking a path, not just of standing at the end of it.
 *
 * Without this the AI happily strolls through a burning tile to reach a safe
 * one, taking 4 damage and catching fire on the way. It was the single biggest
 * source of simulated party deaths on the oil map.
 */
function pathDanger(draft: BattleDraft, path: readonly Vec2[]): number {
  let total = 0;
  for (const step of path) total += tileDanger(draft, step);
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
 * Value of one ability aimed at one tile, from one standing position.
 *
 * `caster` is a hypothetical: when the AI is considering moving first, it is
 * passed a copy with the prospective position, so range and line of sight are
 * evaluated from where it *would* be.
 */
function scoreAbility(
  draft: BattleDraft,
  caster: Unit,
  ability: Ability,
  target: Vec2,
  weights: Weights,
): number {
  const content = draft.content;
  const tiles = affectedTiles(draft.grid, caster, ability, target);
  const struck = unitsOnTiles(draft.units, tiles).filter((u) => u.id !== caster.id);

  let score = 0;
  let touchedAnyone = false;

  for (const victim of struck) {
    const friendly = sameSide(caster, victim);
    touchedAnyone = true;

    for (const effect of ability.effects) {
      switch (effect.kind) {
        case 'damage': {
          const expected = averageDamage(content, draft.grid, caster, victim, effect);
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
          if (friendly) break;
          // Shoving somebody into fire is worth more than the shove itself.
          score += 2;
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
            (best, o) => Math.min(best, distanceToUnit(pos, o)),
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
        const near = tiles.some((pos) => opponents.some((o) => distanceToUnit(pos, o) <= 2));
        if (!near) break;
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
 * What breaking (or shoving) the props in `tiles` is worth.
 *
 * A prop is not a unit, so `unitsOnTiles` never sees one and none of the scoring
 * above applies. What matters is not the prop but what it is holding: an oil
 * flask beside three people is a good target and an identical flask in an empty
 * corner is worthless, so everything here is valued by who is standing in the
 * blast, using the same friendly/hostile weights as a direct hit.
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
  const props = draft.propsOnTiles(tiles);
  if (props.length === 0) return 0;

  const damage = ability.effects.find((e) => e.kind === 'damage');
  const shoves = ability.effects.some((e) => e.kind === 'push' || e.kind === 'pull');
  let total = 0;

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
    if (!breaks && !shoves) continue;

    let value = 0;
    for (const effect of def.onBreak) {
      const radius = Math.max(1, effect.radius);
      for (const victim of draft.living()) {
        if (victim.id === caster.id) continue;
        if (distanceToUnit(prop.pos, victim) > radius) continue;
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
          case 'push':
            value += friendly ? -2 : 2;
            break;
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

    // Shoving a barrel with nobody near it is still mildly useful — it is cover
    // on the move — but it must never beat hitting a person.
    if (shoves && value === 0) value = 0.5;
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
  const battle = draft.toBattle();
  let best: { score: number; ability: Ability; target: Vec2 } | null = null;

  for (const ability of abilities) {
    for (const target of candidateTargets) {
      if (!isValidTarget(draft.content, battle, caster, ability, target).ok) continue;
      const score = scoreAbility(draft, caster, ability, target, weights);
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
function candidateTargets(draft: BattleDraft, caster: Unit, abilities: readonly Ability[]): Vec2[] {
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
    push(opponent.pos);
    if (!wantsArea) continue;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        push({ x: opponent.pos.x + dx, y: opponent.pos.y + dy });
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
    const nearest = opponents.reduce((best, o) => Math.min(best, distanceToUnit(prop.pos, o)), Infinity);
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

/** Longest reach the unit currently has, for deciding whether it is "in the fight". */
function bestReach(draft: BattleDraft, unit: Unit): number {
  let reach = 1;
  for (const ability of usableAbilities(draft.content, unit)) {
    if (ability.effects.every((e) => e.kind === 'dash')) continue;
    reach = Math.max(reach, ability.range);
  }
  return reach;
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
): number {
  const opponents = opponentsOf(draft, unit);
  if (opponents.length === 0) return 0;

  let nearest = Infinity;
  for (const opponent of opponents) {
    nearest = Math.min(nearest, distanceToUnit(pos, opponent));
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

  if (positionHasCover(draft.content, draft.grid, pos)) score += weights.cover;
  const tile = tileAt(draft.grid, pos);
  score += (tile?.elevation ?? 0) * 1.5;

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

    if (unit.move > 0 && abilities.length > 0) {
      const cells = reachable(draft.moveContext(unit), unit.pos, unit.move);
      for (const cell of cells.values()) {
        if (cell.cost === 0) continue;
        const hypothetical: Unit = { ...unit, pos: cell.pos };
        const action = bestActionFrom(draft, hypothetical, abilities, weights, targets);
        if (!action) continue;
        // Moving costs nothing in AP, but standing somewhere bad costs plenty.
        const adjusted =
          action.score +
          positionScore(draft, unit, cell.pos, weights, reach) * 0.25 -
          tileDanger(draft, cell.pos) * weights.selfPreservation -
          pathDanger(draft, cell.path) * weights.selfPreservation * 0.8 -
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
      if (!isValidTarget(content, draft.toBattle(), caster, plan.ability, plan.target).ok) continue;

      draft.spendAp(unitId, plan.ability.apCost);
      draft.setCooldown(unitId, plan.ability.id, plan.ability.cooldown);
      const acting = draft.unit(unitId);
      if (!acting) return;
      resolveAbility(draft, acting, plan.ability, plan.target, rng);
      acted++;
      continue;
    }

    // 3. Nothing worth doing. Reposition instead, then stop.
    if (unit.move > 0) {
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
    const score =
      positionScore(draft, unit, cell.pos, weights, reach) -
      tileDanger(draft, cell.pos) * weights.selfPreservation -
      pathDanger(draft, cell.path) * weights.selfPreservation * 0.8 -
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

/** Utility used by the hint system: how threatened is this tile? */
export function threatAt(draft: BattleDraft, unit: Unit, pos: Vec2): number {
  let threat = 0;
  for (const opponent of opponentsOf(draft, unit)) {
    for (const ability of usableAbilities(draft.content, opponent)) {
      if (
        distance(opponent.pos, pos) >
        ability.range + effectiveStats(draft.content, opponent).maxMove
      ) {
        continue;
      }
      const damage = ability.effects
        .filter((e): e is Extract<typeof e, { kind: 'damage' }> => e.kind === 'damage')
        .reduce(
          (sum, e) => sum + e.base + e.scale * effectiveStats(draft.content, opponent).power,
          0,
        );
      threat += damage * (hitChance(draft.content, draft.grid, opponent, unit) / 100);
    }
  }
  return threat + euclidean(pos, unit.pos) * 0;
}
