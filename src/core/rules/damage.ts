/**
 * Hit chance and damage.
 *
 * Both are exposed in two forms: a `roll*` function that consumes RNG and is
 * used when an ability actually resolves, and an `expected*` function that
 * consumes nothing and is used for the confirm-step preview chips and by the
 * AI's scoring. Keeping them side by side is what stops the preview drifting
 * away from the real result.
 *
 *   damage = round((base + scale x Power) x variance) x incoming multipliers
 *            - Defense, minimum 1
 *
 * The hit-chance numbers themselves are data: `ContentIndex.tuning` carries
 * them in from `src/content/tuning.ts`, so a balance variant can move them
 * without touching core.
 */

import type { RngCursor } from '../rng';
import type { AbilityEffect, ContentIndex, Grid, Unit, Vec2, WeatherIntensity } from '../types';
import { distanceBetweenUnits, occupiedCells, tileAt } from './grid';
import { SQUARE_FOOTPRINTS } from './footprint';
import { obscurementFor } from './obscurement';
import type { ObscurementBreakdown } from './obscurement';
import { accuracyModifier, effectiveStats, incomingMultiplier } from './stats';

export const CRIT_MULTIPLIER = 1.5;
export const VARIANCE_MIN = 0.9;
export const VARIANCE_MAX = 1.1;
export const MIN_DAMAGE = 1;

/** Elevation of a single cell; off-map counts as ground level. */
function elevationAt(grid: Grid, pos: Vec2): number {
  return tileAt(grid, pos)?.elevation ?? 0;
}

/**
 * Highest elevation among the cells a unit stands on. This is the fallback
 * when no firing origin is known — a reaction or a rough threat estimate —
 * where measuring from the attacker's best ground is the safest assumption.
 */
function elevationOf(
  grid: Grid,
  unit: Unit,
  squareFootprints: boolean = SQUARE_FOOTPRINTS,
): number {
  let best = 0;
  for (const cell of occupiedCells(unit, squareFootprints)) {
    best = Math.max(best, elevationAt(grid, cell));
  }
  return best;
}

/**
 * Whether the terrain the unit stands on counts as cover.
 *
 * A single-tile unit needs its one cell covered. A big unit is covered once at
 * least half its footprint (rounded up) is: 1 of 2 for the legacy 2x1 that
 * shipped, 2 of 4 for the square 2x2. Reading the whole block stops a boss with
 * one corner behind a rock from counting as fully exposed, without letting a
 * single covered cell shield the whole body.
 */
export function hasCover(
  content: ContentIndex,
  grid: Grid,
  unit: Unit,
  squareFootprints: boolean = SQUARE_FOOTPRINTS,
): boolean {
  const cells = occupiedCells(unit, squareFootprints);
  let covered = 0;
  for (const cell of cells) {
    const tile = tileAt(grid, cell);
    if (!tile) continue;
    if (tile.cover) {
      covered++;
      continue;
    }
    if (tile.surface) {
      const def = content.surfaces.get(tile.surface.id);
      if (def?.grantsCover) covered++;
    }
  }
  return covered >= Math.ceil(cells.length / 2);
}

export interface HitBreakdown {
  /** Final chance as a percentage, clamped to the tuning band (5-99 today). */
  readonly chance: number;
  readonly base: number;
  readonly elevation: number;
  readonly cover: number;
  /** Positive offset that reduces the cover penalty; shown separately in previews. */
  readonly plunging: number;
  readonly statuses: number;
  /** Clouds and weather, component by component and in total. */
  readonly obscurement: ObscurementBreakdown;
}

/**
 * Melee (range 1) attacks ignore cover — you are standing next to them. Every
 * other modifier applies the same way to everyone.
 *
 * `weather` is the intensity in effect this round; the caller resolves it from
 * the encounter's schedule and the round (`weatherAt`), so the roll and the
 * preview take the exact same value.
 */
export function hitBreakdown(
  content: ContentIndex,
  grid: Grid,
  attacker: Unit,
  defender: Unit,
  weather: WeatherIntensity = 0,
  origin: Vec2 | null = null,
  squareFootprints: boolean = SQUARE_FOOTPRINTS,
): HitBreakdown {
  const tuning = content.tuning;
  /*
   * Hit elevation and plunging are measured from the cell the attack fires
   * from — the same validating origin the ability's shape uses for range and
   * the to-hit cell. A size-2 attacker at the low end of a line must not claim
   * the high end's elevation. `origin` is null only where no firing cell is
   * known (reactions, threat estimates), which falls back to the attacker's
   * highest occupied cell.
   */
  const attackerElevation = origin
    ? elevationAt(grid, origin)
    : elevationOf(grid, attacker, squareFootprints);
  const elevationDelta = attackerElevation - elevationOf(grid, defender, squareFootprints);
  const elevation = elevationDelta * tuning.elevationStep;

  const adjacent = distanceBetweenUnits(attacker, defender, squareFootprints) <= 1;
  const covered = !adjacent && hasCover(content, grid, defender, squareFootprints);
  const plunging =
    covered && elevationDelta > 0
      ? Math.floor(tuning.coverPenalty / tuning.plungingCoverDivisor)
      : 0;
  const cover = covered ? -tuning.coverPenalty : 0;

  const statuses = accuracyModifier(content, attacker);
  const obscurement = obscurementFor(content, grid, attacker, defender, weather, squareFootprints);

  const raw = tuning.baseHitChance + elevation + cover + plunging + statuses + obscurement.total;
  return {
    chance: Math.max(tuning.hitChanceMin, Math.min(tuning.hitChanceMax, raw)),
    base: tuning.baseHitChance,
    elevation,
    cover,
    plunging,
    statuses,
    obscurement,
  };
}

