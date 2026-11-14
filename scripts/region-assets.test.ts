import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { regionAssets } from './region-assets';

describe('region assets (ADR 0111 §4)', () => {
  it('names folders and files that exist, each in one region', () => {
    const { regions, sharedMusic } = regionAssets();
    const seen = new Set<string>();
    for (const region of regions) {
      for (const path of [...region.artDirs, ...region.musicFiles]) {
        expect(existsSync(join('public', path)), path).toBe(true);
        expect(seen.has(path), `${path} in two regions`).toBe(false);
        seen.add(path);
      }
    }
    for (const path of sharedMusic) expect(seen.has(path), path).toBe(false);
  });

  it("gives the demo region its five boards and its three area tracks; the title's is shared", () => {
    const { regions, sharedMusic } = regionAssets();
    expect(regions.map((region) => region.id)).toEqual(['ba_dan_valley']);
    expect(regions[0]?.artDirs).toEqual([
      'art/topdown/ba-dan/',
      'art/topdown/forest-road/',
      'art/topdown/quarry-gate/',
      'art/topdown/cutting/',
      'art/topdown/quarry-floor/',
    ]);
    expect(regions[0]?.musicFiles).toEqual([
      'audio/music/ba-dan.m4a',
      'audio/music/road.m4a',
      'audio/music/quarry.m4a',
    ]);
    expect(sharedMusic).toEqual(['audio/music/title.m4a']);
  });
});
