import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../../content';
import { MAP_MUSIC, MUSIC_TRACKS, MUSIC_TRACK_IDS } from '../../content/music';
import { CROSSFADE_SECONDS, FIGHT_DUCK, MusicPlayer, musicFor } from './music';
import type { MusicBackend, MusicVoice } from './music';

describe('which track an area plays', () => {
  it('plays the title theme on the title and party setup', () => {
    expect(musicFor({ scene: 'title' })).toBe('title');
    expect(musicFor({ scene: 'setup', mapId: 'forest_road' })).toBe('title');
  });

  it('gives every map in the game a track, each of which ships', () => {
    for (const map of CONTENT.maps.values()) expect(MAP_MUSIC[map.id], map.id).toBeDefined();
    for (const id of MUSIC_TRACK_IDS) expect(MUSIC_TRACKS[id]).toMatch(/^audio\/music\/.+\.m4a$/);
    for (const mapId of Object.keys(MAP_MUSIC)) expect(CONTENT.maps.has(mapId), mapId).toBe(true);
  });

  it('maps every demo scene: village, road, quarry, and the walk home', () => {
    const at = (scene: string, mapId: string) => musicFor({ scene, mapId });
    expect(at('explore', 'ba_dan_village')).toBe('ba-dan');
    expect(at('explore', 'ba_dan_riverside')).toBe('ba-dan');
    expect(at('dialogue', 'ba_dan_village')).toBe('ba-dan');
    expect(at('explore', 'forest_road')).toBe('road');
    expect(at('explore', 'quarry_gate')).toBe('quarry');
    expect(at('explore', 'ambush_road')).toBe('quarry');
    expect(at('explore', 'quarry_floor')).toBe('quarry');
    // The welcome-home ending stands in Ba Dan.
    expect(at('dialogue', 'ba_dan_village')).toBe('ba-dan');
    // Every explore node on the route resolves through its map.
    for (const node of CONTENT.story.values())
      if (node.kind === 'explore') expect(at('explore', node.mapId), node.id).not.toBeNull();
  });

  it('plays a fight’s battlefield, and keeps what plays for an unknown place', () => {
    for (const encounter of CONTENT.encounters.values())
      expect(
        musicFor({ scene: 'combat', mapId: 'ba_dan_village', battleMapId: encounter.mapId }),
      ).toBe(MAP_MUSIC[encounter.mapId]);
    expect(musicFor({ scene: 'combat', battleMapId: 'forest_road' })).toBe('road');
    expect(musicFor({ scene: 'dialogue', mapId: '' })).toBeNull();
    expect(musicFor({ scene: 'dialogue', mapId: 'nowhere' })).toBeNull();
  });
});

interface FakeVoice extends MusicVoice {
  url: string;
  fades: [number, number][];
  stopped: boolean;
}

function fakeBackend() {
  const voices: FakeVoice[] = [];
  const log: string[] = [];
  const levels: [number, number][] = [];
  const backend: MusicBackend = {
    start(url) {
      const voice: FakeVoice = {
        url,
        fades: [],
        stopped: false,
        fade(to, seconds) {
          voice.fades.push([to, seconds]);
        },
        stop() {
          voice.stopped = true;
        },
      };
      voices.push(voice);
      return voice;
    },
    level: (to, seconds) => void levels.push([to, seconds]),
    pause: () => void log.push('pause'),
    resume: () => void log.push('resume'),
    close: () => void log.push('close'),
  };
  return { backend, voices, log, levels };
}

