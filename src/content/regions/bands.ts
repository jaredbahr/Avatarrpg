/**
 * Region level bands (ADR 0011's hybrid model; #784).
 *
 * Every region carries a band, `minLevel`..`maxLevel`: the levels a party is expected to be at
 * while it is there. Entry is hard-gated by a `Condition` on the exits that reach the region, and
 * `rules/difficulty.ts` absorbs about two levels of slop inside it. This module holds the checks
 * that can run on data alone: the band is a real range, and every fight the region owns is tuned
 * for a level inside it. The route check (no region is ever entered below its band on any route,
 * the region-graph rewrite of `progression.test.ts`) waits for a second region.
 *
 * A band the owner has not approved yet is `placeholder: true`; `regions.test.ts` lists them, so a
 * placeholder cannot quietly become the shipped number.
 */
import type { RegionContent, RegionManifest } from './types';

/** Everything wrong with the regions' bands, as readable lines; empty when they hold. */
export function levelBandProblems(
  regions: readonly RegionManifest[],
  contents: readonly RegionContent[],
  /** The level cap, `MAX_LEVEL` in `core/rules/leveling.ts` (content may not import core logic). */
  maxLevel: number,
): string[] {
  const problems: string[] = [];
  const contentById = new Map(contents.map((content) => [content.id, content]));
  for (const region of regions) {
    const { minLevel, maxLevel: top } = region.levelBand;
    if (!Number.isInteger(minLevel) || !Number.isInteger(top)) {
      problems.push(`region "${region.id}" band ${minLevel}–${top} must be whole levels`);
      continue;
    }
    if (minLevel < 1 || top > maxLevel || minLevel > top) {
      problems.push(
        `region "${region.id}" band ${minLevel}–${top} must run upward within 1–${maxLevel}`,
      );
      continue;
    }
    for (const encounter of contentById.get(region.id)?.encounters ?? []) {
      if (encounter.expectedLevel < minLevel || encounter.expectedLevel > top) {
        problems.push(
          `encounter "${encounter.id}" expects level ${encounter.expectedLevel}, outside region "${region.id}" band ${minLevel}–${top}`,
        );
      }
    }
  }
  return problems;
}

/** The regions whose band still waits for the owner's numbers. */
export function placeholderBands(regions: readonly RegionManifest[]): string[] {
  return regions.filter((region) => region.levelBand.placeholder).map((region) => region.id);
}
