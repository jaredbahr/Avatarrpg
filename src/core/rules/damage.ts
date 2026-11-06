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
import { distanceBetweenUnits, lineBetween, occupiedCells, posKey, tileAt } from './grid';
import { SQUARE_FOOTPRINTS } from './footprint';
import { obscurementFor } from './obscurement';
import type { ObscurementBreakdown } from './obscurement';
import { accuracyModifier, effectiveStats, incomingMultiplier, isAlive } from './stats';

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
 * Where a shot comes from, for cover *between* the attacker and the defender
 * (ADR 0105). `origin` is the firing cell, the same one hit elevation reads;
 * `units` is everyone on the board, of whom only the living, other than the
 * attacker and the defender, can screen.
 */
export interface CoverSource {
  readonly origin: Vec2;
  readonly attacker: Unit;
  readonly units: readonly Unit[];
}

/** Whether a tile itself is cover: its `cover` flag (props bake theirs in) or its surface. */
function tileGrantsCover(content: ContentIndex, grid: Grid, pos: Vec2): boolean {
  const tile = tileAt(grid, pos);
  if (!tile) return false;
  if (tile.cover) return true;
  if (!tile.surface) return false;
  return content.surfaces.get(tile.surface.id)?.grantsCover ?? false;
}

/**
 * The cell that screens `cell` from a shot fired from `origin`: the last cell
 * of the line sight walks (`lineBetween`), so always the one neighbour of the
 * defender's cell that the shot passes through — the orthogonal one for a
 * straight shot, the diagonal one for a diagonal shot, and wherever the line's
 * tie-break puts it for anything in between. Null when the cells touch or are
 * the same, because nothing can stand between them.
 */
export function screenCellFor(origin: Vec2, cell: Vec2): Vec2 | null {
  const line = lineBetween(origin, cell);
  return line[line.length - 1] ?? null;
}

/** Every cell a living character other than the attacker and the defender stands on. */
function screeningCharacters(
  source: CoverSource,
  defender: Unit,
  squareFootprints: boolean,
): Set<string> {
  const cells = new Set<string>();
  for (const unit of source.units) {
    if (unit.id === source.attacker.id || unit.id === defender.id || !isAlive(unit)) continue;
    for (const cell of occupiedCells(unit, squareFootprints)) cells.add(posKey(cell));
  }
  return cells;
}

/**
 * Whether something stands between `origin` and one defender cell, on the
 * defender's side (ADR 0105). The screen cell counts when it is a cover tile (a
 * cover prop, a cover surface such as rubble), a sight-blocking tile (a wall, a
 * tree, a solid prop: only a shot that ignores sight gets this far), or holds a
 * living character other than the attacker and the defender, friend or foe.
 * The attacker's cells and the defender's own cells never screen, and a screen
 * standing lower than the defender's cell does not count unless it blocks sight.
 */
function screened(
  content: ContentIndex,
  grid: Grid,
  origin: Vec2,
  cell: Vec2,
  own: ReadonlySet<string>,
  attackerCells: ReadonlySet<string>,
  characters: ReadonlySet<string>,
): boolean {
  const screen = screenCellFor(origin, cell);
  if (!screen) return false;
  const key = posKey(screen);
  if (own.has(key) || attackerCells.has(key)) return false;
  const tile = tileAt(grid, screen);
  if (!tile) return false;
  if (tile.blocksSight) return true;
  if (tile.elevation < elevationAt(grid, cell)) return false;
  return characters.has(key) || tileGrantsCover(content, grid, screen);
}

/**
 * Whether the unit is in cover.
 *
 * A cell is covered when its own tile is cover or — given the shot's `source` —
 * when something screens it on the line from the firing cell (ADR 0105). The
 * two are a union per cell, so a defender in cover *and* behind cover is
 * covered once, never twice. Without a source only the unit's own cells count.
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
  source: CoverSource | null = null,
): boolean {
  return coveredCells(content, grid, unit, squareFootprints, source, true);
}

/**
 * Cover between alone, without the unit's own tiles: the same half-footprint
 * rule, every cell judged only by what screens it from `source`. The AI's
 * gate-off position score reads own cover from the anchor alone, as it was
 * tuned, and adds this beside it.
 */
export function hasCoverBetween(
  content: ContentIndex,
  grid: Grid,
  unit: Unit,
  squareFootprints: boolean,
  source: CoverSource,
): boolean {
  return coveredCells(content, grid, unit, squareFootprints, source, false);
}

function coveredCells(
  content: ContentIndex,
  grid: Grid,
  unit: Unit,
  squareFootprints: boolean,
  source: CoverSource | null,
  ownTiles: boolean,
): boolean {
  const cells = occupiedCells(unit, squareFootprints);
  const own = new Set(cells.map(posKey));
  const attackerCells = new Set(
    source ? occupiedCells(source.attacker, squareFootprints).map(posKey) : [],
  );
  const characters = source
    ? screeningCharacters(source, unit, squareFootprints)
    : new Set<string>();
  let covered = 0;
  for (const cell of cells) {
    if (ownTiles && tileGrantsCover(content, grid, cell)) {
      covered++;
    } else if (
      source &&
      screened(content, grid, source.origin, cell, own, attackerCells, characters)
    ) {
      covered++;
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
 * Melee (range 1) attacks ignore cover — you are standing next to them — and
 * so does an ability that needs no line of sight (`ignoresCover`, from
 * `!ability.requiresLineOfSight`): it arcs over whatever stands between, and its
 * card says "Ignores cover". Every other modifier applies the same way to everyone.
 *
 * Cover is the defender's own tile or anything between it and the firing cell
 * (ADR 0105), characters included. `units` is the board's roster; the preview,
 * the reducer and the AI pass the same one, so the chip, the roll and the AI's
 * score read one rule. Left empty, only the grid can screen.
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
  units: readonly Unit[] = [],
  ignoresCover: boolean = false,
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
  const covered =
    !adjacent &&
    !ignoresCover &&
    hasCover(content, grid, defender, squareFootprints, {
      origin: origin ?? attacker.pos,
      attacker,
      units,
    });
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
  units: readonly Unit[] = [],
  ignoresCover: boolean = false,
): number {
  const breakdown = hitBreakdown(
    content,
    grid,
    attacker,
    defender,
    weather,
    origin,
    squareFootprints,
    units,
    ignoresCover,
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
  units: readonly Unit[] = [],
  ignoresCover: boolean = false,
): number {
  const chance = hitChance(
    content,
    grid,
    attacker,
    defender,
    weather,
    origin,
    squareFootprints,
    units,
    ignoresCover,
  );
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
  units: readonly Unit[] = [],
  ignoresCover: boolean = false,
): boolean {
  return rng.chance(
    hitChance(
      content,
      grid,
      attacker,
      defender,
      weather,
      origin,
      squareFootprints,
      units,
      ignoresCover,
    ) / 100,
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
  return tileGrantsCover(content, grid, pos);
}
