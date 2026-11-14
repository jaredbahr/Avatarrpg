/**
 * Since T7 (ADR 0104) the oblique map art is gone, so nothing the game draws is left for run time;
 * only the area music streams. Workbox is told so, and the asset budget counts the precache the
 * same way.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { PRECACHE_IGNORES, STREAMED, isPrecacheIgnored } from './precache.mjs';

describe('the precache', () => {
  it('precaches every image, the top-down family and the riverside included', () => {
    for (const path of [
      'art/topdown/kaya.webp',
      'art/topdown/vfx.json',
      'art/topdown/quarry-gate/ground.webp',
      'art/topdown/props/brazier.png',
      'art/maps/ba_dan_riverside.webp',
      'index.html',
      'art/units/kaya.webp',
      'sw.js',
    ])
      expect(isPrecacheIgnored(path), path).toBe(false);
    expect(PRECACHE_IGNORES).toEqual([]);
  });

  it('precaches every image a map draws (ADR 0104 T7: no map draws oblique art)', () => {
    const urls = (value: unknown): string[] =>
      typeof value === 'string'
        ? [value]
        : Array.isArray(value)
          ? value.flatMap(urls)
          : value && typeof value === 'object'
            ? Object.values(value).flatMap(urls)
            : [];
    for (const map of CONTENT.maps.values()) {
      const ignored = urls({ backdrop: map.backdrop, scene: map.scene })
        .map((url) => url.replace(/^\//, ''))
        .filter((url) => url.startsWith('art/') && isPrecacheIgnored(url));
      expect(ignored, map.id).toEqual([]);
    }
  });

  it('streams the area music rather than precaching it, and precaches every other sound', () => {
    expect(STREAMED).toEqual(['audio/music/**']);
    for (const path of ['audio/music/title.m4a', 'audio/music/quarry.m4a'])
      expect(isPrecacheIgnored(path), path).toBe(true);
    for (const path of ['audio/hit-a.ogg', 'audio/ui-tap.ogg'])
      expect(isPrecacheIgnored(path), path).toBe(false);
    // Workbox would only list the loops if its patterns took an m4a.
    expect(readFileSync('vite.config.ts', 'utf8')).not.toMatch(/globPatterns:[^\n]*m4a/);
  });

  it('is what workbox ignores and what the asset budget leaves out of its total', () => {
    const vite = readFileSync('vite.config.ts', 'utf8');
    expect(vite).toMatch(/globIgnores:\s*\[\.\.\.PRECACHE_IGNORES\]/);
    expect(vite).toContain("from './scripts/precache.mjs'");
    const budget = readFileSync('scripts/check-asset-budget.mjs', 'utf8');
    expect(budget).toContain("from './precache.mjs'");
    expect(budget).toMatch(/isPrecacheIgnored\(/);
    // the family keeps its own budget (its shared part since ADR 0111 §4; boards go by region)
    expect(budget).toMatch(/\['topdown', TOPDOWN_SHARED_BUDGET_MB\]/);
    expect(budget).toMatch(/REGION_BOARDS_BUDGET_MB/);
  });
});
