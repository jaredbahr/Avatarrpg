/**
 * Sparring bouts (ADR 0122): what the tipping platform will do when this round ends.
 *
 * The forecast runs the round end's own rule (`BattleDraft.tipPlatform`) on a throwaway copy of the
 * battle, so the board can never show a tip that the round end would not make. No RNG is drawn.
 */
import { RngCursor } from '../rng';
import { BattleDraft } from '../state/battleDraft';
import type { BattleState, ContentIndex, Vec2 } from '../types';
import { samePos } from './grid';
import { SQUARE_FOOTPRINTS } from './footprint';

export interface TipSlide {
  readonly unitId: string;
  readonly from: Vec2;
  readonly to: Vec2;
  /** The slide carries the fighter into the water: out of the bout. */
  readonly out: boolean;
}

/**
 * The slides the platform would make if the round ended now: empty when the encounter does not
 * tip, when the halves are even, or when nobody on the heavier half can move.
 */
export function forecastTip(
  content: ContentIndex,
  battle: BattleState,
  squareFootprints: boolean = SQUARE_FOOTPRINTS,
): readonly TipSlide[] {
  if (!content.encounters.get(battle.encounterId)?.bout?.tipping) return [];
  const draft = new BattleDraft(content, battle, new RngCursor(0), {
    resolveChanceStatuses: false,
    squareFootprints,
  });
  const outBefore = new Set(draft.boutOut);
  draft.tipPlatform();
  const slides: TipSlide[] = [];
  for (const before of battle.units) {
    const after = draft.unit(before.id);
    if (!after) continue;
    const out = !outBefore.has(before.id) && draft.boutOut.includes(before.id);
    if (samePos(before.pos, after.pos) && !out) continue;
    slides.push({ unitId: before.id, from: before.pos, to: after.pos, out });
  }
  return slides;
}
