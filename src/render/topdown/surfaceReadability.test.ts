import { describe, expect, it } from 'vitest';
import { buildGrid } from '../../core/rules/grid';
import type { SurfaceId } from '../../core/types';
import { TERRAIN_STYLES } from '../palettes';
import type { RgbaImage } from '../shadow/hardShadowMask';
import { TOPDOWN_FIXTURE } from '../topdown.fixture';
import { CS } from './organic';
import { TopdownSurfaces } from './surfaces';
import type { SurfaceArt } from './surfaces';

type Rgb = readonly [number, number, number];
type Pixel = { x: number; y: number; rgb: Rgb; alpha: number };

// The quarry prototype paints its void and its lighter pit grain with these colours
// (prototypes/topdown/src/b3/world_quarry.js). Oil must read above both, not as another hole.
const VOID: Rgb = [27, 20, 23];
const PIT: Rgb = [40, 30, 32];
const rgb = (hex: string): Rgb => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];
const luminance = ([r, g, b]: Rgb): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const mean = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

function bake(surface: SurfaceId): SurfaceArt {
  const empty = buildGrid({
    ...TOPDOWN_FIXTURE,
    width: 9,
    height: 7,
    rows: Array.from({ length: 7 }, () => '.'.repeat(9)),
    legend: { '.': { terrain: 'stone' } },
  });
  const grid = {
    ...empty,
    tiles: empty.tiles.map((tile, index) => {
      const x = index % empty.width;
      const y = Math.floor(index / empty.width);
      return x >= 2 && x <= 5 && y >= 2 && y <= 4
        ? { ...tile, surface: { id: surface, duration: 3, spread: 0 } }
        : tile;
    }),
  };
  const surfaces = new TopdownSurfaces(grid);
  surfaces.update(grid);
  return surfaces.art;
}

const painted = (image: RgbaImage): Pixel[] => {
  const pixels: Pixel[] = [];
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      const alpha = image.data[i + 3] ?? 0;
      if (alpha)
        pixels.push({
          x,
          y,
          rgb: [image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0],
          alpha,
        });
    }
  return pixels;
};

function on(image: RgbaImage, x: number, y: number): boolean {
  return (
    x >= 0 &&
    x < image.width &&
    y >= 0 &&
    y < image.height &&
    (image.data[(y * image.width + x) * 4 + 3] ?? 0) > 0
  );
}

function pixelLight(image: RgbaImage, x: number, y: number): number {
  const i = (y * image.width + x) * 4;
  return luminance([image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0]);
}

const inside = (image: RgbaImage, pixel: Pixel): boolean => {
  for (let d = 1; d <= 8; d++)
    if (
      !on(image, pixel.x - d, pixel.y) ||
      !on(image, pixel.x + d, pixel.y) ||
      !on(image, pixel.x, pixel.y - d) ||
      !on(image, pixel.x, pixel.y + d)
    )
      return false;
  return true;
};

