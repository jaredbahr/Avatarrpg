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

  it("gives the demo region its four baked boards and its three area tracks; the title's is shared; RG-02 its four boards", () => {
    const { regions, sharedMusic } = regionAssets();
    expect(regions.map((region) => region.id)).toEqual(['ba_dan_valley', 'saltstep_emberwatch']);
    // RG-02, the pipeline trial: its four boards, and no area track yet.
    expect(regions[1]?.artDirs).toEqual([
      'art/topdown/saltstep-market/',
      'art/topdown/saltstep-pontoon/',
      'art/topdown/emberwatch-parade/',
      'art/topdown/emberwatch-power-yard/',
    ]);
    expect(regions[1]?.musicFiles).toEqual([]);
    // Ba Dan is a grey blockout with no scene or plates (`docs/places/ba_dan_village.md`), so its folder is not shipped.
    expect(regions[0]?.artDirs).toEqual([
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
