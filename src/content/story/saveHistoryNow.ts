/**
 * Today's story, gathered for the save-history check and its report (ADR 0112).
 * Tests and scripts only: the shipped game never imports this.
 */

import { CONTENT_BUNDLE } from '../index';
import { ID_ALIASES } from '../idAliases';
import { JOURNAL_NOTES } from '../journal';
import { REGION_CONTENT } from '../regions/content';
import type { RegionContent } from '../regions/types';
import { FLAG_BACKFILLS, HISTORY_REV } from './flagBackfills';
import { FLAG_REGISTRY, LATE_SCENES } from './flags';
import type { FlagDef } from './flags';
import { collectFlagUses } from './flagUsage';
import type { FlagSource, FlagUse } from './flagUsage';
import { FOLLOWERS } from './followers';
import { readersOf, visitedReaders, writeSites } from './saveHistory';
import type { HistoryInput, HistorySnapshot, StoryHistory } from './saveHistory';

/** Bundle collection to area prefix, as `flags.test.ts` names them. */
const AREA_NAMES: Readonly<Record<string, string>> = {
  story: 'story',
  maps: 'map',
  encounters: 'encounter',
  disciplines: 'discipline',
  residents: 'resident',
  backgroundRoles: 'role',
  anchors: 'anchor',
  characters: 'character',
  enemies: 'enemy',
  abilities: 'ability',
  props: 'prop',
};

/** The registry's `app:` areas as uses: the content walk cannot see app code. */
function appUses(registry: readonly FlagDef[]): FlagUse[] {
  return registry.flatMap((flag) => [
    ...flag.setBy
      .filter((area) => area.startsWith('app:'))
      .map((area): FlagUse => ({ key: flag.key, role: 'write', area, at: '' })),
    ...flag.readBy
      .filter((area) => area.startsWith('app:'))
      .map((area): FlagUse => ({ key: flag.key, role: 'read', area, at: '' })),
  ]);
}

/** A content bundle, its followers and its journal as the records the walks read. */
function bundleSources(
  bundle: Readonly<Record<string, unknown>>,
  followers: readonly unknown[],
  journal: readonly unknown[],
): FlagSource[] {
  const sources: FlagSource[] = Object.entries(bundle)
    .filter((entry): entry is [string, readonly unknown[]] => Array.isArray(entry[1]))
    .map(([name, records]) => ({ name: AREA_NAMES[name] ?? name, records }));
  sources.push({ name: 'follower', records: followers }, { name: 'journal', records: journal });
  return sources;
}

/** Every area each region owns. */
function regionAreas(
  regions: readonly Pick<
    RegionContent,
    'id' | 'story' | 'maps' | 'encounters' | 'residents' | 'anchors' | 'backgroundRoles'
  >[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const region of regions)
    out[region.id] = [
      ...region.story.map((node) => `story:${node.id}`),
      ...region.maps.map((map) => `map:${map.id}`),
      ...region.encounters.map((encounter) => `encounter:${encounter.id}`),
      ...region.residents.map((resident) => `resident:${resident.id}`),
      ...region.anchors.map((anchor) => `anchor:${anchor.id}`),
      ...region.backgroundRoles.map((role) => `role:${role.id}`),
    ].sort();
  return out;
}

const SOURCES_NOW = bundleSources(
  CONTENT_BUNDLE as unknown as Record<string, unknown>,
  FOLLOWERS,
  JOURNAL_NOTES,
);

export const USES_NOW: readonly FlagUse[] = [
  ...collectFlagUses(SOURCES_NOW),
  ...appUses(FLAG_REGISTRY),
];

/** Story node to the areas whose `visited` conditions read it, today. */
export const VISITED_READERS_NOW = visitedReaders(SOURCES_NOW);

export const HISTORY_NOW: StoryHistory = {
  historyRev: HISTORY_REV,
  regions: regionAreas(REGION_CONTENT),
  writes: writeSites(USES_NOW),
};

/** The check's whole input, against the given release snapshots (oldest first). */
export function historyInput(releases: readonly HistorySnapshot[]): HistoryInput {
  return {
    now: HISTORY_NOW,
    readers: readersOf(USES_NOW),
    visitedReaders: VISITED_READERS_NOW,
    scenes: LATE_SCENES,
    releases,
    registry: FLAG_REGISTRY,
    rules: FLAG_BACKFILLS,
    aliases: ID_ALIASES,
  };
}
