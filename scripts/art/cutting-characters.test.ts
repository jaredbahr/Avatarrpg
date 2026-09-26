import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ASSETS } from '../../src/content/assets/manifest';
import { resolvePainter } from '../../src/render/painters/registry';
import { parseAtlasJson } from '../../src/render/sheets/atlasJson';
import { readPng } from './lib/image';
import { alphaBounds, crop } from './lib/trim';
import { validateSheets } from './validate';

describe('Cutting character art', () => {
  for (const [name, key, variant] of [
    ['ruon', 'unit.ally.ruon', 'sergeant'],
    ['merc', 'unit.enemy.merc', 'blade'],
    ['sergeant', 'unit.enemy.sergeant', 'sergeant'],
  ]) {
    it(`${name} preserves ground contact, equipment fallback and authored clip coverage`, async () => {
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
        expect(b.y + b.height - 1).toBe(Math.round((entry.frameSize?.h ?? 192) * 0.85) - 1);
        expect(b.x).toBeGreaterThanOrEqual(8);
        expect(b.x + b.width).toBeLessThanOrEqual((entry.frameSize?.w ?? 128) - 8);
      }
      const idle = poses.get(`${key}/idle/0`);
      const ko = poses.get(`${key}/ko/0`);
      if (!idle || !ko) throw new Error('Missing grounded poses');
      expect(alphaBounds(idle)?.height).toBe(151);
      expect(alphaBounds(ko)!.height).toBeLessThan(alphaBounds(idle)!.height * 0.85);
      expect(poses.get(`${key}/walk/0`)?.data).not.toEqual(poses.get(`${key}/walk/1`)?.data);
      expect(entry.clips.melee?.frames).toEqual([`${key}/melee/0`, `${key}/melee/1`]);
      expect(poses.get(`${key}/melee/0`)).toEqual(poses.get(`${key}/cast/0`));
      expect(poses.get(`${key}/melee/1`)).toEqual(poses.get(`${key}/cast/1`));
      expect(entry.clips.walk?.fps).toBe(4);
      expect(entry.footprint).toEqual({ w: 1, h: 1 });
      expect(entry.anchor).toEqual({ x: 0.5, y: 0.85 });
      expect(resolvePainter(key).variant).toBe(variant);
      expect(await validateSheets('public', { [key]: entry })).toEqual([]);
      expect(
        (await validateSheets('public', { [key]: { ...entry, frameSize: undefined } })).some(
          (problem) => problem.includes('expected 128x192'),
        ),
      ).toBe(true);
      expect(
        (
          await validateSheets('public', { [key]: { ...entry, frameSize: { w: 600, h: 600 } } })
        ).some((problem) => problem.includes('bounded art envelope')),
      ).toBe(true);
    });
  }
  it('keeps undeclared hero frames exact and matches their oblique adult height', async () => {
    for (const [name, key] of [
      ['sura', 'unit.water.sura'],
      ['kaya', 'unit.fire.kaya'],
    ]) {
      if (!name || !key) throw new Error('Invalid hero reference');
      const entry = ASSETS[key];
      if (entry?.kind !== 'sheet') throw new Error('Missing hero sheet');
      expect(entry.frameSize).toBeUndefined();
      expect(await validateSheets('public', { [key]: entry })).toEqual([]);
      const atlas = parseAtlasJson(readFileSync(`public/${entry.atlas}`, 'utf8'));
      const rect = atlas.frames.get(`${key}/idle/0`);
      if (!rect) throw new Error('Missing hero standing pose');
      if (atlas.image.endsWith('.webp')) {
        // The PixelLab G party (ADR 0050, ADR 0051).
        expect(['kaya', 'sura', 'bo']).toContain(name);
        expect([rect.w, rect.h]).toEqual([128, 192]);
        expect(entry.pixelsPerTile).toBe(128);
        expect(entry.anchor).toEqual({ x: 0.5, y: 0.85 });
      } else {
        const frame = crop(readPng(`public/art/units/${atlas.image}`), {
          x: rect.x,
          y: rect.y,
          width: rect.w,
          height: rect.h,
        });
        const height = alphaBounds(frame)?.height ?? 0;
        expect(Math.abs(height * 1.25 - 151)).toBeLessThan(1);
      }
    }
  });
});