export function hitChance(
  content: ContentIndex,
  grid: Grid,
  attacker: Unit,
  defender: Unit,
  weather: WeatherIntensity = 0,
  origin: Vec2 | null = null,
  squareFootprints: boolean = SQUARE_FOOTPRINTS,
): number {
  const breakdown = hitBreakdown(
    content,
    grid,
    attacker,
    defender,
    weather,
    origin,
    squareFootprints,
  );
  return breakdown.chance;
}

export function critChance(content: ContentIndex, attacker: Unit): number {
  return Math.max(0, Math.min(75, effectiveStats(content, attacker).focus));
}

export interface DamageResult {
  readonly amount: number;
  readonly crit: boolean;
}

/** Shared maths for both the roll and the preview. */
function compute(
  content: ContentIndex,
  attacker: Unit,
  defender: Unit,
  effect: Extract<AbilityEffect, { kind: 'damage' }>,
  variance: number,
  crit: boolean,
): number {
  const power = effectiveStats(content, attacker).power;
  let amount = (effect.base + effect.scale * power) * variance;
  if (crit) amount *= CRIT_MULTIPLIER;
  amount *= incomingMultiplier(content, defender, effect.damageType);
  if (!effect.ignoreDefense) {
    amount -= effectiveStats(content, defender).defense;
  }
  const rounded = Math.round(amount);
  if (!Number.isFinite(rounded)) return MIN_DAMAGE;
  return Math.max(MIN_DAMAGE, rounded);
}

/** Damage with no variance and no crit — what the preview chip shows. */
export function expectedDamage(
  content: ContentIndex,
  attacker: Unit,
  defender: Unit,
  effect: Extract<AbilityEffect, { kind: 'damage' }>,
): number {
  return compute(content, attacker, defender, effect, 1, false);
}

/**
 * Average damage per *attempt*, folding in hit chance and crit chance. The AI
 * scores with this so it prefers a reliable hit over a coin-flip nuke.
 */
export function averageDamage(
  content: ContentIndex,
  grid: Grid,
  attacker: Unit,
  defender: Unit,
  effect: Extract<AbilityEffect, { kind: 'damage' }>,
  weather: WeatherIntensity = 0,
  origin: Vec2 | null = null,
  squareFootprints: boolean = SQUARE_FOOTPRINTS,
): number {
  const chance = hitChance(content, grid, attacker, defender, weather, origin, squareFootprints);
  const hit = chance / 100;
  const crit = critChance(content, attacker) / 100;
  const normal = compute(content, attacker, defender, effect, 1, false);
  const critical = compute(content, attacker, defender, effect, 1, true);
  return hit * (normal * (1 - crit) + critical * crit);
}

export function rollDamage(
  rng: RngCursor,
  content: ContentIndex,
  attacker: Unit,
  defender: Unit,
  effect: Extract<AbilityEffect, { kind: 'damage' }>,
): DamageResult {
  const variance = rng.range(VARIANCE_MIN, VARIANCE_MAX);
  const crit = rng.chance(critChance(content, attacker) / 100);
  return { amount: compute(content, attacker, defender, effect, variance, crit), crit };
}

export function rollHit(
  rng: RngCursor,
  content: ContentIndex,
  grid: Grid,
  attacker: Unit,
  defender: Unit,
  weather: WeatherIntensity = 0,
  origin: Vec2 | null = null,
  squareFootprints: boolean = SQUARE_FOOTPRINTS,
): boolean {
  return rng.chance(
    hitChance(content, grid, attacker, defender, weather, origin, squareFootprints) / 100,
  );
}

/** Healing has no variance and no crit — predictable support is friendlier. */
export function healAmount(
  content: ContentIndex,
  healer: Unit,
  effect: Extract<AbilityEffect, { kind: 'heal' }>,
): number {
  const power = effectiveStats(content, healer).power;
  return Math.max(1, Math.round(effect.base + effect.scale * power));
}

/** Damage dealt by standing on a surface. No defense, no variance — terrain is terrain. */
export function surfaceDamage(
  content: ContentIndex,
  unit: Unit,
  amount: number,
  type: Extract<AbilityEffect, { kind: 'damage' }>['damageType'],
): number {
  const scaled = amount * incomingMultiplier(content, unit, type);
  return Math.max(0, Math.round(scaled));
}

/** Convenience for the AI and the preview: does this position give cover? */
export function positionHasCover(content: ContentIndex, grid: Grid, pos: Vec2): boolean {
  const tile = tileAt(grid, pos);
  if (!tile) return false;
  if (tile.cover) return true;
  if (!tile.surface) return false;
  return content.surfaces.get(tile.surface.id)?.grantsCover ?? false;
}
