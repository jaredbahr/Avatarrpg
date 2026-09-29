import type { ShoveForecast } from '../../core/rules/reactions';
import type { HitBreakdown } from '../../core/rules/damage';

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
function shoveVerb(mode: ShoveForecast['mode']): 'pushes' | 'pulls' {
  return mode === 'push' ? 'pushes' : 'pulls';
}

/** The unblocked movement sentence used by the combat confirmation chip. */
export function formatShoveMovement(
  name: string,
  mode: ShoveForecast['mode'],
  destination: string,
): string {
  return `${name}: ${shoveVerb(mode)} to ${destination}`;
}
