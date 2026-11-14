/**
 * Every region's manifest, in content order (ADR 0111). A new region is a folder beside this file
 * and one line here, in `content.ts` and in `layouts.ts`.
 *
 * This list is small and always shipped; a region's data is in its `content.ts`.
 */
import type { RegionManifest, TopDownSceneSource } from './types';
import type { MusicTrackId } from '../music';
import { BA_DAN_VALLEY } from './baDanValley/manifest';

export const REGIONS: readonly RegionManifest[] = [BA_DAN_VALLEY];

/** The region a fresh game starts in: the one that owns the story's entry node. */
export const START_REGION_ID = BA_DAN_VALLEY.id;

/** The region that owns `mapId`, if any. */
export function regionOfMap(mapId: string): RegionManifest | undefined {
  return REGIONS.find((region) => region.mapIds.includes(mapId));
}

/** Every region's top-down scenes, by map id, in region order. */
export const REGION_SCENES: ReadonlyMap<string, TopDownSceneSource> = new Map(
  REGIONS.flatMap((region) => Object.entries(region.scenes)),
);

/** Every region's music rows, by map id. */
export const REGION_MUSIC: Readonly<Record<string, MusicTrackId>> = Object.fromEntries(
  REGIONS.flatMap((region) => Object.entries(region.music)),
);

export type { RegionContent, RegionManifest, StoryGroup, TopDownSceneSource } from './types';
