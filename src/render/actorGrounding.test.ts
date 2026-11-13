/**
 * The grounding rule of ADR 0093: everything a backend draws standing on the
 * orthographic board — every figure and every prop — gets a contact shadow under its
 * feet or base and a cast down-right along its scene's key, hard-edged on the
 * world-pixel grid, on both backends. A figure's is a calm pool under its feet
 * with a short cast along the key, in the painting's own tone where the scene
 * names one, and it reads nothing of the figure's art, so it is the same shape
 * whatever its legs are doing (owner, 2026-10-28: "the shadows make them look
 * off").
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALL_MAPS } from '../content/index';
import {
  CONTACT_LINE,
  SHADOW_LEVEL_SLOTS,
  FIGURE_SHADOW,
  actorGrounding,
  figureCastReach,
  shadowGrid,
  shadowLevels,
} from './lighting';

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

describe("a figure's shadow is a calm pool (ADR 0093's figure amendment)", () => {
  const boards = ALL_MAPS.filter((map) => map.projection !== 'topdown');

  for (const map of boards)
    it(`keeps a figure's cast on ${map.id} to a quarter of its height or less`, () => {
      const reach = figureCastReach(64, actorGrounding(map.scene).castKey);
      expect(Math.hypot(reach.x, reach.y)).toBeLessThanOrEqual(
        0.25 * FIGURE_SHADOW.height * 64 + 1e-9,
      );
    });

  for (const file of ['./backends/canvas2d.ts', './backends/pixi.ts']) {
    const source = read(file);
    it(`${file} grounds every figure and resident on its pool, never its silhouette`, () => {
      // One definition and a call each for residents and units.
      expect(source.match(/projectFigureShadow\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
      // Nothing of the drawn frame reaches a figure's shadow: no steady cel, no sole band.
      for (const gone of ['castFrame(', 'steadyCaster(', 'contactBandRows(', 'projectContactMask('])
        expect(source).not.toContain(gone);
    });
    it(`${file} stands a figure on the feet blob on the top-down board only`, () => {
      // ADR 0104, T4: Imagination's feetBlob in place of the swept pool, at its own level.
      expect(source).toContain("this.topdownFigures = camera.projection === 'topdown';");
      expect(source).toMatch(/if \(this\.topdownFigures\) \{[^}]*feetBlobArt\(/);
      expect(source).toContain('topdownFeetLevel(this.pavedCells, at)');
    });
  }
});

describe('the shadow mask is on the world-pixel grid', () => {
  for (const [scale, offsetX, offsetY] of [
    [2, 852, 347],
    [3, 0, 0],
    [3, -41, 7],
    [2.5, 13.25, -6.5],
  ] as const) {
    it(`puts texel edges on world-pixel edges at scale ${scale}, offset ${offsetX},${offsetY}`, () => {
      const viewport = { width: 1368, height: 715 };
      const grid = shadowGrid(viewport, scale, offsetX, offsetY);
      expect(grid.texel).toBe(scale);
      // Texel 0 starts at or before the viewport, less than one texel out.
      for (const origin of [grid.originX, grid.originY]) {
        expect(origin).toBeLessThanOrEqual(0);
        expect(origin).toBeGreaterThan(-scale);
      }
      // World pixel k's edge is at k * scale - offset; the texel edges land on them.
      const onGrid = (origin: number, offset: number) => {
        const k = (origin + offset) / scale;
        expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-9);
      };
      onGrid(grid.originX, offsetX);
      onGrid(grid.originY, offsetY);
      // And the mask still covers the whole viewport.
      expect(grid.originX + grid.width * scale).toBeGreaterThanOrEqual(viewport.width);
      expect(grid.originY + grid.height * scale).toBeGreaterThanOrEqual(viewport.height);
    });
  }
});

describe('the WebGL composite snaps each texel to a caster level', () => {
  it('keeps every distinct level, strongest first, padded with 0', () => {
    expect(shadowLevels([0.625, 1, 0.625, 0.5])).toEqual([1, 0.625, 0.5, 0, 0, 0, 0, 0]);
    expect(shadowLevels([])).toHaveLength(SHADOW_LEVEL_SLOTS);
  });

  it('folds too many levels onto eighths, so a crowd of fades still fits', () => {
    const levels = shadowLevels(Array.from({ length: 40 }, (_, i) => (i + 1) / 40));
    expect(levels).toHaveLength(SHADOW_LEVEL_SLOTS);
    for (const level of levels) expect((level * 8) % 1).toBeCloseTo(0, 6);
  });
});

describe('both backends draw the same grounding', () => {
  for (const file of ['./backends/canvas2d.ts', './backends/pixi.ts']) {
    const source = read(file);
    it(`${file} draws the mask on the world-pixel grid`, () => {
      expect(source).toContain('shadowGrid(');
    });
    it(`${file} casts figures and props along the scene key`, () => {
      expect(source).toContain('figureShadowArt(TILE * scale, this.grounding.castKey');
      expect(source).toMatch(/groundedCastArt\([^)]*this\.grounding\.castKey/);
    });
    it(`${file} seats every prop on its contact line and casts it from its own ground`, () => {
      expect(source).toContain('projectContactLine(');
      expect(source).toContain('CONTACT_LINE');
      expect(source).toContain('groundedCastArt(');
    });
  }

  it('lays the contact line deep enough that a whole world pixel shows under the outline', () => {
    expect(CONTACT_LINE).toBe(2);
  });
});
