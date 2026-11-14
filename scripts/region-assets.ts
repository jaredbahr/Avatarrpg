/**
 * Which shipped files belong to which region (ADR 0111 §4), for the asset budget report.
 *
 * A region's art is the folder of each of its top-down scenes (the scene, its plates and its
 * scenery, `art/topdown/<map>/`); its music is the tracks its maps play. A track no region plays
 * (the title theme) is shared. Figures, portraits, objects, effects and sound effects are shared
 * today: the asset manifest is one list.
 */
import { MUSIC_TRACKS } from '../src/content/music';
import type { MusicTrackId } from '../src/content/music';
import { REGIONS } from '../src/content/regions';
import type { RegionManifest } from '../src/content/regions';

export interface RegionAssets {
  readonly id: string;
  /** Folders under `public/`, each ending in `/`. */
  readonly artDirs: readonly string[];
  /** Files under `public/`. */
  readonly musicFiles: readonly string[];
}

const folderOf = (url: string) => url.slice(0, url.lastIndexOf('/') + 1);

export function regionAssets(regions: readonly RegionManifest[] = REGIONS): {
  readonly regions: readonly RegionAssets[];
  readonly sharedMusic: readonly string[];
} {
  const played = new Set<MusicTrackId>();
  const out = regions.map((region) => {
    const tracks = [...new Set(Object.values(region.music))];
    for (const track of tracks) played.add(track);
    return {
      id: region.id,
      artDirs: [...new Set(Object.values(region.scenes).map((scene) => folderOf(scene.url)))],
      musicFiles: tracks.map((track) => MUSIC_TRACKS[track]),
    };
  });
  const sharedMusic = (Object.keys(MUSIC_TRACKS) as MusicTrackId[])
    .filter((track) => !played.has(track))
    .map((track) => MUSIC_TRACKS[track]);
  return { regions: out, sharedMusic };
}
