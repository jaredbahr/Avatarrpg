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

describe('figure scale on oblique boards (ADR 0094 and its amendment)', () => {
  it('draws figures at 1.25, the adult height the world was built round', () => {
    // The owner, 2026-10-28: "1.25× now, redraw later".
    expect(OBLIQUE_FIGURE_SCALE).toBe(1.25);
    expect(partyScale('oblique')).toBe(1.25);
    // Off the oblique boards nothing changes.
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
    'smooths %s at 1.25 by the owner’s choice, where 1 would sample it nearest',
    (key) => {
      const entry = ASSETS[key];
      if (entry?.kind !== 'sheet') throw new Error(`${key} is not a sheet`);
      // 1.25 puts 1.25, 2.5, 3.75 or 5 device px on an art px: every zoom but N = 4
      // resamples, accepted until the native redraw at about 74 px (ADR 0094's amendment).
      expect(obliqueScale(key)).toBe(1.25);
      for (const [n, mode] of [
        [1, 'linear'],
        [2, 'linear'],
        [3, 'linear'],
        [4, 'nearest'],
      ] as const) {
        expect(
          scaleModeFor(devicePerArtPx(n, entry.pixelsPerTile, obliqueScale(key))),
          `N=${n}`,
        ).toBe(mode);
      }
      // At 1, one art px a world px, every integer zoom samples nearest: the redraw's target grain.
      for (const n of [1, 2, 3, 4])
        expect(scaleModeFor(devicePerArtPx(n, entry.pixelsPerTile, 1)), `N=${n} at 1`).toBe(
          'nearest',
        );
    },
  );

  it('keeps every other adult level with the G1 adults', () => {
    // Sized to stand as tall as a G figure at 1.25, so at 1.25 they draw at their own size.
    expect(OBLIQUE_LEGACY_ADULT).toBe(OBLIQUE_FIGURE_SCALE / 1.25);
    expect(OBLIQUE_LEGACY_ADULT).toBeCloseTo(1, 12);
    expect(enemyScale('unit.enemy.crossbow', 1, 'oblique')).toBeCloseTo(1.23, 12);
    expect(enemyScale('unit.enemy.merc', 1, 'oblique')).toBeCloseTo(1, 12);
    expect(npcPresentationScale('npc.hanru', 'oblique')).toBeCloseTo(1.4, 12);
    // Off the oblique boards nothing changes.
    expect(enemyScale('unit.enemy.crossbow', 1, undefined)).toBe(1.23);
    // The Driller is sized by its 2x2 footprint, not by an adult's height.
    expect(enemyScale('unit.enemy.driller', 1, 'oblique')).toBe(2);
  });
});
