/**
 * Music, as data (ADR 0108).
 *
 * Each track is a seamless loop streamed from `public/audio/music/`, cut from a master in
 * `audio/source/music/` by `scripts/audio/music-loops.mjs`. Which one plays is decided by the map the
 * party is on (its battlefield in a fight), so a new map needs a row here and nothing in the player.
 * A map with no row keeps whatever is already playing, which is what an interlude wants.
 */

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

/**
 * Map id to track. Ba Dan and its riverside share the village theme, so the welcome-home ending
 * plays it too; the Forest Road plays the road theme both ways; the quarry gate, the Cutting and the
 * Driller's floor play the quarry theme, out and on the walk home, until the Forest Road takes over.
 */
export const MAP_MUSIC: Readonly<Record<string, MusicTrackId>> = {
  ba_dan_village: 'ba-dan',
  ba_dan_riverside: 'ba-dan',
  forest_road: 'road',
  quarry_gate: 'quarry',
  ambush_road: 'quarry',
  quarry_floor: 'quarry',
};
