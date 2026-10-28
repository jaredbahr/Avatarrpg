import { describe, expect, it } from 'vitest';
import { HEADINGS, headingClip } from './clips';
import { resolveAsset, useWorldStyleTest } from './manifest';
import { WORLD_STYLE_TEST } from './worldStyleTest';
import { OBLIQUE_FIGURE_SCALE } from '../../app/anim/actorScale';
import { crispRatio } from '../../render/pixelSampling';

const KEYS = ['unit.fire.kaya', 'unit.water.sura', 'unit.earth.bo', 'npc.shopkeeper'];

describe('the world-style figure test (?style=world)', () => {
  it('changes nothing until it is asked for', () => {
    for (const key of KEYS) {
      const entry = resolveAsset(key);
      expect(entry.kind === 'sheet' && entry.atlas).not.toMatch(/style-test/);
    }
  });

  it('swaps the four sheets and draws one art px on one world px at every integer zoom', () => {
    useWorldStyleTest();
    for (const key of KEYS) {
      const entry = resolveAsset(key);
      if (entry.kind !== 'sheet') throw new Error(`${key} is not a sheet`);
      expect(entry.atlas).toMatch(/^art\/units\/style-test\//);
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

  it('plays the walk at 100 to 130 ms a cel or near it at the brisk 750 ms a tile', () => {
    for (const t of Object.values(WORLD_STYLE_TEST)) {
      for (const ms of t.walkMsPerTile) {
        // the clip ms a tile the animator plays (it divides by the figure scale), then the real cel time
        const cel = (t.walkCelMs * 750) / (ms / OBLIQUE_FIGURE_SCALE);
        expect(cel).toBeGreaterThan(80);
        expect(cel).toBeLessThan(140);
      }
    }
  });
});
