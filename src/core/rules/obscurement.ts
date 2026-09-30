/**
 * Obscurement: clouds and weather as miss chance.
 *
 * Steam used to block line of sight outright. It does not any more. You can
 * always shoot into or through a cloud; the shot is just harder, and the
 * confirm step says by how much. Three tile components (target inside the
 * cloud, the line crossing a cloud, the attacker inside it) and one area
 * component (weather) add up and are then clamped.
 *
 * The whole module is arithmetic over the grid and the content index: no RNG,
 * no state, so the preview and the real roll cannot drift apart. The numbers
 * themselves live in `content` — surface magnitudes on `SurfaceDef.obscures`,
 * the shared cap/adjacent/reference values and the weather curves in
 * `content/tuning.ts`.
 */

import type {
  ContentIndex,
  Grid,
  SurfaceObscurement,
  Unit,
  Vec2,
  WeatherIntensity,
} from '../types';
import { SQUARE_FOOTPRINTS } from './footprint';
import { distanceToUnit, lineBetween, occupiedCells, tileAt } from './grid';

/** The four components of an obscurement penalty, all zero or negative. */
export interface ObscurementBreakdown {
  /** The defender stands in a cloud. */
  readonly inside: number;
  /** The line crosses at least one cloud tile, counted once. */
  readonly through: number;
  /** The attacker stands in a cloud and cannot see out. */
  readonly attacker: number;
  /** Weather at the current intensity and distance. */
  readonly weather: number;
  /** The clamped sum the hit chance actually uses. */
  readonly total: number;
}

export const NO_OBSCUREMENT: ObscurementBreakdown = {
  inside: 0,
  through: 0,
  attacker: 0,
  weather: 0,
  total: 0,
};

/**
 * The intensity the encounter's authored schedule puts in effect on `round`.
 *
 * The last entry whose `fromRound` is not after the round wins, so the value is
 * a pure function of the encounter and the clock — no RNG, nothing to save.
 */
export function weatherAt(
  content: ContentIndex,
  encounterId: string,
  round: number,
): WeatherIntensity {
  const schedule = content.encounters.get(encounterId)?.weather?.schedule;
  if (!schedule) return 0;
  let intensity: WeatherIntensity = 0;
  let from = -Infinity;
  for (const entry of schedule) {
    if (entry.fromRound <= round && entry.fromRound > from) {
      from = entry.fromRound;
      intensity = entry.intensity;
    }
  }
  return intensity;
}

/** The obscurement a tile's own surface provides, or null when it is clear. */
function obscuresAt(content: ContentIndex, grid: Grid, pos: Vec2): SurfaceObscurement | null {
  const id = tileAt(grid, pos)?.surface?.id;
  if (!id) return null;
  return content.surfaces.get(id)?.obscures ?? null;
}

interface CloudCover {
  /** At least one occupied cell is obscured. */
  readonly any: boolean;
  /** Every cell of the footprint is obscured. */
  readonly all: boolean;
  /** The least penalty among obscured cells (ties broken in the attacker's favour). */
  readonly inside: number;
  readonly through: number;
}

/**
 * How a unit sits in a cloud. A unit only counts as *inside* when every cell of
 * its footprint is obscured — a 2x2 must have all four cells in the cloud — and
 * it takes the gentlest of them, so the size advantage always helps the
 * attacker.
 */
function cloudCover(
  content: ContentIndex,
  grid: Grid,
  unit: Unit,
  squareFootprints: boolean,
): CloudCover {
  let any = false;
  let all = true;
  let inside = 0;
  let through = 0;
  let seen = false;
  for (const cell of occupiedCells(unit, squareFootprints)) {
    const value = obscuresAt(content, grid, cell);
    if (!value) {
      all = false;
      continue;
    }
    any = true;
    if (!seen) {
      inside = value.inside;
      through = value.through;
      seen = true;
    } else {
      inside = Math.max(inside, value.inside);
      through = Math.max(through, value.through);
    }
  }
  return { any, all, inside, through };
}

/**
 * The penalty for a line that crosses clouds: the strongest cloud crossed,
 * counted once no matter how many tiles it spans.
 */
function throughAlong(content: ContentIndex, grid: Grid, from: Vec2, to: Vec2): number {
  let penalty = 0;
  for (const cell of lineBetween(from, to)) {
    const value = obscuresAt(content, grid, cell);
    if (value) penalty = Math.min(penalty, value.through);
  }
  return penalty;
}

/** Weather miss chance for an attack `distance` away at the given intensity. */
function weatherPenalty(
  content: ContentIndex,
  intensity: WeatherIntensity,
  distance: number,
): number {
  if (intensity === 0) return 0;
  const level = content.tuning.weather[intensity];
  if (!level || distance < level.minDistance) return 0;
  const raw = level.perTile * (distance - (level.minDistance - 1));
  return -Math.min(level.cap, raw);
}

/**
 * The obscurement penalty for one attack, component by component.
 *
 * Adjacent (range-1) attacks ignore the cloud's numbers and weather and take a
 * single flat penalty when either side is in a cloud, matching how they already
 * ignore cover.
 */
export function obscurementFor(
  content: ContentIndex,
  grid: Grid,
  attacker: Unit,
  defender: Unit,
  weather: WeatherIntensity,
  squareFootprints: boolean = SQUARE_FOOTPRINTS,
): ObscurementBreakdown {
  const tuning = content.tuning;
  const distance = distanceToUnit(attacker.pos, defender, squareFootprints);

  if (distance <= 1) {
    const inCloud =
      cloudCover(content, grid, attacker, squareFootprints).any ||
      cloudCover(content, grid, defender, squareFootprints).any;
    const penalty = inCloud ? -tuning.adjacentObscurementPenalty : 0;
    return {
      inside: 0,
      through: 0,
      attacker: 0,
      weather: 0,
      total: Math.max(-tuning.obscurementCap, penalty),
    };
  }

  const target = cloudCover(content, grid, defender, squareFootprints);
  const shooter = cloudCover(content, grid, attacker, squareFootprints);
  const inside = target.all ? target.inside : 0;
  const attackerPenalty = shooter.all ? shooter.through : 0;

  // For a large defender take the best line, the same way sight does: the
  // least-obscured path to any of its footprint cells. Start below zero so a
  // single clouded line is not silently dropped by the comparison.
  let through = -Infinity;
  for (const cell of occupiedCells(defender, squareFootprints)) {
    through = Math.max(through, throughAlong(content, grid, attacker.pos, cell));
  }
  through = Math.min(0, through);

  const weatherPart = weatherPenalty(content, weather, distance);
  const sum = inside + attackerPenalty + through + weatherPart;
  return {
    inside,
    through,
    attacker: attackerPenalty,
    weather: weatherPart,
    total: Math.max(-tuning.obscurementCap, sum),
  };
}

/**
 * How much cover-like value the AI should read from standing on `pos`, as a
 * multiple of `weights.cover`: a full cloud (steam's inside magnitude, or
 * `obscurementReference`) scores 1. This is what replaces steam's old
 * accidental count as cover through `grantsCover`.
 */
export function positionObscurement(content: ContentIndex, grid: Grid, pos: Vec2): number {
  const value = obscuresAt(content, grid, pos);
  if (!value) return 0;
  return Math.abs(value.inside) / content.tuning.obscurementReference;
}
