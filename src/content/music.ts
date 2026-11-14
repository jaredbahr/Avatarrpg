/**
 * Music, as data (ADR 0108).
 *
 * Each track is a seamless loop streamed from `public/audio/music/`, cut from a master in
 * `audio/source/music/` by `scripts/audio/music-loops.mjs`. Which one plays is decided by the map the
 * party is on (its battlefield in a fight), so a new map needs a row in its region's manifest and nothing in the player.
 * A map with no row keeps whatever is already playing, which is what an interlude wants.
 */
import { REGION_MUSIC } from './regions';

export const MUSIC_TRACK_IDS = ['title', 'ba-dan', 'road', 'quarry'] as const;
export type MusicTrackId = (typeof MUSIC_TRACK_IDS)[number];

/** Site-relative, resolved through `assetUrl` like every other asset. */
export const MUSIC_TRACKS: Readonly<Record<MusicTrackId, string>> = {
  title: 'audio/music/title.m4a',
  'ba-dan': 'audio/music/ba-dan.m4a',
  road: 'audio/music/road.m4a',
  quarry: 'audio/music/quarry.m4a',
};

/** The title screen and party setup. */
export const TITLE_MUSIC: MusicTrackId = 'title';

/** Map id to track: each region's `music` rows (ADR 0111). */
export const MAP_MUSIC: Readonly<Record<string, MusicTrackId>> = REGION_MUSIC;
