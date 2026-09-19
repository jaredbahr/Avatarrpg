import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ASSETS } from '../../src/content/assets/manifest';
import { resolvePainter } from '../../src/render/painters/registry';
import { parseAtlasJson } from '../../src/render/sheets/atlasJson';
import { readPng } from './lib/image';
import { alphaBounds, crop } from './lib/trim';

describe('Cutting character art', () => {
  for (const [name, key, variant] of [
    ['ruon', 'unit.ally.ruon', 'sergeant'],
    ['merc', 'unit.enemy.merc', 'blade'],
    ['sergeant', 'unit.enemy.sergeant', 'sergeant'],
  ]) {
    it(`${name} preserves ground contact, equipment fallback and authored clip coverage`, () => {
      if (!name || !key || !variant) throw new Error('Invalid case');
      const entry = ASSETS[key];
      if (entry?.kind !== 'sheet') throw new Error('Expected authored sheet');
      const atlas = parseAtlasJson(readFileSync(`public/${entry.atlas}`, 'utf8'));
      const sheet = readPng(`public/art/units/${name}.png`);
      const poses = new Map(
        [...atlas.frames].map(([id, r]) => [
          id,
          crop(sheet, { x: r.x, y: r.y, width: r.w, height: r.h }),
        ]),
      );
      expect(poses.size).toBe(11);
      for (const frame of poses.values()) {
        const b = alphaBounds(frame);
        if (!b) throw new Error('Empty pose');
        expect(b.y + b.height - 1).toBe(162);
        expect(b.x).toBeGreaterThanOrEqual(8);
        expect(b.x + b.width).toBeLessThanOrEqual(120);
      }
      const idle = poses.get(`${key}/idle/0`);
      const ko = poses.get(`${key}/ko/0`);
      if (!idle || !ko) throw new Error('Missing grounded poses');
      expect(alphaBounds(ko)!.height).toBeLessThan(alphaBounds(idle)!.height * 0.85);
      expect(poses.get(`${key}/walk/0`)?.data).not.toEqual(poses.get(`${key}/walk/1`)?.data);
      expect(entry.clips.melee?.frames).toEqual([`${key}/melee/0`, `${key}/melee/1`]);
      expect(poses.get(`${key}/melee/0`)).toEqual(poses.get(`${key}/cast/0`));
      expect(poses.get(`${key}/melee/1`)).toEqual(poses.get(`${key}/cast/1`));
      expect(entry.clips.walk?.fps).toBe(4);
      expect(entry.footprint).toEqual({ w: 1, h: 1 });
      expect(entry.anchor).toEqual({ x: 0.5, y: 0.85 });
      expect(resolvePainter(key).variant).toBe(variant);
    });
  }
});
