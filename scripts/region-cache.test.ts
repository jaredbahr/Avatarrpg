/**
 * Offline play for later regions (ADR 0111 §3): the start region is precached, every other region
 * is cached on its first visit and a new build never serves the last one's region files.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REGIONS, START_REGION_ID } from '../src/content/regions';
import type { RegionManifest } from '../src/content/regions';
import {
  laterRegionIgnores,
  laterRegionRuntimeCaching,
  regionCacheCleanupScript,
  regionCacheName,
} from './region-cache.mjs';
import { PRECACHE_IGNORES, globMatches } from './precache.mjs';

const start = REGIONS[0] as RegionManifest;
const marsh: RegionManifest = {
  ...start,
  id: 'salt_marsh',
  scenes: {
    marsh_gate: { url: 'art/topdown/marsh-gate/scene.json' },
    marsh_hut: { url: 'art/topdown/marsh-hut/scene.json' },
  },
};
const regions = [start, marsh];

describe('later regions offline', () => {
  it('is inert while every region is the start region or its neighbour', () => {
    // Saltstep and Emberwatch (RG-02) is Ba Dan valley's neighbour, so it is precached with it.
    const first = REGIONS.find((region) => region.id === START_REGION_ID);
    expect(REGIONS.every((r) => r.id === START_REGION_ID || first?.neighbours.includes(r.id))).toBe(
      true,
    );
    expect(PRECACHE_IGNORES).toEqual([]);
    expect(laterRegionRuntimeCaching(REGIONS, START_REGION_ID, 'b1')).toEqual([]);
  });

  it("precaches the start region's neighbours, which it cannot start without", () => {
    const linked = { ...start, neighbours: [marsh.id] };
    expect(laterRegionIgnores([linked, marsh], start.id)).toEqual([]);
    expect(laterRegionRuntimeCaching([linked, marsh], start.id, 'b1')).toEqual([]);
  });

  it('leaves a later region out of the precache, its chunk and its art folders', () => {
    expect(laterRegionIgnores(regions, start.id)).toEqual([
      'assets/region-saltMarsh-*.js',
      'art/topdown/marsh-gate/**',
      'art/topdown/marsh-hut/**',
    ]);
  });

  it('reads those patterns as globs', () => {
    const [chunk, art] = laterRegionIgnores(regions, start.id) as [string, string];
    expect(globMatches(chunk, 'assets/region-saltMarsh-Ab12.js')).toBe(true);
    expect(globMatches(chunk, 'assets/region-baDanValley-Ab12.js')).toBe(false);
    expect(globMatches(chunk, 'assets/region-saltMarsh-Ab12.js.map')).toBe(false);
    expect(globMatches(art, 'art/topdown/marsh-gate/deep/ground.webp')).toBe(true);
    expect(globMatches(art, 'art/topdown/marsh-gates/ground.webp')).toBe(false);
  });

  it('caches that chunk and art cache-first the first time they are fetched, and nothing else', () => {
    const [entry] = laterRegionRuntimeCaching(regions, start.id, 'b1');
    expect(entry?.handler).toBe('CacheFirst');
    expect(entry?.options.cacheName).toBe(regionCacheName('b1'));
    const matches = (path: string) => entry?.urlPattern.test(`https://x.test/play/${path}`);
    expect(matches('assets/region-saltMarsh-Ab12_x.js')).toBe(true);
    expect(matches('art/topdown/marsh-gate/scene.json')).toBe(true);
    expect(matches('art/topdown/marsh-hut/ground.webp')).toBe(true);
    // the start region (precached), shared art, the boot chunk and music are not this route's
    expect(matches(`assets/region-${'baDanValley'}-Ab12.js`)).toBe(false);
    expect(matches('art/topdown/ba-dan/scene.json')).toBe(false);
    expect(matches('art/topdown/kaya.webp')).toBe(false);
    expect(matches('assets/index-Ab12.js')).toBe(false);
    expect(matches('audio/music/road.m4a')).toBe(false);
  });

  it('drops the region caches of older builds on activate, and only those', () => {
    const deleted: string[] = [];
    let onActivate: ((event: { waitUntil(p: Promise<unknown>): void }) => void) | undefined;
    const scope = {
      addEventListener: (_: string, handler: typeof onActivate) => (onActivate = handler),
    };
    const caches = {
      keys: () =>
        Promise.resolve(['fnt-regions-b0', 'fnt-regions-b1', 'workbox-precache-v2-x', 'other']),
      delete: (key: string) => Promise.resolve(void deleted.push(key)),
    };
    new Function('self', 'caches', regionCacheCleanupScript('b1'))(scope, caches);
    let done: Promise<unknown> = Promise.resolve();
    onActivate?.({ waitUntil: (promise) => (done = promise) });
    return done.then(() => expect(deleted).toEqual(['fnt-regions-b0']));
  });

  it('is wired into the workbox config', () => {
    const vite = readFileSync('vite.config.ts', 'utf8');
    expect(vite).toMatch(/runtimeCaching:\s*laterRegionRuntimeCaching\(/);
    expect(vite).toContain('importScripts');
    expect(vite).toMatch(/globIgnores:\s*\[\.\.\.PRECACHE_IGNORES\]/);
  });
});
