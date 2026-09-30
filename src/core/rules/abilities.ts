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
  allowsCasterTarget,
  occupiedCells,
  posKey,
  samePos,
  tileAt,
} from './grid';
import { SQUARE_FOOTPRINTS } from './footprint';
import { expectedDamage, healAmount, hitBreakdown, rollDamage } from './damage';
import type { HitBreakdown } from './damage';
import { weatherAt } from './obscurement';
import { forecastReactions } from './reactions';
import type {
  ForecastEntry,
  PropForecast,
  ShoveForecast,
  StatusForecast,
  SurfaceContactForecast,
} from './reactions';
import { canUseAbilities, effectiveStats, isAlive } from './stats';

/* ------------------------------------------------------------------ */
/* Targeting geometry                                                  */
/* ------------------------------------------------------------------ */

/**
 * The first occupied caster cell that can legally reach and see `target`.
 *
 * Candidates are checked nearest-first by Chebyshev distance to the target,
 * with ties broken by `occupiedCells` order (the anchor first). For a size-1
 * caster there is only one cell, so this is the old behaviour exactly; for a
 * 2x2 it picks the gun that is actually pointing at the target rather than
 * whichever corner happens to come first. The reordering is switch-gated: the
 * legacy 2x1 keeps strict anchor-first order until A-6. No RNG, so preview and
 * resolution still agree.
 */
export function validatingOrigin(
  content: ContentIndex,
  grid: Grid,
  caster: Unit,
  ability: Ability,
  target: Vec2,
  checkLineOfSight = true,
  squareFootprints: boolean = SQUARE_FOOTPRINTS,
): Vec2 | null {
  const targetElevation = tileAt(grid, target)?.elevation ?? 0;
  const cells = occupiedCells(caster, squareFootprints);
  const ordered = squareFootprints
    ? [...cells].sort((a, b) => distance(a, target) - distance(b, target))
    : cells;
  for (const cell of ordered) {
    const casterElevation = tileAt(grid, cell)?.elevation ?? 0;
    const heightReach = heightReachBonus(content, ability, casterElevation, targetElevation);
    if (distance(cell, target) > ability.range + heightReach) continue;
    if (checkLineOfSight && ability.requiresLineOfSight && !hasLineOfSight(grid, cell, target)) {
      continue;
    }
    return cell;
  }
  return null;
}

/**
 * Whether an ability can ever gain height reach: range 3 or more, line of
 * sight required, and not a dash. Extracted so `targetableTiles` and the AI
 * reuse the exact qualification `validatingOrigin` applies.
 */
export function canReachFromHeight(ability: Ability): boolean {
  return (
    ability.range >= 3 &&
    ability.requiresLineOfSight &&
    !ability.effects.some((effect) => effect.kind === 'dash')
  );
}

/**
 * The extra range a downward shot gets. A range-3-plus line-of-sight ability
 * (never a dash) reaches `tuning.heightReachBonus` further when fired from a
 * cell strictly higher than the target tile. This is the single definition of
 * the height-reach rule: target validation, tile enumeration and the AI's
 * reach and threat estimates all read it from here.
 */
export function heightReachBonus(
  content: ContentIndex,
  ability: Ability,
  fromElevation: number,
  toElevation: number,
): number {
  if (!canReachFromHeight(ability)) return 0;
  return fromElevation > toElevation ? content.tuning.heightReachBonus : 0;
}

/** Every tile an ability touches when aimed at `target`. */
export function affectedTiles(
  content: ContentIndex,
  grid: Grid,
  caster: Unit,
  ability: Ability,
  target: Vec2,
  squareFootprints: boolean = SQUARE_FOOTPRINTS,
): Vec2[] {
  const origin =
    validatingOrigin(content, grid, caster, ability, target, true, squareFootprints) ?? caster.pos;
  switch (ability.targeting.shape) {
    case 'self':
      return occupiedCells(caster, squareFootprints);
    case 'unit':
    case 'tile':
      return inBounds(grid, target) ? [target] : [];
    case 'blast':
      return blastTiles(grid, target, ability.targeting.radius);
    case 'line':
      return lineTiles(grid, origin, target, ability.targeting.length);
    case 'cone':
      return coneTiles(grid, origin, target, ability.targeting.length);
  }
}

