import { describe, expect, it } from 'vitest';
import { Camera } from '../camera';
import { FOOT_Y, hitsPebble, hitsVillager, riversideWalkTime } from './geometry';
import { frameIndex, resolveClip } from '../sheets/resolveClip';
import { ASSETS } from '../../content/assets/manifest';

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
  it('plays all four riverside drawings once over two tiles of travel', () => {
    const entry = ASSETS['unit.village.sura'];
    if (!entry || entry.kind !== 'sheet') throw new Error('Expected riverside sheet');
    const clip = resolveClip(entry.clips, 'walk');
    if (!clip) throw new Error('Expected walk clip');
    expect(
      [0, 0.5, 1, 1.5, 2].map((distance) =>
        frameIndex(clip, riversideWalkTime(distance * 500, true), undefined),
      ),
    ).toEqual([0, 1, 2, 3, 0]);
    expect(riversideWalkTime(500, false)).toBe(500);
  });
  it('keeps the front/back stride in step with the retained side walk', () => {
    const entry = ASSETS['unit.village.sura'];
    if (!entry || entry.kind !== 'sheet') throw new Error('Expected riverside sheet');
    for (const direction of ['walkNorth', 'walkSouth'] as const) {
      const clip = resolveClip(entry.clips, direction);
      if (!clip) throw new Error('Expected directional clip');
      expect(
        [0, 0.5, 1, 1.5, 2].map((distance) =>
          frameIndex(clip, riversideWalkTime(distance * 500, true, true), undefined),
        ),
      ).toEqual([0, 1, 2, 3, 0]);
    }
  });
});
