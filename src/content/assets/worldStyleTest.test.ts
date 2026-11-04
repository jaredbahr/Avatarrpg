import { describe, expect, it } from 'vitest';
import { HEADINGS, headingClip } from './clips';
import { resolveAsset, useWorldStyleTest } from './manifest';
import { readFileSync } from 'node:fs';
import { WORLD_PARTY } from './worldParty';
import { WORLD_STYLE_TEST } from './worldStyleTest';
import { OBLIQUE_FIGURE_SCALE } from '../../app/anim/actorScale';
import { crispRatio } from '../../render/pixelSampling';

const KEYS = ['unit.fire.kaya', 'unit.water.sura', 'unit.earth.bo', 'npc.shopkeeper'];
const PARTY = ['unit.fire.kaya', 'unit.water.sura', 'unit.earth.bo'];

describe('the world-style figures', () => {
  it('changes nothing until it is asked for', () => {
    for (const key of KEYS) {
      const entry = resolveAsset(key);
      expect(entry.kind === 'sheet' && entry.atlas).not.toMatch(/style-test|units\/world\//);
    }
  });

  it('draws one art px on one world px at every integer zoom, in every heading', () => {
    useWorldStyleTest();
    for (const key of KEYS) {
      const entry = resolveAsset(key);
      if (entry.kind !== 'sheet') throw new Error(`${key} is not a sheet`);
      expect(entry.atlas).toMatch(/^art\/units\/(style-test|world)\//);
      const worldPerArt = (64 / entry.pixelsPerTile) * OBLIQUE_FIGURE_SCALE;
      expect(worldPerArt).toBeCloseTo(1, 9);
      for (const n of [1, 2, 3, 4]) expect(crispRatio(n * worldPerArt)).toBe(true);
      for (const heading of HEADINGS) {
        expect(entry.clips[headingClip('walk', heading)]?.frames).toHaveLength(6);
        expect(entry.clips[headingClip('idle', heading)]?.frames).toHaveLength(2);
        expect(entry.locomotion?.walkMsPerTile[heading]).toBeGreaterThan(0);
      }
    }
  });

  it('plays the walk at 70 to 140 ms a cel at the brisk 750 ms a tile', () => {
    // The party's north and south walks cover less ground a loop than #317's diagonals, so they play quicker.
    for (const t of [...Object.values(WORLD_STYLE_TEST), ...Object.values(WORLD_PARTY)]) {
      for (const ms of t.walkMsPerTile) {
        // the clip ms a tile the animator plays (it divides by the figure scale), then the real cel time
        const cel = (t.walkCelMs * 750) / (ms / OBLIQUE_FIGURE_SCALE);
        expect(cel).toBeGreaterThan(70);
        expect(cel).toBeLessThan(140);
      }
    }
  });

  describe("the party's world sheets (phase 2a)", () => {
    const atlasFrames = (path: string) =>
      Object.keys(
        (JSON.parse(readFileSync(`public/${path}`, 'utf8')) as { frames: object }).frames,
      );

    it('draws every heading from its own cels, with a stance, a rest and a hit in each', () => {
      useWorldStyleTest();
      for (const key of PARTY) {
        const entry = resolveAsset(key);
        if (entry.kind !== 'sheet') throw new Error(`${key} is not a sheet`);
        const packed = new Set([entry.atlas, ...(entry.atlasPages ?? [])].flatMap(atlasFrames));
        const walks = new Set<string>();
        for (const heading of HEADINGS) {
          for (const base of ['idle', 'walk', 'rest', 'stance'] as const) {
            const clip = entry.clips[headingClip(base, heading)];
            expect(clip, `${key} ${base} ${heading}`).toBeDefined();
            for (const f of clip?.frames ?? []) expect(packed.has(f), f).toBe(true);
          }
          walks.add(entry.clips[headingClip('walk', heading)]?.frames[0] ?? '');
        }
        // No heading borrows another's walk: eight distinct clips.
        expect(walks.size).toBe(8);
      }
    });

    it('packs every cel its hit and knockout clips and its bend set name', () => {
      for (const key of PARTY) {
        const entry = resolveAsset(key);
        if (entry.kind !== 'sheet' || !entry.clipData) throw new Error(`${key} has no clip data`);
        const packed = new Set([entry.atlas, ...(entry.atlasPages ?? [])].flatMap(atlasFrames));
        const clips = JSON.parse(readFileSync(`public/${entry.clipData}`, 'utf8')) as Record<
          string,
          { frames: string[] }
        >;
        for (const heading of HEADINGS)
          expect(clips[`hit${heading[0]?.toUpperCase()}${heading.slice(1)}`]).toBeDefined();
        for (const ko of ['koSouthEast', 'koSouthWest', 'koNorthEast', 'koNorthWest'])
          expect(clips[ko]).toBeDefined();
        for (const [name, clip] of Object.entries(clips))
          for (const f of clip.frames) expect(packed.has(f), `${name} ${f}`).toBe(true);
        if (!entry.bend) continue;
        const bendCels = new Set((entry.bendPages ?? []).flatMap(atlasFrames));
        const set = JSON.parse(readFileSync(`public/${entry.bend}`, 'utf8')) as {
          facings: Record<string, { frames: string[]; socketsPerFrame: unknown[] }>;
        };
        expect(Object.keys(set.facings)).toHaveLength(8);
        for (const facing of Object.values(set.facings)) {
          for (const f of facing.frames) expect(bendCels.has(f), f).toBe(true);
          expect(facing.socketsPerFrame).toHaveLength(facing.frames.length);
        }
      }
    });
  });
});