/** True when the two units are on the same side (party and allies count as one). */
export function sameSide(a: Unit, b: Unit): boolean {
  const side = (u: Unit) => (u.faction === 'enemy' ? 'enemy' : 'friendly');
  return side(a) === side(b);
}

/** Living units standing on any of `tiles`. */
export function unitsOnTiles(
  units: readonly Unit[],
  tiles: readonly Vec2[],
  squareFootprints: boolean = SQUARE_FOOTPRINTS,
): Unit[] {
  const keys = new Set(tiles.map(posKey));
  return units.filter(
    (u) => isAlive(u) && occupiedCells(u, squareFootprints).some((c) => keys.has(posKey(c))),
  );
}

/**
 * The aim cell a tap actually resolves against.
 *
 * A big unit fills several cells, but a player taps one of them — often the
 * nearest corner rather than the anchor — and validation and resolution work on
 * a single cell. Without this, tapping the boss's far cell could report "out of
 * range" or "no line of sight" while another cell of the same body was a clean
 * shot. For a `unit`-shaped ability the tap snaps to the first footprint cell
 * (anchor first) the caster can both reach and see. Anything else — a size-1
 * unit, an empty tile, an area aim — is returned untouched, so the caller still
 * gets the usual reason when nothing on the body is targetable.
 *
 * Pure geometry, no RNG: preview and resolution snap identically. The scene
 * applies this before `isValidTarget` (wiring is A-4).
 */
export function resolveAim(
  content: ContentIndex,
  battle: BattleState,
  caster: Unit,
  ability: Ability,
  tapped: Vec2,
  squareFootprints: boolean = SQUARE_FOOTPRINTS,
): Vec2 {
  if (ability.targeting.shape !== 'unit') return tapped;
  const occupant = unitsOnTiles(battle.units, [tapped], squareFootprints)[0];
  if (!occupant) return tapped;
  for (const cell of occupiedCells(occupant, squareFootprints)) {
    if (aimCellTargetable(content, battle.grid, caster, ability, cell, squareFootprints)) {
      return cell;
    }
  }
  return tapped;
}

