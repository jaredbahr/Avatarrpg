/**
 * Top-down is the default style (ADR 0104 T6), so its family is precached and the game plays
 * offline; the oblique art of the five maps that draw a top-down scene is left for run time
 * (`?style=oblique` only). Workbox is told so, the asset budget counts the precache the same way,
 * and nothing else is left out of it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { TOPDOWN_SCENES } from '../src/content/topdown';
import { PRECACHE_IGNORES, STREAMED, isPrecacheIgnored } from './precache.mjs';

describe('the precache', () => {
  it('precaches the top-down family and leaves only the swapped maps’ oblique art for run time', () => {
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
    for (const path of [
      'art/maps/ba-dan-scene/ground-01.webp',
      'art/maps/forest-g1/forest.webp',
      'art/maps/quarry_gate.webp',
      'art/maps/quarry-surround/rim.webp',
    ])
      expect(isPrecacheIgnored(path), path).toBe(true);
    expect(PRECACHE_IGNORES.every((pattern) => pattern.startsWith('art/maps/'))).toBe(true);
  });

  it('leaves out only art that a top-down map no longer draws', () => {
    const urls = (value: unknown): string[] =>
      typeof value === 'string'
        ? [value]
        : Array.isArray(value)
          ? value.flatMap(urls)
          : value && typeof value === 'object'
            ? Object.values(value).flatMap(urls)
            : [];
    const swapped = new Set<string>();
    for (const map of CONTENT.maps.values()) {
      const ignored = urls({ backdrop: map.backdrop, scene: map.scene })
        .map((url) => url.replace(/^\//, ''))
        .filter((url) => url.startsWith('art/') && isPrecacheIgnored(url));
      // Any map that draws ignored art in the default style must be one the top-down swap replaces.
      if (ignored.length) expect(TOPDOWN_SCENES.has(map.id), `${map.id}: ${ignored[0]}`).toBe(true);
      if (ignored.length) swapped.add(map.id);
    }
    expect([...swapped].sort()).toEqual([...TOPDOWN_SCENES.keys()].sort());
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
    // the family keeps its own budget
    expect(budget).toMatch(/\['topdown', TOPDOWN_BUDGET_MB\]/);
  });
});