describe('top-down oil and char readability', () => {
  it('keeps the opaque brown-olive oil body visibly above pits and below paving', () => {
    const image = bake('oil').layer;
    const pixels = painted(image);
    const body = pixels.filter((pixel) => inside(image, pixel));
    expect(body.length).toBeGreaterThan(1000);
    const light = mean(body.map((pixel) => luminance(pixel.rgb)));
    expect(light).toBeGreaterThan(Math.max(luminance(VOID), luminance(PIT)) + 12);
    expect(light).toBeLessThan(luminance(rgb(TERRAIN_STYLES.stone.detail)));
    expect(pixels.every((pixel) => pixel.alpha === 255)).toBe(true);
    // A warm, restrained material: no cyan or violet glints left as static stickers.
    expect(pixels.every(({ rgb: [r, g, b] }) => r >= g && g >= b)).toBe(true);
    expect(mean(body.map(({ rgb: [, g, b] }) => g - b))).toBeGreaterThan(6);
  });

  it('puts a lighter one-pixel rim on the upper-left edge, not around the whole pool', () => {
    const image = bake('oil').layer;
    const pixels = painted(image);
    const upper = pixels.filter(
      ({ x, y }) =>
        (!on(image, x - 1, y) || !on(image, x, y - 1)) &&
        on(image, x + 1, y) &&
        on(image, x, y + 1),
    );
    const lower = pixels.filter(
      ({ x, y }) =>
        (!on(image, x + 1, y) || !on(image, x, y + 1)) &&
        on(image, x - 1, y) &&
        on(image, x, y - 1),
    );
    expect(upper.length).toBeGreaterThan(20);
    expect(lower.length).toBeGreaterThan(20);
    expect(mean(upper.map((pixel) => luminance(pixel.rgb)))).toBeGreaterThan(
      mean(lower.map((pixel) => luminance(pixel.rgb))) + 8,
    );
    // On uncomplicated rim segments, the immediately inward pixel is already body material.
    const steps = upper.filter(({ x, y }) =>
      [
        [0, 1],
        [1, 0],
        [1, 2],
        [2, 1],
      ].every(([dx, dy]) => on(image, x + (dx ?? 0), y + (dy ?? 0))),
    );
    expect(steps.length).toBeGreaterThan(20);
    expect(
      mean(steps.map(({ rgb, x, y }) => luminance(rgb) - pixelLight(image, x + 1, y + 1))),
    ).toBeGreaterThan(8);
  });

  it('keeps interior streaks sparse, still and low contrast', () => {
    const image = bake('oil').layer;
    const body = painted(image).filter((pixel) => inside(image, pixel));
    const lights = body.map((pixel) => luminance(pixel.rgb)).sort((a, b) => a - b);
    const middle = lights[Math.floor(lights.length / 2)] ?? 0;
    const streaks = lights.filter((light) => light > middle + 12);
    expect(streaks.length).toBeGreaterThan(0);
    expect(streaks.length / body.length).toBeLessThanOrEqual(0.02);
    expect(Math.max(...streaks) - middle).toBeLessThanOrEqual(30);
    // The material layer has no clock input; a fresh public bake preserves all its marks.
    expect(bake('oil').layer.data).toEqual(image.data);
  });

  it('covers paving with opaque char instead of letting the stones colour the fire patch', () => {
    const image = bake('fire').layer;
    const pixels = painted(image);
    expect(pixels.length).toBeGreaterThan(1000);
    expect.soft(new Set(pixels.map((pixel) => pixel.alpha))).toEqual(new Set([255]));
    const paving = [rgb(TERRAIN_STYLES.stone.fill), rgb(TERRAIN_STYLES.stone.detail)];
    const groundInfluence = Math.max(
      ...pixels.map(({ rgb: colour, alpha }) =>
        Math.max(
          ...colour.map((value, channel) => {
            const over = (ground: Rgb) =>
              Math.round(value * (alpha / 255) + (ground[channel] ?? 0) * (1 - alpha / 255));
            return Math.abs(over(paving[0] ?? VOID) - over(paving[1] ?? PIT));
          }),
        ),
      ),
    );
    expect(groundInfluence).toBe(0);
  });

  it('retains an organic fire footprint and visible ember speckle', () => {
    const art = bake('fire');
    const pixels = painted(art.layer);
    const xs = pixels.map((pixel) => pixel.x);
    const ys = pixels.map((pixel) => pixel.y);
    const box = (Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1);
    expect(pixels.length).toBeLessThan(box);
    expect(on(art.layer, 3 * CS + CS / 2, 3 * CS + CS / 2)).toBe(true);
    expect(on(art.layer, CS / 2, CS / 2)).toBe(false);
    expect(pixels.some(({ rgb: [r, g, b] }) => r > 180 && g > 70 && b < 100)).toBe(true);
    expect(art.flames.length).toBeGreaterThan(0);
    expect(art.glow.data.some((value) => value !== 0)).toBe(true);
  });
});
