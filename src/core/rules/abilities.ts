/**
 * Ability targeting, validation, preview and resolution.
 *
 * The preview path and the resolve path share every calculation they can
 * (`expectedDamage` vs `rollDamage`, the same `affectedTiles`), because the
 * fastest way to lose a nine-year-old's trust is to promise "12 damage, 80%"
 * and then do something else.
 *
 * Friendly fire is real for area shapes. A cone hits whoever is standing in
 * the cone. That is the cost of the big numbers, and it is the reason the
 * confirm step exists.
 */

import type { RngCursor } from '../rng';
import type {
  Ability,
  AbilityEffect,
  BattleState,
  ContentIndex,
  Grid,
  StatusId,
  Unit,
  Vec2,
} from '../types';
import type { BattleDraft } from '../state/battleDraft';
import {
  blastTiles,
  coneTiles,
  distance,
  distanceToUnit,
  enterCost,
  hasLineOfSight,
  inBounds,
  lineTiles,
  occupiedCells,
  posKey,
  tileAt,
} from './grid';
import { expectedDamage, healAmount, hitChance, rollDamage, rollHit } from './damage';
import { forecastReactions } from './reactions';
import type { ForecastEntry } from './reactions';
import { canUseAbilities, effectiveStats, isAlive } from './stats';

/* ------------------------------------------------------------------ */
/* Targeting geometry                                                  */
/* ------------------------------------------------------------------ */

/** Every tile an ability touches when aimed at `target`. */
export function affectedTiles(grid: Grid, caster: Unit, ability: Ability, target: Vec2): Vec2[] {
  switch (ability.targeting.shape) {
    case 'self':
      return occupiedCells(caster);
    case 'unit':
    case 'tile':
      return inBounds(grid, target) ? [target] : [];
    case 'blast':
      return blastTiles(grid, target, ability.targeting.radius);
    case 'line':
      return lineTiles(grid, caster.pos, target, ability.targeting.length);
    case 'cone':
      return coneTiles(grid, caster.pos, target, ability.targeting.length);
  }
}

/** True when the two units are on the same side (party and allies count as one). */
export function sameSide(a: Unit, b: Unit): boolean {
  const side = (u: Unit) => (u.faction === 'enemy' ? 'enemy' : 'friendly');
  return side(a) === side(b);
}