describe('the music player', () => {
  let volume = 0.35;
  let created = 0;
  let fake = fakeBackend();
  const player = () =>
    new MusicPlayer(
      () => volume,
      () => {
        created += 1;
        return fake.backend;
      },
    );

  beforeEach(() => {
    vi.useFakeTimers();
    volume = 0.35;
    created = 0;
    fake = fakeBackend();
  });
  afterEach(() => vi.useRealTimers());

  it('makes no sound before a gesture, then starts the wanted track', () => {
    const music = player();
    music.setTrack('title');
    expect(created).toBe(0);
    expect(music.playing).toBe(false);
    music.unlock();
    expect(created).toBe(1);
    expect(fake.voices.map((v) => v.url)).toEqual([MUSIC_TRACKS.title]);
    expect(fake.voices[0]?.fades).toEqual([[1, CROSSFADE_SECONDS]]);
    expect(fake.levels[0]).toEqual([0.35, 0]);
    expect(music.track).toBe('title');
    expect(music.playing).toBe(true);
    // Every later gesture only resumes.
    music.unlock();
    expect(created).toBe(1);
    expect(fake.voices).toHaveLength(1);
  });

  it('crossfades on an area change and stops the old track once it is silent', () => {
    const music = player();
    music.setTrack('title');
    music.unlock();
    music.setTrack('ba-dan');
    const [title, village] = fake.voices;
    expect(title?.fades.at(-1)).toEqual([0, CROSSFADE_SECONDS]);
    expect(village?.url).toBe(MUSIC_TRACKS['ba-dan']);
    expect(village?.fades).toEqual([[1, CROSSFADE_SECONDS]]);
    vi.advanceTimersByTime(CROSSFADE_SECONDS * 1000 - 1);
    expect(title?.stopped).toBe(false);
    vi.advanceTimersByTime(200);
    expect(title?.stopped).toBe(true);
    expect(village?.stopped).toBe(false);
  });

  it('never restarts a track that is already playing', () => {
    const music = player();
    music.unlock();
    music.setTrack('road');
    music.setTrack('road');
    music.setTrack(null);
    music.setTrack('road');
    vi.advanceTimersByTime(10_000);
    expect(fake.voices).toHaveLength(1);
    expect(fake.voices[0]?.fades).toEqual([[1, CROSSFADE_SECONDS]]);
    expect(fake.voices[0]?.stopped).toBe(false);
  });

  it('ducks for a fight without switching', () => {
    const music = player();
    music.setTrack('road');
    music.unlock();
    music.setDuck(true);
    music.setDuck(true);
    expect(fake.levels.at(-1)?.[0]).toBeCloseTo(0.35 * FIGHT_DUCK);
    expect(fake.levels).toHaveLength(2);
    music.setDuck(false);
    expect(fake.levels.at(-1)?.[0]).toBeCloseTo(0.35);
    expect(fake.voices).toHaveLength(1);
  });

  it('Off stops everything and remembers the area for when it comes back', () => {
    const music = player();
    music.setTrack('title');
    music.unlock();
    music.setTrack('quarry');
    volume = 0;
    music.volumeChanged();
    expect(fake.log).toContain('close');
    expect(fake.voices.every((v) => v.stopped)).toBe(true);
    expect(music.playing).toBe(false);
    music.unlock();
    expect(created).toBe(1);
    volume = 1;
    fake = fakeBackend();
    music.volumeChanged();
    music.unlock();
    expect(created).toBe(2);
    expect(fake.voices.map((v) => v.url)).toEqual([MUSIC_TRACKS.quarry]);
    expect(fake.levels[0]).toEqual([1, 0]);
  });

  it('pauses while the tab is hidden and resumes on return', () => {
    const music = player();
    music.setTrack('ba-dan');
    music.unlock();
    fake.log.length = 0;
    music.setHidden(true);
    expect(music.playing).toBe(false);
    // A gesture while hidden does not wake it.
    music.unlock();
    music.setHidden(false);
    expect(fake.log).toEqual(['pause', 'resume']);
    expect(music.playing).toBe(true);
  });

  it('plays silent where the browser has no audio', () => {
    const music = new MusicPlayer(
      () => 0.7,
      () => null,
    );
    music.setTrack('title');
    music.unlock();
    expect(music.track).toBeNull();
    expect(music.playing).toBe(false);
  });
});

describe('the shipped loops', () => {
  it('are one per track, cut by the loop script from a master that is in the repo', async () => {
    const { existsSync, readFileSync } = await import('node:fs');
    const loops = JSON.parse(readFileSync('audio/source/music/loops.json', 'utf8')) as {
      tracks: { id: string; master: string; start: number; end: number }[];
    };
    expect(loops.tracks.map((t) => t.id).sort()).toEqual([...MUSIC_TRACK_IDS].sort());
    for (const track of loops.tracks) {
      expect(existsSync(`audio/source/music/${track.master}`), track.master).toBe(true);
      expect(track.end - track.start, track.id).toBeGreaterThan(30);
    }
    for (const id of MUSIC_TRACK_IDS)
      expect(existsSync(`public/${MUSIC_TRACKS[id]}`), id).toBe(true);
  });
});
