import type { PropForecast, ShoveForecast } from '../../core/rules/reactions';
import type { HitBreakdown } from '../../core/rules/damage';
import type { SurfaceId } from '../../core/types';

function signed(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return '0';
}

/** Plain words for the deterministic prop result in the confirm step. */
export function formatPropConsequence(prop: PropForecast): string {
  if (prop.destroyed) return prop.breakLabel ?? `${prop.name} breaks`;
  if (prop.catchesFire) return `${prop.name} catches fire`;
  if (prop.doused) return `${prop.name} is put out`;
  if (prop.moved) {
    return prop.to
      ? `${prop.name} to (${prop.to.x + 1},${prop.to.y + 1})`
      : `${prop.name} breaks here`;
  }
  if (prop.hpAfter !== null && prop.hpAfter < prop.hpBefore) {
    return `${prop.name} takes ${prop.hpBefore - prop.hpAfter} damage (${prop.hpAfter} hp left)`;
  }
  return `${prop.name} holds here`;
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

/**
 * Describe caster-driven movement relatively, but use neutral wording when a
 * blast, tile, or broken prop supplies the real origin.
 */
export function formatShoveMovement(
  name: string,
  mode: ShoveForecast['mode'],
  movedDistance: number,
  distance: number,
  stopReason: ShoveForecast['stopReason'],
  landingSurfaces: readonly SurfaceId[],
  originKind: ShoveForecast['originKind'],
): string {
  const verb = shoveVerb(mode);
  if (movedDistance === 0) {
    if (stopReason === 'adjacent') {
      return `${name} is already next to ${originKind === 'caster' ? 'the caster' : 'the centre'}`;
    }
    if (stopReason === 'centre') {
      return originKind === 'caster' ? `${name} stays put` : `${name} stays put — at the centre`;
    }
    return `${name} can't be ${verb} — blocked`;
  }
  const blocked = stopReason === 'obstacle';
  if (landingSurfaces.includes('water')) {
    const progress = blocked ? ` (${movedDistance} of ${distance} tiles; blocked)` : '';
    return `${name}: ${verb} into the water${progress}`;
  }
  const tiles = `${movedDistance} ${movedDistance === 1 ? 'tile' : 'tiles'}`;
  const movement =
    originKind === 'caster'
      ? `${verb} ${blocked ? `${movedDistance} of ${distance} tiles` : tiles} ${mode === 'push' ? 'away' : 'closer'}`
      : `${mode === 'push' ? 'knocked' : verb} ${blocked ? `${movedDistance} of ${distance} tiles` : tiles}`;
  return `${name}: ${movement}${blocked ? ' (blocked)' : ''}`;
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