/** Living units standing on any of `tiles`. */
export function unitsOnTiles(units: readonly Unit[], tiles: readonly Vec2[]): Unit[] {
  const keys = new Set(tiles.map(posKey));
  return units.filter((u) => isAlive(u) && occupiedCells(u).some((c) => keys.has(posKey(c))));
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export interface UseCheck {
  readonly ok: boolean;
  /** Player-facing reason, already phrased for the HUD tooltip. */
  readonly reason: string;
}

const OK: UseCheck = { ok: true, reason: '' };

/** Can this unit use this ability *at all* right now, ignoring the target? */
export function canUseAbility(content: ContentIndex, unit: Unit, ability: Ability): UseCheck {
  if (!isAlive(unit)) return { ok: false, reason: 'Down.' };
  if (!unit.abilities.includes(ability.id)) return { ok: false, reason: 'Not learned yet.' };
  if (!canUseAbilities(content, unit)) return { ok: false, reason: 'Chi-blocked — cannot bend.' };

  const cooldown = unit.cooldowns[ability.id] ?? 0;
  if (cooldown > 0) {
    return {
      ok: false,
      reason: `Cooling down (${cooldown} more round${cooldown === 1 ? '' : 's'}).`,
    };
  }
  if (unit.ap < ability.apCost) {
    return { ok: false, reason: `Needs ${ability.apCost} AP, has ${unit.ap}.` };
  }
  return OK;
}

/** Is `target` a legal aim point for this ability? */
export function isValidTarget(
  content: ContentIndex,
  battle: BattleState,
  caster: Unit,
  ability: Ability,
  target: Vec2,
): UseCheck {
  if (ability.targeting.shape === 'self') return OK;
  if (!inBounds(battle.grid, target)) return { ok: false, reason: 'Off the map.' };

  const range = distanceToUnit(target, caster);
  if (range > ability.range) return { ok: false, reason: 'Out of range.' };
  if (range < ability.minRange) return { ok: false, reason: 'Too close.' };

  if (ability.requiresLineOfSight && !hasLineOfSight(battle.grid, caster.pos, target)) {
    return { ok: false, reason: 'No line of sight.' };
  }

  if (ability.targeting.shape === 'unit') {
    const occupant = unitsOnTiles(battle.units, [target])[0];
    if (!occupant) return { ok: false, reason: 'Nobody there.' };
    const allow = ability.targeting.allow;
    if (allow === 'enemy' && sameSide(caster, occupant)) {
      return { ok: false, reason: 'That is one of yours.' };
    }
    if (allow === 'ally' && !sameSide(caster, occupant)) {
      return { ok: false, reason: 'That is an enemy.' };
    }
    return OK;
  }

  if (ability.targeting.shape === 'tile' || ability.targeting.shape === 'blast') {
    const tile = tileAt(battle.grid, target);
    if (!tile) return { ok: false, reason: 'Off the map.' };
    // A dash has to land somewhere you could actually stand.
    if (ability.effects.some((e) => e.kind === 'dash')) {
      const blocked = new Set(
        battle.units
          .filter((u) => isAlive(u) && u.id !== caster.id)
          .flatMap((u) => occupiedCells(u).map(posKey)),
      );
      const cost = enterCost(
        { grid: battle.grid, blocked, surfaces: content.surfaces, size: caster.size },
        target,
      );
      if (cost === null) return { ok: false, reason: 'Cannot land there.' };
    }
    return OK;
  }

  return OK;
}

/** Every tile the player may legally tap for this ability. */
export function targetableTiles(
  content: ContentIndex,
  battle: BattleState,
  caster: Unit,
  ability: Ability,
): Vec2[] {
  if (ability.targeting.shape === 'self') return occupiedCells(caster);

  const out: Vec2[] = [];
  const reach = ability.range;
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const pos = { x: caster.pos.x + dx, y: caster.pos.y + dy };
      if (!inBounds(battle.grid, pos)) continue;
      if (isValidTarget(content, battle, caster, ability, pos).ok) out.push(pos);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Preview                                                             */
/* ------------------------------------------------------------------ */

export interface PreviewTarget {
  readonly unitId: string;
  readonly name: string;
  readonly friendly: boolean;
  /** Percentage, 5-99. Null when the effect cannot miss (heals, buffs). */
  readonly hitChance: number | null;
  readonly damage: number;
  readonly heal: number;
  readonly statuses: readonly { readonly id: StatusId; readonly chance: number }[];
  readonly lethal: boolean;
}

export interface AbilityPreview {
  readonly tiles: readonly Vec2[];
  readonly targets: readonly PreviewTarget[];
  /**
   * Non-terrain side effects — "Pushes 2", "+1 AP". What the ability does to
   * the *ground* is no longer described here, because describing it without
   * consulting the combo table is how the preview came to promise "Leaves
   * Fire" over a puddle. See `reactions` below.
   */
  readonly terrain: readonly string[];
  /** What the combo table will actually do, forecast by running it. */
  readonly reactions: readonly ForecastEntry[];
  /** True when at least one of the party is in the blast or in a chain. */
  readonly hitsFriendly: boolean;
}

/**
 * What the confirm step shows. Consumes no RNG, so opening and closing the
 * preview a dozen times cannot change the outcome of the shot.
 */
export function previewAbility(
  content: ContentIndex,
  battle: BattleState,
  caster: Unit,
  ability: Ability,
  target: Vec2,
): AbilityPreview {
  const tiles = affectedTiles(battle.grid, caster, ability, target);
  const isSelfShape = ability.targeting.shape === 'self';
  const inArea = unitsOnTiles(battle.units, tiles).filter((u) => isSelfShape || u.id !== caster.id);

  const targets: PreviewTarget[] = [];
  const terrain: string[] = [];

  for (const unit of inArea) {
    let damage = 0;
    let heal = 0;
    let chance: number | null = null;
    const statuses: { id: StatusId; chance: number }[] = [];
    const friendly = sameSide(caster, unit);

    for (const effect of ability.effects) {
      switch (effect.kind) {
        case 'damage':
          damage += expectedDamage(content, caster, unit, effect);
          chance = hitChance(content, battle.grid, caster, unit);
          break;
        case 'heal':
          if (friendly) heal += healAmount(content, caster, effect);
          break;
        case 'status':
          if (effect.to === 'hit') statuses.push({ id: effect.status, chance: effect.chance });
          break;
        default:
          break;
      }
    }

    if (damage === 0 && heal === 0 && statuses.length === 0) continue;
    targets.push({
      unitId: unit.id,
      name: unit.name,
      friendly,
      hitChance: chance,
      damage,
      heal,
      statuses,
      lethal: damage > 0 && damage >= unit.hp,
    });
  }

  for (const effect of ability.effects) {
    switch (effect.kind) {
      case 'wall':
        terrain.push('Raises a stone wall');
        break;
      case 'push':
        terrain.push(`Pushes ${effect.distance}`);
        break;
      case 'pull':
        terrain.push(`Pulls ${effect.distance}`);
        break;
      case 'dash':
        terrain.push('Moves you there');
        break;
      case 'grantAp':
        terrain.push(`+${effect.amount} AP`);
        break;
      case 'cleanse':
        terrain.push('Clears effects');
        break;
      case 'status':
        if (effect.to === 'self') {
          terrain.push(`You gain ${content.statuses.get(effect.status)?.name ?? effect.status}`);
        }
        break;
      default:
        break;
    }
  }

  const forecast = forecastReactions(content, battle, caster, ability, target, tiles);

  return {
    tiles,
    targets,
    terrain,
    reactions: forecast.entries,
    // A bolt of lightning that chains back through the puddle your own
    // waterbender is standing in counts as hitting your own side, even though
    // she is nowhere near the tile you aimed at.
    hitsFriendly: targets.some((t) => t.friendly && t.damage > 0) || forecast.catchesFriendly,
  };
}

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

/**
 * Where a push or pull measures from. Area shapes shove outward from (or drag
 * toward) the centre of the blast; everything else shoves away from the caster.
 */
function shoveOrigin(caster: Unit, ability: Ability, target: Vec2): Vec2 {
  return ability.targeting.shape === 'blast' || ability.targeting.shape === 'tile'
    ? target
    : caster.pos;
}

/**
 * Applies one ability to the draft. Assumes `canUseAbility` and
 * `isValidTarget` already passed — the reducer checks, this executes.
 *
 * Effects resolve in the order they are authored, which lets an ability soak a
 * target and *then* freeze it in the same action.
 */
export function resolveAbility(
  draft: BattleDraft,
  caster: Unit,
  ability: Ability,
  target: Vec2,
  rng: RngCursor,
): void {
  const tiles = affectedTiles(draft.grid, caster, ability, target);
  const isSelfShape = ability.targeting.shape === 'self';

  draft.emit({ type: 'abilityUsed', unitId: caster.id, abilityId: ability.id, target, tiles });

  // Snapshot who is standing where *before* anything moves, so a push in one
  // effect does not pull a unit out of the next effect's area.
  const struck = unitsOnTiles(draft.units, tiles).filter((u) => isSelfShape || u.id !== caster.id);
  const hitIds = struck.map((u) => u.id);
  const friendlyIds = struck.filter((u) => sameSide(caster, u)).map((u) => u.id);

  /** Ids that a to-hit roll actually connected with, per damage effect. */
  for (const effect of ability.effects) {
    applyEffect(draft, caster, ability, effect, target, tiles, hitIds, friendlyIds, rng);
  }
}

function applyEffect(
  draft: BattleDraft,
  caster: Unit,
  ability: Ability,
  effect: AbilityEffect,
  target: Vec2,
  tiles: readonly Vec2[],
  hitIds: readonly string[],
  friendlyIds: readonly string[],
  rng: RngCursor,
): void {
  const content = draft.content;

  switch (effect.kind) {
    case 'damage': {
      const landed: string[] = [];
      for (const id of hitIds) {
        const victim = draft.unit(id);
        if (!victim || !isAlive(victim)) continue;
        if (!rollHit(rng, content, draft.grid, caster, victim)) {
          draft.emit({ type: 'attackMissed', unitId: caster.id, targetId: id });
          continue;
        }
        const result = rollDamage(rng, content, caster, victim, effect);
        draft.dealDamage(id, result.amount, effect.damageType, caster.id, { crit: result.crit });
        landed.push(id);
      }
      if (effect.includesCaster) {
        const self = draft.unit(caster.id);
        if (self) {
          const result = rollDamage(rng, content, caster, self, effect);
          draft.dealDamage(caster.id, result.amount, effect.damageType, caster.id, {
            crit: false,
          });
        }
      }
      // The ground reacts wherever the ability landed, hit or miss.
      draft.impact(tiles, effect.damageType, caster.id);
      break;
    }

    case 'heal': {
      const amount = healAmount(content, caster, effect);
      const recipients = ability.targeting.shape === 'self' ? [caster.id] : friendlyIds;
      for (const id of recipients) draft.heal(id, amount);
      break;
    }

    case 'status': {
      if (effect.to === 'self') {
        if (rng.chance(effect.chance)) {
          draft.applyStatusTo(caster.id, effect.status, effect.duration);
        }
        break;
      }
      const recipients = effect.to === 'allies' ? friendlyIds : hitIds;
      for (const id of recipients) {
        if (!rng.chance(effect.chance)) continue;
        draft.applyStatusTo(id, effect.status, effect.duration);
      }
      break;
    }

    case 'surface': {
      const painted = effect.area === 'area' ? tiles : [target];
      draft.paint(painted, effect.surface, effect.duration, caster.id);
      break;
    }

    case 'push':
    case 'pull': {
      const origin = shoveOrigin(caster, ability, target);
      const mode = effect.kind;
      for (const id of hitIds) {
        draft.shove(id, origin, effect.distance, mode);
      }
      break;
    }

    case 'dash': {
      const mover = draft.unit(caster.id);
      if (!mover) break;
      const from = mover.pos;
      draft.placeUnit(caster.id, target);
      draft.emit({
        type: 'unitMoved',
        unitId: caster.id,
        path: [target],
        cost: distance(from, target),
      });
      break;
    }

    case 'wall':
      draft.raiseWall(tiles, effect.duration);
      break;

    case 'cleanse': {
      const recipients = ability.targeting.shape === 'self' ? [caster.id] : friendlyIds;
      for (const id of recipients) draft.cleanseFrom(id, effect.statuses);
      break;
    }

    case 'grantAp': {
      const recipients = effect.to === 'self' ? [caster.id] : friendlyIds;
      for (const id of recipients) draft.grantAp(id, effect.amount);
      break;
    }

    case 'revealSurfaces':
      draft.message(`${caster.name} reads the whole field through the ground.`);
      break;
  }
}

/* ------------------------------------------------------------------ */
/* Small helpers used by the HUD and the AI                            */
/* ------------------------------------------------------------------ */

/** Abilities this unit knows, resolved to definitions, in kit order. */
export function knownAbilities(content: ContentIndex, unit: Unit): Ability[] {
  const out: Ability[] = [];
  for (const id of unit.abilities) {
    const ability = content.abilities.get(id);
    if (ability) out.push(ability);
  }
  return out;
}

/** Abilities that are usable right now (AP, cooldown, not chi-blocked). */
export function usableAbilities(content: ContentIndex, unit: Unit): Ability[] {
  return knownAbilities(content, unit).filter((a) => canUseAbility(content, unit, a).ok);
}

/** Move points remaining, floored at zero, after status modifiers. */
export function movePoints(content: ContentIndex, unit: Unit): number {
  return Math.max(0, Math.min(unit.move, effectiveStats(content, unit).maxMove));
}
