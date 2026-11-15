import { describe, expect, it } from 'vitest';
import { MAX_LEVEL } from '../../core/rules/leveling';
import { REGIONS } from './index';
import { REGION_CONTENT } from './content';
import { levelBandProblems, placeholderBands } from './bands';
import type { RegionContent, RegionManifest } from './types';

describe('region level bands (ADR 0011, #784)', () => {
  it('holds every shipped region to a real band that contains its fights', () => {
    expect(levelBandProblems(REGIONS, REGION_CONTENT, MAX_LEVEL)).toEqual([]);
  });

  it('lists the bands still waiting for the owner (#784)', () => {
    // When Jared answers #784, set the approved numbers, clear `placeholder` and shrink this list.
    expect(placeholderBands(REGIONS)).toEqual(['ba_dan_valley']);
  });

  const region = (minLevel: number, maxLevel: number): RegionManifest =>
    ({
      id: 'probe',
      levelBand: { minLevel, maxLevel, placeholder: false },
    }) as unknown as RegionManifest;
  const content = (...levels: number[]): RegionContent =>
    ({
      id: 'probe',
      encounters: levels.map((expectedLevel, index) => ({ id: `fight_${index}`, expectedLevel })),
    }) as unknown as RegionContent;

  it('rejects a band that is not an upward range of whole levels inside the level cap', () => {
    expect(levelBandProblems([region(3, 2)], [content()], MAX_LEVEL)).toEqual([
      `region "probe" band 3–2 must run upward within 1–${MAX_LEVEL}`,
    ]);
    expect(levelBandProblems([region(0, 2)], [content()], MAX_LEVEL)).toHaveLength(1);
    expect(levelBandProblems([region(1, MAX_LEVEL + 1)], [content()], MAX_LEVEL)).toHaveLength(1);
    expect(levelBandProblems([region(1.5, 2)], [content()], MAX_LEVEL)).toEqual([
      'region "probe" band 1.5–2 must be whole levels',
    ]);
  });

  it('rejects a fight tuned for a level outside its region band', () => {
    expect(levelBandProblems([region(3, 4)], [content(3, 4, 5, 2)], MAX_LEVEL)).toEqual([
      'encounter "fight_2" expects level 5, outside region "probe" band 3–4',
      'encounter "fight_3" expects level 2, outside region "probe" band 3–4',
    ]);
  });
});
