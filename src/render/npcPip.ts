import { resolveAsset } from '../content/assets/manifest';
import { FOOT_LINE } from './sheets/bake';

/**
 * How high a resident's head stands above its feet on its G sheet, in tiles at
 * scale 1, measured on the packed idle cels (issue #284): about 0.9 for an
 * adult, 0.68 for Pella. The old illustrated images filled their frame to
 * `FOOT_LINE - 0.08`, which a G figure's head does not reach.
 */
export const G_HEAD_TILES = 0.9;
const G_HEADS: Readonly<Record<string, number>> = { 'npc.kid': 0.68 };
/** The gap between the top of the head and the talk pip's centre. */
const PIP_GAP = 0.12;

/** Tiles above the feet, drawn, at which an NPC's talk pip sits: just over its head. */
export function npcPipLift(sprite: string, scale: number): number {
  const entry = resolveAsset(sprite);
  if (entry.kind === 'sheet' && entry.locomotion?.headings === 8)
    return ((G_HEADS[sprite] ?? G_HEAD_TILES) + PIP_GAP) * scale;
  return (FOOT_LINE - 0.08) * scale;
}
