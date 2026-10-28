import { describe, expect, it } from 'vitest';
import { ASSETS } from '../../content/assets/manifest';
import { scaleModeFor } from '../../render/pixelSampling';
import { npcPresentationScale } from '../scenes/exploreMarkerScale';
import { OBLIQUE_FIGURE_SCALE, OBLIQUE_LEGACY_ADULT, enemyScale, partyScale } from './actorScale';

/** World px a ground tile spans; integer zoom puts N device px on each (ADR 0088). */
const WORLD_TILE_PX = 64;

/** The scale the game draws a figure at on an oblique board, by who it is. */
function obliqueScale(key: string): number {
  if (key.startsWith('npc.')) return npcPresentationScale(key, 'oblique');
  if (key.startsWith('unit.enemy.')) return enemyScale(key, 1, 'oblique');
  return partyScale('oblique');
}

/**
 * Device px per art px for a sheet at zoom N, as both backends compute it: the
 * tile's device px over the sheet's px a tile, times the figure's scale
 * (`canvas2d` draws `frame.w / pixelsPerTile * tile` at `scale`; `pixi` asks
 * `scaleModeFor(sprite.scale * camera scale * dpr)`).
 */
const devicePerArtPx = (n: number, pixelsPerTile: number, scale: number) =>
  ((WORLD_TILE_PX * n) / pixelsPerTile) * scale;

const G1_SHEETS = Object.entries(ASSETS).filter(
  ([, entry]) =>
    entry.kind === 'sheet' &&
    entry.pixelsPerTile === WORLD_TILE_PX &&
    entry.locomotion?.headings === 8,
);

describe('figure scale on oblique boards (ADR 0094)', () => {
  it('draws figures at the world’s grain', () => {
    expect(OBLIQUE_FIGURE_SCALE).toBe(1);
    expect(partyScale('oblique')).toBe(1);
    expect(partyScale(undefined)).toBe(1);
  });

  it('covers the party, the Ba Dan residents and the forest bandits', () => {
    expect(G1_SHEETS.map(([key]) => key).sort()).toEqual(
      [
        'npc.dorin',
        'npc.elder',
        'npc.guard',
        'npc.household',
        'npc.kid',
        'npc.shopkeeper',
        'unit.earth.bo',
        'unit.enemy.bruiser',
        'unit.enemy.slinger',
        'unit.enemy.thug',
        'unit.fire.kaya',
        'unit.water.sura',
      ].sort(),
    );
  });

  it.each(G1_SHEETS.map(([key]) => key))(
    'samples %s nearest at every integer zoom, and did not at 1.25',
    (key) => {
      const entry = ASSETS[key];
      if (entry?.kind !== 'sheet') throw new Error(`${key} is not a sheet`);
      for (const n of [1, 2, 3, 4]) {
        expect(
          scaleModeFor(devicePerArtPx(n, entry.pixelsPerTile, obliqueScale(key))),
          `N=${n}`,
        ).toBe('nearest');
      }
      // The old 1.25 put 2.5 device px on an art px at N = 2: resampled soft.
      expect(scaleModeFor(devicePerArtPx(2, entry.pixelsPerTile, 1.25))).toBe('linear');
    },
  );

  it('keeps every other adult level with the G1 adults', () => {
    // Sized to stand as tall as a G figure at the old 1.25, so scaled by 1 / 1.25 with them.
    expect(OBLIQUE_LEGACY_ADULT).toBeCloseTo(0.8, 12);
    expect(enemyScale('unit.enemy.crossbow', 1, 'oblique')).toBeCloseTo(1.23 * 0.8, 12);
    expect(enemyScale('unit.enemy.merc', 1, 'oblique')).toBeCloseTo(0.8, 12);
    expect(npcPresentationScale('npc.hanru', 'oblique')).toBeCloseTo(1.4 * 0.8, 12);
    // Off the oblique boards nothing changes.
    expect(enemyScale('unit.enemy.crossbow', 1, undefined)).toBe(1.23);
    // The Driller is sized by its 2x2 footprint, not by an adult's height.
    expect(enemyScale('unit.enemy.driller', 1, 'oblique')).toBe(2);
  });
});
