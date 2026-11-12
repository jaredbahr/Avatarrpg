/**
 * Words for a combo before and after the table has found it (#622).
 *
 * A combo the party has not seen yet is only hinted at: the forecast says a
 * rule *will* fire, so "something here reacts to fire" is true, but what it
 * does stays a surprise until it happens once. Every word comes from the
 * forecast entry and the rule it names; nothing here decides whether a rule
 * fires.
 */

import type { ComboRule, ContentIndex, DamageType, SurfaceId } from '../../core/types';
import type { ForecastEntry } from '../../core/rules/reactions';

/** Which combos are named openly: every one, or the ids this save has found. */
export type ComboReveal = 'all' | readonly string[];

/** 'lightning' has no surface of its own; 'fire' has both and shares a name. */
export function appliedName(content: ContentIndex, applied: DamageType | SurfaceId): string {
  const surface = content.surfaces.get(applied as SurfaceId);
  if (surface) return surface.name;
  return applied.charAt(0).toUpperCase() + applied.slice(1);
}

export function surfaceName(content: ContentIndex, id: SurfaceId | null): string {
  if (!id) return 'bare ground';
  return content.surfaces.get(id)?.name ?? id;
}

/** "Fire + Oil": what was applied, then what it met. */
export function comboName(content: ContentIndex, rule: ComboRule): string {
  return `${appliedName(content, rule.applied)} + ${surfaceName(content, rule.existing)}`;
}

export function comboRevealed(reveal: ComboReveal, id: string): boolean {
  return reveal === 'all' || reveal.includes(id);
}

/**
 * The hint for a forecast entry whose rule is still undiscovered, or null when
 * the entry should be shown in full (a plain paint, or a combo already found).
 */
export function comboHint(
  content: ContentIndex,
  entry: ForecastEntry,
  reveal: ComboReveal,
): string | null {
  if (entry.kind !== 'reaction' || comboRevealed(reveal, entry.comboId)) return null;
  const rule = content.combos.find((candidate) => candidate.id === entry.comboId);
  if (!rule) return null;
  return `Something here reacts to ${appliedName(content, rule.applied).toLowerCase()}.`;
}
