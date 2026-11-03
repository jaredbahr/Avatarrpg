import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { ASSETS } from '../../src/content/assets/manifest';
import { CHARACTERS } from '../../src/content/characters';
import { parseAtlasJson } from '../../src/render/sheets/atlasJson';
import { frameIndex, resolveClip } from '../../src/render/sheets/resolveClip';
import { readPng } from './lib/image';
import { alphaBounds, crop, lowestOpaqueRow } from './lib/trim';
import { decodeWebp } from './lib/webp';
import { MARGIN } from './lib/align';
import { STRIDE_ABOVE, STRIDE_BELOW, validateSheets } from './validate';

// Decoding WebP plates is cheap alone and slow on a busy machine; ci:local timed out the
// 5 s default once. Headroom here, not a raised global timeout.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

describe('hero lateral walk art', () => {
  it('preserves all prior action and directional pixels while supplying a complete walk loop', async () => {
    for (const character of CHARACTERS) {
      const key = character.sprite;
      const name = key.split('.').at(-1);
      const entry = ASSETS[key];
      if (entry?.kind !== 'sheet') throw new Error(`Missing sheet ${key}`);
      const oldStem = `assets/reference/character-locomotion/locomotion-${name}`;
      const oldAtlas = parseAtlasJson(readFileSync(`${oldStem}.json`, 'utf8'));
      const oldImage = readPng(`${oldStem}.png`);
      const atlas = parseAtlasJson(readFileSync(`public/${entry.atlas}`, 'utf8'));
      if (atlas.image.endsWith('.webp')) {
        // The PixelLab G party (ADR 0050, ADR 0051), on the world's 64 px G1
        // grid since ADR 0089: every bound below is in 128 px G figures, scaled.
        expect(['unit.fire.kaya', 'unit.water.sura', 'unit.earth.bo']).toContain(key);
        const g = entry.pixelsPerTile / 128;
        const walk = resolveClip(entry.clips, 'walk');
        expect(walk?.exact).toBe(true);
        expect(walk?.def.frames).toHaveLength(12);
        expect(walk?.def.fps).toBeCloseTo(1000 / 114);
        expect(await validateSheets('public', { [key]: entry })).toEqual([]);
        const decoded = await decodeWebp(
          new Uint8Array(readFileSync(`public/art/units/${atlas.image}`)),
        );
        const hashes = new Set<string>();
        for (const id of walk?.def.frames ?? []) {
          const rect = atlas.frames.get(id);
          if (!rect) throw new Error(`Missing cel ${id}`);
          expect([rect.w, rect.h], id).toEqual([128 * g, 192 * g]);
          const frame = crop(decoded, { x: rect.x, y: rect.y, width: rect.w, height: rect.h });
          const bounds = alphaBounds(frame);
          if (!bounds) throw new Error(`Empty cel ${id}`);
          const foot = lowestOpaqueRow(frame);
          const line = Math.round(0.85 * 192 * g);
          expect(foot, id).toBeGreaterThanOrEqual(line - STRIDE_ABOVE * g);
          expect(foot, id).toBeLessThanOrEqual(line + STRIDE_BELOW * g);
          expect(bounds.x).toBeGreaterThanOrEqual(MARGIN * g);
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(128 * g - MARGIN * g);
          expect(bounds.y).toBeGreaterThanOrEqual(MARGIN * g);
          hashes.add(createHash('sha256').update(frame.data).digest('hex'));
        }
        expect(hashes.size, `${key} needs twelve distinct cels`).toBe(12);
        continue;
      }
      const image = readPng(`public/art/units/${atlas.image}`);
      const extract = (im: typeof image, r: { x: number; y: number; w: number; h: number }) =>
        crop(im, { x: r.x, y: r.y, width: r.w, height: r.h });
      for (const [id, rect] of oldAtlas.frames) {
        const next = atlas.frames.get(id);
        if (!next) throw new Error(`Lost pose ${id}`);
        expect(
          Buffer.from(extract(image, next).data).equals(Buffer.from(extract(oldImage, rect).data)),
          id,
        ).toBe(true);
      }
      const walk = resolveClip(entry.clips, 'walk');
      expect(walk?.exact, key).toBe(true);
      expect(walk?.def.frames).toHaveLength(4);
      if (!walk) throw new Error(`Missing walk ${key}`);
      expect([0, 250, 500, 750, 1000].map((t) => frameIndex(walk, t, undefined))).toEqual([
        0, 1, 2, 3, 0,
      ]);
      const hashes = new Set<string>();
      for (const id of walk.def.frames) {
        const rect = atlas.frames.get(id);
        if (!rect) throw new Error(`Missing cel ${id}`);
        const frame = extract(image, rect);
        const bounds = alphaBounds(frame);
        if (!bounds) throw new Error(`Empty cel ${id}`);
        expect([rect.w, rect.h]).toEqual([128, 192]);
        expect(lowestOpaqueRow(frame), id).toBe(162);
        expect(bounds.x).toBeGreaterThanOrEqual(8);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(120);
        expect(bounds.y).toBeGreaterThanOrEqual(8);
        hashes.add(createHash('sha256').update(frame.data).digest('hex'));
      }
      expect(hashes.size, `${key} needs four distinct cels`).toBe(4);
    }
  });
});
