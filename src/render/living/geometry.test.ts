import { describe, expect, it } from 'vitest';
import { Camera } from '../camera';
import { FOOT_Y, hitsPebble, hitsVillager, riversideWalkTime } from './geometry';
import { frameIndex, resolveClip } from '../sheets/resolveClip';
import { HEADINGS, headingClip } from '../../content/assets/clips';
import { ASSETS, G_STRIDE_TILES } from '../../content/assets/manifest';

describe('riverside ground and gesture coordinates', () => {
  it('places feet at the clicked tile centre at different zoom and pan values', () => {
    const camera = new Camera({ width: 800, height: 600, dpr: 2 }, { width: 36, height: 24 });
    for (const scale of [0.5, 0.75, 1.5]) {
      camera.scale = scale;
      camera.offsetX = 117;
      camera.offsetY = 63;
      const box = camera.toScreen({ x: 6, y: 10 });
      expect(camera.toTile(box.x + box.size * 0.5, box.y + box.size * FOOT_Y)).toEqual({
        x: 6,
        y: 10,
      });
      expect(FOOT_Y).toBe(0.5);
    }
  });
  it('targets visible NPC bodies without stealing neighbouring ground clicks', () => {
    const pos = { x: 15, y: 9 };
    expect(hitsVillager({ x: 15.5, y: 8.7 }, pos)).toBe(true);
    expect(hitsVillager({ x: 14.8, y: 9.5 }, pos)).toBe(false);
    expect(hitsPebble({ x: 17.6, y: 15.5 }, { x: 17, y: 15 })).toBe(true);
    expect(hitsPebble({ x: 16.5, y: 15.5 }, { x: 17, y: 15 })).toBe(false);
  });
  it('keeps a four-way sheet on its 500 ms a tile', () => {
    expect(riversideWalkTime(500, false)).toBe(500);
  });
  it('keeps the G logical stride cadence at riverside scale in every heading', () => {
    for (const key of ['unit.fire.kaya', 'unit.water.sura'] as const) {
      const entry = ASSETS[key];
      if (entry?.kind !== 'sheet' || !entry.locomotion) throw new Error(`G sheet ${key}`);
      for (const heading of HEADINGS) {
        const clip = resolveClip(entry.clips, headingClip('walk', heading));
        if (!clip?.exact) throw new Error(`${key} walk ${heading}`);
        const clipTime = riversideWalkTime(entry.locomotion.walkMsPerTile[heading], true);
        const cels = clipTime * (clip.def.fps / 1000);
        expect(clip.def.frames.length / cels, `${key} ${heading}`).toBeCloseTo(G_STRIDE_TILES, 8);
        // The cel index the life layer asks for is that same clock.
        expect(frameIndex(clip, clipTime, undefined)).toBe(Math.floor(cels) % 12);
      }
    }
  });
});
