import { describe, expect, it } from 'vitest';
import type { Grid, TerrainId, Tile } from '../../core/types';
import {
  GRASS_SHADOW_DENSITY,
  actorHealthBar,
  actorShadowDensity,
  healthBarCap,
} from './actorSilhouette';
import { FOOT_LINE, headroomFromPixels } from '../sheets/bake';

describe('upright actor health bar', () => {
  it('clears the actual opaque silhouette through scale, pose and elevation changes', () => {
    const pixelsPerTile = 128;
    const frameHeight = 192;
    const topRow = 20;
    const anchorY = 0.9;
    const pixels = new Uint8ClampedArray(128 * frameHeight * 4);
    pixels[(topRow * 128 + 64) * 4 + 3] = 255;
    const headroom = headroomFromPixels(pixels, 128, frameHeight, pixelsPerTile, anchorY);
    for (const tile of [48, 64, 96, 144]) {
      for (const scale of [0.92, 1, 1.25, 1.25 * 1.08]) {
        for (const poseY of [-0.1, 0, 0.04]) {
          const y = 300 + (poseY - 2 * 0.06) * tile;
          const top =
            y +
            FOOT_LINE * tile -
            ((anchorY * frameHeight - topRow) / pixelsPerTile) * tile * scale;
          const bar = actorHealthBar(100, y, tile, tile, scale, headroom);
          expect(bar.silhouetteTop).toBeCloseTo(top, 8);
          expect(bar.y + bar.height + 1).toBeLessThan(top);
          expect(top - (bar.y + bar.height + 1)).toBeCloseTo(Math.max(1.4, tile * 0.028), 8);
        }
      }
    }
  });

  it('keeps the two-cell boss bar centered and clear without treating width as height', () => {
    const solo = actorHealthBar(50, 200, 96, 96, 1, 0.5);
    const boss = actorHealthBar(50, 200, 192, 96, 1, 0.5);
    expect(boss.x + boss.width / 2).toBe(146);
    expect(boss.width).toBe(solo.width * 2);
    expect(boss.y).toBe(solo.y);
  });

  it('clears scaled painter fallback bounds and moves exactly with the upright pose', () => {
    const base = actorHealthBar(0, 100, 96, 96, 1.25);
    const shifted = actorHealthBar(12, 83, 96, 96, 1.25);
    const fallbackTop = 100 + FOOT_LINE * 96 * (1 - 1.25);
    expect(base.y + base.height + 1).toBeLessThan(fallbackTop);
    expect(shifted.y - base.y).toBe(-17);
    expect(shifted.x - base.x).toBe(12);
  });
});

describe('upright actor contact shadow', () => {
  const tile = (terrain: TerrainId): Tile => ({
    terrain,
    elevation: 0,
    blocked: false,
    blocksSight: false,
    cover: false,
    surface: null,
  });
  const grid: Grid = { width: 2, height: 1, tiles: [tile('grass'), tile('road')] };

  it('is denser on grass, for every figure, and unchanged elsewhere', () => {
    expect(actorShadowDensity(grid, { x: 0, y: 0 }, false)).toBe(GRASS_SHADOW_DENSITY);
    expect(actorShadowDensity(grid, { x: 0, y: 0 }, true)).toBe(GRASS_SHADOW_DENSITY);
    expect(GRASS_SHADOW_DENSITY).toBeGreaterThan(1);
    // Off grass a combat figure keeps no pool and an explore figure the standard one.
    expect(actorShadowDensity(grid, { x: 1, y: 0 }, false)).toBe(0);
    expect(actorShadowDensity(grid, { x: 1, y: 0 }, true)).toBe(1);
    expect(actorShadowDensity(grid, { x: 5, y: 0 }, true)).toBe(1);
  });
});

describe('contact shadow sampling', () => {
  const tile = (terrain: TerrainId): Tile => ({
    terrain,
    elevation: 0,
    blocked: false,
    blocksSight: false,
    cover: false,
    surface: null,
  });
  const grid: Grid = { width: 3, height: 1, tiles: [tile('road'), tile('road'), tile('grass')] };

  it('reads the tile under a walking figure, not the one it set out from', () => {
    expect(actorShadowDensity(grid, { x: 1.4, y: 0 }, false)).toBe(0);
    expect(actorShadowDensity(grid, { x: 1.6, y: 0 }, false)).toBe(GRASS_SHADOW_DENSITY);
  });

  it('seats a two-wide figure on grass under either half', () => {
    expect(actorShadowDensity(grid, { x: 0, y: 0 }, false, 2)).toBe(0);
    expect(actorShadowDensity(grid, { x: 1, y: 0 }, false, 2)).toBe(GRASS_SHADOW_DENSITY);
    expect(actorShadowDensity(grid, { x: 2, y: 0 }, true, 2)).toBe(GRASS_SHADOW_DENSITY);
  });
});

describe('health bar cap', () => {
  const bar = { x: 10, y: 20, height: 4 };

  it('draws nothing for the party', () => {
    expect(healthBarCap(bar, 'none')).toEqual([]);
  });

  it('butts a cap against the frame, as tall as the framed bar', () => {
    for (const cap of ['diamond', 'spike'] as const) {
      const points = healthBarCap(bar, cap);
      const xs = points.filter((_, i) => i % 2 === 0);
      const ys = points.filter((_, i) => i % 2 === 1);
      expect(Math.max(...xs)).toBeLessThanOrEqual(bar.x - 1);
      expect(Math.min(...ys)).toBe(bar.y - 1);
      expect(Math.max(...ys)).toBe(bar.y + bar.height + 1);
    }
    expect(healthBarCap(bar, 'spike')).toHaveLength(6);
    expect(healthBarCap(bar, 'diamond')).toHaveLength(8);
  });
});
