/**
 * The top-down presentation swap (ADR 0104, T3) is presentation only: a registered map takes the
 * top-down projection and scene and drops its oblique art, and every rules field stays the very
 * same object, so the rules and saves never tell the two styles apart.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MapDef } from '../core/types';
import { TOPDOWN_FIXTURE_SCENE } from '../render/topdown.fixture';
import { CONTENT } from './index';
import {
  TOPDOWN_SCENES,
  loadTopDownPresentations,
  topDownMap,
  withTopDownMaps,
  type TopDownPresentation,
} from './topdown';

/** The shipped scenes, read as the browser fetches them. */
const fromDisk = (url: string): Promise<unknown> =>
  Promise.resolve(JSON.parse(readFileSync(`public/${url}`, 'utf8')) as unknown);

/** The fields only the renderers and the camera read. */
const PRESENTATION_FIELDS = new Set([
  'projection',
  'scene',
  'backdrop',
  'cameraPaint',
  'cameraCentreMargin',
]);

const PRESENTATION: TopDownPresentation = { projection: 'topdown', scene: TOPDOWN_FIXTURE_SCENE };

/** Ba Dan and the Forest Road: both oblique, painted, with a scene and a centre margin. */
const IDS = ['ba_dan_village', 'forest_road'] as const;

function registered(
  extra: Partial<TopDownPresentation> = {},
): ReadonlyMap<string, TopDownPresentation> {
  return new Map(IDS.map((id) => [id, { ...PRESENTATION, ...extra }]));
}

function map(id: string, content = CONTENT): MapDef {
  const found = content.maps.get(id);
  if (!found) throw new Error(`no map ${id}`);
  return found;
}

describe('withTopDownMaps', () => {
  it('registers Ba Dan (T3) and nothing else yet, its scene an asset', async () => {
    expect([...TOPDOWN_SCENES.keys()]).toEqual(['ba_dan_village']);
    const presentations = await loadTopDownPresentations(fromDisk);
    const swapped = withTopDownMaps(CONTENT, presentations);
    const badan = map('ba_dan_village', swapped);
    expect(badan.projection).toBe('topdown');
    expect(badan.cameraCentreMargin).toBe(1);
    expect(badan.scene?.ground[0]?.url).toBe('art/topdown/ba-dan/ground.webp');
    expect(badan.scene?.scenery.length).toBeGreaterThan(50);
    expect(map('forest_road', swapped)).toBe(map('forest_road'));
  });

  it('refuses a scene that is not one', async () => {
    await expect(loadTopDownPresentations(() => Promise.resolve({ nope: 1 }))).rejects.toThrow(
      'is not a map scene',
    );
  });

  it('is the identity for an id the index does not hold', () => {
    const presentations = new Map([['no_such_map', PRESENTATION]]);
    expect(withTopDownMaps(CONTENT, presentations)).toBe(CONTENT);
  });

  it('keeps every rules field of a registered map by reference', () => {
    const swapped = withTopDownMaps(CONTENT, registered());
    for (const id of IDS) {
      const before = map(id);
      const after = map(id, swapped);
      expect(after).not.toBe(before);
      const rulesKeys = Object.keys(before).filter((key) => !PRESENTATION_FIELDS.has(key));
      expect(rulesKeys.length).toBeGreaterThan(8);
      for (const key of rulesKeys) {
        const k = key as keyof MapDef;
        expect(after[k], `${id}.${key}`).toBe(before[k]);
      }
      // Nothing new appears beside the rules but the presentation.
      for (const key of Object.keys(after))
        if (!PRESENTATION_FIELDS.has(key)) expect(rulesKeys).toContain(key);
      // The rows, legend, npcs, exits and edges are those very objects, deep-equal included.
      expect(after.rows).toBe(before.rows);
      expect(after.legend).toBe(before.legend);
      expect(after.npcs).toBe(before.npcs);
      expect(after.exits).toBe(before.exits);
      expect(after.edges).toBe(before.edges);
    }
  });

  it('changes only the presentation: the top-down projection and scene, no oblique art', () => {
    const swapped = withTopDownMaps(CONTENT, registered());
    for (const id of IDS) {
      const before = map(id);
      const after = map(id, swapped);
      expect(before.projection).toBe('oblique');
      expect(before.backdrop).toBeDefined();
      expect(after.projection).toBe('topdown');
      expect(after.scene).toBe(TOPDOWN_FIXTURE_SCENE);
      expect('backdrop' in after).toBe(false);
      expect('cameraPaint' in after).toBe(false);
      // The map's own centre margin stays unless the presentation sets one.
      expect(after.cameraCentreMargin).toBe(before.cameraCentreMargin);
    }
    expect(map('forest_road').cameraPaint).toBeDefined();
    const margined = withTopDownMaps(CONTENT, registered({ cameraCentreMargin: 0.5 }));
    for (const id of IDS) expect(map(id, margined).cameraCentreMargin).toBe(0.5);
  });

  it('leaves every unregistered map, and the rest of the index, the same object', () => {
    const swapped = withTopDownMaps(CONTENT, registered());
    expect(swapped).not.toBe(CONTENT);
    expect(swapped.maps.size).toBe(CONTENT.maps.size);
    for (const [id, before] of CONTENT.maps)
      if (!(IDS as readonly string[]).includes(id)) expect(swapped.maps.get(id)).toBe(before);
    for (const key of Object.keys(CONTENT) as (keyof typeof CONTENT)[])
      if (key !== 'maps') expect(swapped[key], key).toBe(CONTENT[key]);
    // The shipped index is never touched.
    expect(map('ba_dan_village').projection).toBe('oblique');
  });

  it('swaps a single map the same way', () => {
    const before = map('ba_dan_village');
    const after = topDownMap(before, PRESENTATION);
    expect(after.rows).toBe(before.rows);
    expect(after.projection).toBe('topdown');
    expect(before.projection).toBe('oblique');
  });
});
