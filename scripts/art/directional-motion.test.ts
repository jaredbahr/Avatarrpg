import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ASSETS } from '../../src/content/assets/manifest';
import { CHARACTERS } from '../../src/content/characters';
import { parseAtlasJson } from '../../src/render/sheets/atlasJson';
import { frameIndex, resolveClip } from '../../src/render/sheets/resolveClip';
import { readPng } from './lib/image';
import { alphaBounds, crop, lowestOpaqueRow } from './lib/trim';

describe('directional art compatibility', () => {
  it('preserves every original pose and the foot anchor for all heroes and both riverside sheets', () => {
    const keys = [...CHARACTERS.map((c) => c.sprite), 'unit.village.kaya', 'unit.village.sura'];
    for (const key of keys) {
      const entry = ASSETS[key];
      if (entry?.kind !== 'sheet') throw new Error(`Missing ${key}`);
      const originalStem = key.startsWith('unit.village.')
        ? `riverside-${key.split('.').at(-1)}`
        : key.split('.').at(-1);
      const oldAtlas = parseAtlasJson(
        readFileSync(`assets/reference/character-poses/${originalStem}.json`, 'utf8'),
      );
      const oldImage = readPng(`assets/reference/character-poses/${originalStem}.png`);
      const atlas = parseAtlasJson(readFileSync(`public/${entry.atlas}`, 'utf8'));
      const image = readPng(`public/art/units/${atlas.image}`);
      const extract = (im: typeof image, r: { x: number; y: number; w: number; h: number }) =>
        crop(im, { x: r.x, y: r.y, width: r.w, height: r.h });
      for (const [id, r] of oldAtlas.frames) {
        const next = atlas.frames.get(id);
        if (!next) throw new Error(`Lost existing pose ${id}`);
        expect(
          Buffer.from(extract(image, next).data).equals(Buffer.from(extract(oldImage, r).data)),
          id,
        ).toBe(true);
      }
      const first = oldAtlas.frames.get(`${key}/idle/0`);
      if (!first) throw new Error('Missing idle');
      const height = alphaBounds(extract(oldImage, first))?.height ?? 0;
      expect(entry.anchor).toEqual({ x: 0.5, y: 0.85 });
      for (const clip of ['idleNorth', 'idleSouth', 'walkNorth', 'walkSouth'] as const) {
        const resolved = resolveClip(entry.clips, clip);
        expect(resolved?.exact).toBe(true);
        for (const id of resolved?.def.frames ?? []) {
          const rect = atlas.frames.get(id);
          if (!rect) throw new Error(`Missing ${id}`);
          const frame = extract(image, rect);
          expect([rect.w, rect.h]).toEqual([128, 192]);
          expect(lowestOpaqueRow(frame)).toBe(162);
          const bounds = alphaBounds(frame);
          expect(bounds?.height ?? 0).toBeLessThanOrEqual(height + 1);
          expect(bounds?.height ?? 0).toBeGreaterThan(height * 0.85);
        }
        if (resolved && clip.startsWith('walk')) {
          expect([0, 250, 500, 750, 1000].map((t) => frameIndex(resolved, t, undefined))).toEqual([
            0, 1, 2, 3, 0,
          ]);
        }
      }
    }
  });

  it('uses an existing walk/idle on older sheets and painters while directional art loads', () => {
    const clips = {
      idle: { frames: ['rest'], fps: 1, loop: true },
      walk: { frames: ['left', 'right'], fps: 4, loop: true },
    };
    expect(resolveClip(clips, 'walkNorth')?.clip).toBe('walk');
    expect(resolveClip(clips, 'walkSouth')?.clip).toBe('walk');
    expect(resolveClip(clips, 'idleNorth')?.clip).toBe('idle');
    expect(resolveClip(clips, 'idleSouth')?.clip).toBe('idle');
  });
});