/** Whether `cell` is both in the caster's range and visible from it. */
function aimCellTargetable(
  content: ContentIndex,
  grid: Grid,
  caster: Unit,
  ability: Ability,
  cell: Vec2,
  squareFootprints: boolean,
): boolean {
  if (!inBounds(grid, cell)) return false;
  if (distanceToUnit(cell, caster, squareFootprints) < ability.minRange) return false;
  return validatingOrigin(content, grid, caster, ability, cell, true, squareFootprints) !== null;
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
  if (!unitAbilities(content, unit).includes(ability.id)) {
    return { ok: false, reason: 'Not learned yet.' };
  }
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
  squareFootprints: boolean = SQUARE_FOOTPRINTS,
): UseCheck {
  if (ability.targeting.shape === 'self') return OK;
  if (!inBounds(battle.grid, target)) return { ok: false, reason: 'Off the map.' };

  const range = distanceToUnit(target, caster, squareFootprints);
  const inRangeOrigin = validatingOrigin(
    content,
    battle.grid,
    caster,
    ability,
    target,
    false,
    squareFootprints,
  );
  if (!inRangeOrigin) return { ok: false, reason: 'Out of range.' };
  if (range < ability.minRange) return { ok: false, reason: 'Too close.' };
  if (!validatingOrigin(content, battle.grid, caster, ability, target, true, squareFootprints)) {
    return { ok: false, reason: 'No line of sight.' };
  }

  if (ability.targeting.shape === 'unit') {
    const occupant = unitsOnTiles(battle.units, [target], squareFootprints)[0];
    if (!occupant) {
      /*
       * A prop is a legal target for anything that would take an enemy or
       * anybody. "A firebender shooting a puddle of oil" is the whole point of
       * the feature, and a single-target attack is the most natural way anyone
       * reaches for it — a barrel is not "one of yours", so `enemy` is a fair
       * fit. Only `ally` is refused: you cannot heal a crate.
       *
       * A misplaced tap is not a lost turn, because the confirm bar shows what
       * is about to happen before anything is spent.
       */
      const prop = battle.props.find((p) => samePos(p.pos, target));
      if (prop && ability.targeting.allow !== 'ally') return OK;
      return { ok: false, reason: 'Nobody there.' };
    }
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
          .flatMap((u) => occupiedCells(u, squareFootprints).map(posKey)),
      );
      const cost = enterCost(
        {
          grid: battle.grid,
          blocked,
          surfaces: content.surfaces,
          size: caster.size,
          climbCost: content.tuning.climbCost,
        },
        caster.pos,
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
  squareFootprints: boolean = SQUARE_FOOTPRINTS,
): Vec2[] {
  if (ability.targeting.shape === 'self') return occupiedCells(caster, squareFootprints);

  const out: Vec2[] = [];
  const reach = canReachFromHeight(ability)
    ? ability.range + content.tuning.heightReachBonus
    : ability.range;
  const seen = new Set<string>();
  for (const cell of occupiedCells(caster, squareFootprints)) {
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const pos = { x: cell.x + dx, y: cell.y + dy };
        if (!inBounds(battle.grid, pos) || seen.has(posKey(pos))) continue;
        if (isValidTarget(content, battle, caster, ability, pos, squareFootprints).ok) {
          seen.add(posKey(pos));
          out.push(pos);
        }
      }
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
  /**
   * The same components `hitChance` was summed from — base, elevation, cover,
   * plunging, statuses and obscurement — so the confirm step can show *why* a
   * shot reads 70%. Null wherever `hitChance` is: nothing was rolled.
   */
  readonly hitBreakdown: HitBreakdown | null;
  readonly damage: number;
  readonly heal: number;
  /** True when a heal effect finds this friendly target already at max HP. */
  readonly healAtCapacity: boolean;
  readonly statuses: readonly {
    /** Requested status, retained for callers that used the old shape. */
    readonly id: StatusId;
    readonly chance: number;
    /** Actual status after `applyStatus` upgrades the request, if any. */
    readonly appliedStatus?: StatusId | null;
    /** Effects removed by the same application. */
    readonly clearedStatuses?: readonly StatusId[];
  }[];
  readonly clearedStatuses: readonly StatusId[];
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
  /** Props damaged, broken or moved by this action. */
  readonly props: readonly PropForecast[];
  /** Actual shove destinations after walls, units and map edges. */
  readonly shoves: readonly ShoveForecast[];
  /** Status outcomes shown without rolling a chance. */
  readonly statuses: readonly StatusForecast[];
  /** Unit contacts recorded by the shared surface resolver. */
  readonly surfaceContacts: readonly SurfaceContactForecast[];
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
  squareFootprints: boolean = SQUARE_FOOTPRINTS,
): AbilityPreview {
  const tiles = affectedTiles(content, battle.grid, caster, ability, target, squareFootprints);
  // The previewed to-hit uses the same firing cell as resolution, so a size-2
  // caster's elevation (and plunging) read from its validating origin.
  const origin =
    validatingOrigin(content, battle.grid, caster, ability, target, true, squareFootprints) ??
    caster.pos;
  const inArea = unitsOnTiles(battle.units, tiles, squareFootprints).filter(
    (u) => allowsCasterTarget(ability) || u.id !== caster.id,
  );
  // Pushes preview from the same cell resolution uses: the blast centre for
  // area shapes, otherwise the validating firing cell.
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
  // The roll uses the same intensity, resolved the same way, so the preview
  // percentage and the actual shot cannot disagree.
  const weather = weatherAt(content, battle.encounterId, battle.round);

  const targets: PreviewTarget[] = [];
  const terrain: string[] = [];

  for (const unit of inArea) {
    let damage = 0;
    let heal = 0;
    let healAtCapacity = false;
    let remainingHealCapacity: number | null = null;
    let chance: number | null = null;
    let breakdown: HitBreakdown | null = null;
    const statuses: {
      id: StatusId;
      chance: number;
      appliedStatus?: StatusId | null;
      clearedStatuses?: readonly StatusId[];
    }[] = [];
    const clearedStatuses = new Set<StatusId>();
    const friendly = sameSide(caster, unit);

    for (const effect of ability.effects) {
      switch (effect.kind) {
        case 'damage':
          damage += expectedDamage(content, caster, unit, effect);
          // One call, so the chip's percentage and its explanation cannot
          // disagree: `chance` *is* `breakdown.chance`.
          breakdown = hitBreakdown(
            content,
            battle.grid,
            caster,
            unit,
            weather,
            origin,
            squareFootprints,
          );
          chance = breakdown.chance;
          break;
        case 'heal':
          if (friendly) {
            remainingHealCapacity ??= Math.max(0, unit.base.maxHp - unit.hp);
            const requested = healAmount(content, caster, effect);
            const gained = Math.min(requested, remainingHealCapacity);
            heal += gained;
            remainingHealCapacity -= gained;
            if (gained === 0) healAtCapacity = true;
          }
          break;
        case 'status':
          break;
        default:
          break;
      }
    }

    for (const status of forecast.statuses.filter((entry) => entry.unitId === unit.id)) {
      if (status.kind === 'apply' && status.requestedStatus) {
        statuses.push({
          id: status.requestedStatus,
          chance: status.chance,
          appliedStatus: status.appliedStatus,
          clearedStatuses: status.clearedStatuses,
        });
      }
      for (const cleared of status.clearedStatuses) clearedStatuses.add(cleared);
    }

    if (
      damage === 0 &&
      heal === 0 &&
      statuses.length === 0 &&
      clearedStatuses.size === 0 &&
      !healAtCapacity
    ) {
      continue;
    }
    targets.push({
      unitId: unit.id,
      name: unit.name,
      friendly,
      hitChance: chance,
      hitBreakdown: breakdown,
      damage,
      heal,
      healAtCapacity,
      statuses,
      clearedStatuses: [...clearedStatuses],
      lethal: damage > 0 && damage >= unit.hp,
    });
  }

  for (const effect of ability.effects) {
    switch (effect.kind) {
      case 'wall':
        terrain.push('Raises a stone wall');
        break;
      case 'push':
        if (forecast.shoves.length === 0) terrain.push(`Pushes ${effect.distance}`);
        break;
      case 'pull':
        if (forecast.shoves.length === 0) terrain.push(`Pulls ${effect.distance}`);
        break;
      case 'dash':
        terrain.push('Moves you there');
        break;
      case 'grantAp':
        terrain.push(`+${effect.amount} AP`);
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

  return {
    tiles,
    targets,
    terrain,
    reactions: forecast.entries,
    props: forecast.props,
    shoves: forecast.shoves,
    statuses: forecast.statuses,
    surfaceContacts: forecast.surfaceContacts,
    // A bolt of lightning that chains back through the puddle your own
    // waterbender is standing in counts as hitting your own side, even though
    // she is nowhere near the tile you aimed at.
    hitsFriendly:
      targets.some((t) => t.friendly && t.damage > 0) ||
      forecast.catchesFriendly ||
      forecast.props.some((prop) => prop.affectedAllies.length > 0) ||
      forecast.shoves.some((shove) => shove.friendly) ||
      forecast.surfaceContacts.some(
        (contact) => contact.friendly && (contact.damage > 0 || contact.status !== null),
      ),
  };
}

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

/** Area-centred shoves measure from the selected tile, not the caster. */
export function isAreaShove(ability: Ability): boolean {
  return ability.targeting.shape === 'blast' || ability.targeting.shape === 'tile';
}

/**
 * Where a push or pull measures from. Area shapes shove outward from (or drag
 * toward) the centre of the blast; everything else shoves away from the cell
 * the caster actually fired from. That cell is the validating origin, so a
 * size-2 caster's line or cone pushes away from whichever occupied cell
 * reached the target, exactly as `affectedTiles` draws it. Exported so the
 * AI's ledge pricing measures from the same cell the shot will.
 */
export function shoveOrigin(
  content: ContentIndex,
  grid: Grid,
  caster: Unit,
  ability: Ability,
  target: Vec2,
  squareFootprints: boolean = SQUARE_FOOTPRINTS,
): Vec2 {
  if (isAreaShove(ability)) return target;
  return (
    validatingOrigin(content, grid, caster, ability, target, true, squareFootprints) ?? caster.pos
  );
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
  const squareFootprints = draft.squareFootprints;
  const tiles = affectedTiles(draft.content, draft.grid, caster, ability, target, squareFootprints);
  // The cell the shot is fired from. Hit elevation must measure from this same
  // cell, or a size-2 attacker could fire from its low second cell and still
  // claim its first cell's high ground on the to-hit roll.
  const origin =
    validatingOrigin(draft.content, draft.grid, caster, ability, target, true, squareFootprints) ??
    caster.pos;

  draft.emit({ type: 'abilityUsed', unitId: caster.id, abilityId: ability.id, target, tiles });

  // Snapshot who is standing where *before* anything moves, so a push in one
  // effect does not pull a unit out of the next effect's area.
  const struck = unitsOnTiles(draft.units, tiles, squareFootprints).filter(
    (u) => allowsCasterTarget(ability) || u.id !== caster.id,
  );
  const hitIds = struck.map((u) => u.id);
  const friendlyIds = struck.filter((u) => sameSide(caster, u)).map((u) => u.id);

  /** Ids that a to-hit roll actually connected with, per damage effect. */
  for (const effect of ability.effects) {
    applyEffect(
      draft,
      caster,
      ability,
      effect,
      target,
      origin,
      tiles,
      hitIds,
      friendlyIds,
      squareFootprints,
      rng,
    );
  }
}

function applyEffect(
  draft: BattleDraft,
  caster: Unit,
  ability: Ability,
  effect: AbilityEffect,
  target: Vec2,
  origin: Vec2,
  tiles: readonly Vec2[],
  hitIds: readonly string[],
  friendlyIds: readonly string[],
  squareFootprints: boolean,
  rng: RngCursor,
): void {
  const content = draft.content;

  switch (effect.kind) {
    case 'damage': {
      const landed: string[] = [];
      const weather = weatherAt(content, draft.encounterId, draft.round);
      for (const id of hitIds) {
        const victim = draft.unit(id);
        if (!victim || !isAlive(victim)) continue;
        const breakdown = hitBreakdown(
          content,
          draft.grid,
          caster,
          victim,
          weather,
          origin,
          squareFootprints,
        );
        if (!rng.chance(breakdown.chance / 100)) {
          draft.emit({
            type: 'attackMissed',
            unitId: caster.id,
            targetId: id,
            obscurement: breakdown.obscurement,
          });
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
      /*
       * Props break *before* the ground reacts, and the order is load-bearing.
       * A fireball that cracks an oil flask has to leave the oil on the ground
       * while the fire is still arriving, or the flask spills into a tile the
       * flames have already passed through and nothing lights.
       *
       * Flat damage, no roll: `previewAbility` promises to consume no RNG.
       */
      draft.damageProps(tiles, effect.base, effect.damageType);

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
      const shoveFrom = shoveOrigin(content, draft.grid, caster, ability, target, squareFootprints);
      const mode = effect.kind;
      for (const id of hitIds) {
        draft.shove(id, shoveFrom, effect.distance, mode);
      }
      // Shoving a barrel is the whole reason Shove is a universal ability.
      for (const prop of draft.propsOnTiles(tiles)) {
        draft.shoveProp(prop.id, shoveFrom, effect.distance, mode);
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

/**
 * Every ability id this unit can use: what it learned, plus the universals.
 *
 * Resolved here rather than written onto `Unit.abilities` at creation, which
 * means a save made before a universal existed picks it up on load instead of
 * needing a migration, and adding a second universal later is one line of
 * content. Party and allies only — enemies get a universal by naming it in their
 * own list, so the balance report's measured enemy behaviour stays comparable.
 */
export function unitAbilities(content: ContentIndex, unit: Unit): readonly string[] {
  if (unit.faction === 'enemy' || content.universalAbilities.length === 0) return unit.abilities;
  const out = [...unit.abilities];
  for (const id of content.universalAbilities) {
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** Abilities this unit knows, resolved to definitions, in kit order. */
export function knownAbilities(content: ContentIndex, unit: Unit): Ability[] {
  const out: Ability[] = [];
  for (const id of unitAbilities(content, unit)) {
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
