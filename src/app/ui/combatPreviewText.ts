import type { ShoveForecast } from '../../core/rules/reactions';
import type { HitBreakdown } from '../../core/rules/damage';
import type { SurfaceId, Vec2 } from '../../core/types';

function signed(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return '0';
}

/**
 * The confirm-step explanation, formatted from the rules' calculated values.
 * Cloud names are not part of HitBreakdown, so obscurement stays labelled by
 * its measured component rather than guessing which surface caused it.
 */
export function formatHitBreakdownRows(breakdown: HitBreakdown | null): string[] {
  if (!breakdown) return [];

  const rows = [`Base ${breakdown.base}`];
  if (breakdown.elevation !== 0) {
    rows.push(`${breakdown.elevation > 0 ? 'High' : 'Low'} ground ${signed(breakdown.elevation)}`);
  }

  const netCover = breakdown.cover + breakdown.plunging;
  if (netCover !== 0 || breakdown.plunging !== 0) {
    rows.push(`Cover ${signed(netCover)}${breakdown.plunging !== 0 ? ' (plunging)' : ''}`);
  }
  if (breakdown.statuses !== 0) rows.push(`Status effects ${signed(breakdown.statuses)}`);

  const obscurementRows: readonly [number, string][] = [
    [breakdown.obscurement.inside, 'Target in cloud'],
    [breakdown.obscurement.through, 'Shot through cloud'],
    [breakdown.obscurement.attacker, 'Attacker in cloud'],
    [breakdown.obscurement.weather, 'Weather'],
  ];
  for (const [value, label] of obscurementRows) {
    if (value !== 0) rows.push(`${label} ${signed(value)}`);
  }

  return rows;
}

/** The visible subject is a unit or prop, so both displacement modes need -s. */
function shoveVerb(mode: ShoveForecast['mode']): 'pushed' | 'pulled' {
  return mode === 'push' ? 'pushed' : 'pulled';
}

function direction(from: Vec2, to: Vec2): string {
  const vertical = to.y < from.y ? 'north' : to.y > from.y ? 'south' : '';
  const horizontal = to.x < from.x ? 'west' : to.x > from.x ? 'east' : '';
  return [vertical, horizontal].filter(Boolean).join('-');
}

/** The movement sentence uses board meaning, never developer-facing coordinates. */
export function formatShoveMovement(
  name: string,
  mode: ShoveForecast['mode'],
  from: Vec2,
  to: Vec2,
  movedDistance: number,
  landingSurfaces: readonly SurfaceId[],
): string {
  const verb = shoveVerb(mode);
  if (landingSurfaces.includes('water')) return `${name}: ${verb} into the water`;
  const tiles = `${movedDistance} ${movedDistance === 1 ? 'tile' : 'tiles'}`;
  const bearing = direction(from, to);
  return `${name}: ${verb} ${tiles}${bearing ? ` ${bearing}` : ''}`;
}

/** Omit harmless drops and disclose the one-HP floor whenever it clamps damage. */
export function formatLedgeDrop(
  name: string,
  tiers: number,
  damage: number,
  damagePerTier: number,
): string | null {
  if (damage <= 0) return null;
  const nominal = tiers * damagePerTier;
  const clamp = damage < nominal ? ` (can't fall below 1 HP)` : '';
  return `${name} drops ${tiers} → ${damage} damage${clamp}`;
}
