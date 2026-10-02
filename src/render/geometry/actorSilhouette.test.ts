import { describe, expect, it } from 'vitest';
import type { Grid, TerrainId, Tile } from '../../core/types';
import {
  GRASS_SHADOW_DENSITY,
  HP_CAP_MIN_PX,
  actorHeadroom,
  actorHealthBar,
  actorReticleX,
  actorSilhouetteGeometry,
  actorShadowDensity,
  healthBarCap,
} from './actorSilhouette';
import { FOOT_LINE, headroomFromPixels } from '../sheets/bake';

describe('upright actor headroom', () => {
  it('uses measured frame headroom and the matching fallback footprint box', () => {
    expect(actorHeadroom(0.62, 2)).toBe(0.62);
    expect(actorHeadroom(undefined, 1)).toBe(0);
    expect(actorHeadroom(undefined, 2)).toBe(FOOT_LINE);
  });
});

describe('shared actor silhouette geometry', () => {
  it.each([
    ['one tile', 96],
    ['two tiles', 192],
  ] as const)('keeps the scale-1 %s reticle at the legacy box edge', (_kind, width) => {
    const box = { x: 12, y: 100, size: 96, width };
    expect(actorReticleX(box, 1)).toBe(box.x + width + box.size * 0.12);
  });

  it('places a scaled reticle just beyond the silhouette right edge', () => {
    const box = { x: 12, y: 100, size: 96, width: 192 };
    const scale = 2;
    expect(actorReticleX(box, scale)).toBe(
      box.x + box.width / 2 + (box.width * scale) / 2 + box.size * 0.12,
    );
  });

  it('keeps gate-off anchors equal to the legacy one-tile formulas at scaled size', () => {
    const box = { x: 12, y: 100, size: 96 };
    const scale = 1.25;
    const geometry = actorSilhouetteGeometry(box, 1, null, scale);
    const legacy = actorHealthBar(box.x, box.y, box.size, box.size, scale, 0);
    expect(geometry.bar).toEqual(legacy);
    expect(geometry.badgeY).toBe(box.y + box.size * 0.97);
    expect(geometry.reticleY).toBe(box.y - box.size * 0.04);
  });

  it.each([
    ['sheet frame', 0.62, 0.62],
    ['baked painter', 0.37, 0.37],
    ['raw fallback', null, FOOT_LINE],
  ] as const)(
    'uses %s headroom for the gate-on 2x2 anchors at scaled size',
    (_kind, frameHeadroom, expectedHeadroom) => {
      const box = { x: 12, y: 100, size: 96 };
      const scale = 1.25;
      const geometry = actorSilhouetteGeometry(box, 2, frameHeadroom, scale);
      const legacy = actorHealthBar(box.x, box.y, box.size, box.size, scale, expectedHeadroom);
      const radius = Math.max(4, box.size * 0.09);
      expect(geometry.bar).toEqual(legacy);
      expect(geometry.badgeY).toBe(legacy.y - radius * 1.4);
      expect(geometry.reticleY).toBe(legacy.silhouetteTop - box.size * 0.04);
      if (frameHeadroom === null) {
        const rawTop = box.y + FOOT_LINE * box.size - FOOT_LINE * 2 * box.size * scale;
        expect(geometry.reticleY).toBeCloseTo(rawTop - box.size * 0.04, 8);
      }
    },
  );
});

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

  it('samples both rows of the shipped 2x2 shadow and retains explicit legacy coverage', () => {
    const square: Grid = {
      width: 2,
      height: 2,
      tiles: [tile('road'), tile('road'), tile('road'), tile('grass')],
    };
    expect(actorShadowDensity(square, { x: 0, y: 0 }, false, 2, false)).toBe(0);
    expect(actorShadowDensity(square, { x: 0, y: 0 }, false, 2)).toBe(GRASS_SHADOW_DENSITY);
    expect(actorShadowDensity(square, { x: 0, y: 0 }, false, 2, true)).toBe(GRASS_SHADOW_DENSITY);
  });
});

describe('health bar cap', () => {
  const extent = (points: number[]) => {
    const xs = points.filter((_, i) => i % 2 === 0);
    const ys = points.filter((_, i) => i % 2 === 1);
    return {
      left: Math.min(...xs),
      right: Math.max(...xs),
      top: Math.min(...ys),
      bottom: Math.max(...ys),
    };
  };

  it('draws nothing for the party', () => {
    expect(healthBarCap({ x: 10, y: 20, height: 4 }, 'none', 0)).toEqual([]);
  });

  it('keeps its minimum height however thin the bar, centred on it', () => {
    const bar = { x: 20, y: 20, height: 4 };
    for (const cap of ['diamond', 'spike'] as const) {
      const box = extent(healthBarCap(bar, cap, 0));
      expect(box.right).toBeLessThanOrEqual(bar.x - 1);
      expect(box.bottom - box.top).toBe(HP_CAP_MIN_PX);
      expect((box.top + box.bottom) / 2).toBe(bar.y + bar.height / 2);
    }
    expect(healthBarCap(bar, 'spike', 0)).toHaveLength(6);
    expect(healthBarCap(bar, 'diamond', 0)).toHaveLength(8);
  });

  it('grows past the minimum with a thick bar, to the framed height', () => {
    const bar = { x: 40, y: 20, height: 12 };
    const box = extent(healthBarCap(bar, 'spike', 0));
    expect(box.top).toBe(bar.y - 1);
    expect(box.bottom).toBe(bar.y + bar.height + 1);
  });

  it('measures the minimum in CSS px, whatever the world scale', () => {
    // Pixi draws in world units: at camera scale 1.5, one CSS px is 2/3 of one.
    const scale = 1.5;
    const bar = { x: 20, y: 20, height: 3 };
    const box = extent(healthBarCap(bar, 'diamond', 0, 1 / scale));
    expect((box.bottom - box.top) * scale).toBeCloseTo(HP_CAP_MIN_PX);
  });

  it('stays over its own figure, narrowing on the smallest board', () => {
    // The fitted board's floor: a 40px tile, whose bar leaves ~5.6px either side.
    for (const tile of [40, 64, 96]) {
      const bar = actorHealthBar(0, 100, tile, tile, 1);
      for (const cap of ['diamond', 'spike'] as const) {
        const box = extent(healthBarCap(bar, cap, 0));
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(bar.x - 1);
        expect(box.right - box.left).toBeGreaterThan(3);
      }
    }
  });
});
