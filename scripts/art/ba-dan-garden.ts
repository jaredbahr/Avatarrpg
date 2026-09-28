/**
 * Ba Dan's outer garden: one pixel-grain grass field under the whole village.
 *
 * The courts and lawns are painted pieces cut from the reviewed courtyard
 * plate, an olive meadow. Wherever they stopped, the procedural cells showed
 * through in the art bible's saturated grass (#6f9e4c), flat on Canvas and
 * fbm-noised on WebGL. So the board sat in a frame of a different green, the
 * lawns' feathered edges read as seams, and the apron carried that same bright
 * green out to the page on a smooth alpha ramp (docs/art/ba-dan-scene.md,
 * "Outer garden").
 *
 * This field is drawn in the lawns' own tones (`GARDEN_TONES`, measured from
 * the quiet-grass swatch the lawns are cut from) at the restyle's grain, two
 * world pixels a texel on a lattice fixed to the world origin, so every piece
 * built from it agrees texel for texel:
 *
 * - the garden base: two opaque plates over the board, listed first in the
 *   scene's ground, so the painted courts feather into matching grass
 *   instead of into the procedural fill;
 * - the exterior apron (`ba-dan-exterior-apron.ts`), which continues it past
 *   the rim and dissolves it into the page on an ordered dither, not a ramp.
 *
 * Flat clusters of four tones and a few tufts, no gradient: the ground ink
 * rule keeps plain grass free of outline.
 *
 * npx tsx scripts/art/ba-dan-garden.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { BA_DAN_APRON_MAP, BA_DAN_GARDEN_PLATES } from '../../src/content/scenes/baDan';
import { tileNoise } from '../../src/render/painters/shapes';
import { newImage, setPixel } from './lib/image';
import type { Image } from './lib/image';
import { encodeWebpLossless } from './lib/webp';

export const DIRECTORY = 'public/art/maps/ba-dan-scene';
/** World pixels per texel: the restyled scenery's two-screen-pixel grain at zoom 1.2. */
export const GRAIN = 2;
/** The projection's origin, matching the scene's own pieces. */
const ORIGIN = 1024;

type Rgb = readonly [number, number, number];

/**
 * Deep, shadow, base and light: the quiet-grass swatch (courtyard cells
 * x10..11, y4) split at its 20th, 50th and 80th luma percentiles, each band's
 * median, with a deeper step for tuft roots. `ba-dan-garden.test.ts` measures
 * the swatch again and holds these to it.
 */
export const GARDEN_TONES = {
  deep: [118, 130, 70],
  shadow: [142, 153, 87],
  base: [153, 161, 90],
  light: [170, 175, 101],
} as const satisfies Record<string, Rgb>;

/** Road and paving tones, the art bible's ground triples, for the exits the apron carries on. */
export const MATERIAL_TONES = {
  road: { shadow: [0x8e, 0x70, 0x49], base: [0xb3, 0x90, 0x64], light: [0xc7, 0xa8, 0x7d] },
  stone: { shadow: [0xb3, 0xa4, 0x88], base: [0xd8, 0xcb, 0xb0], light: [0xef, 0xe6, 0xd2] },
} as const satisfies Record<string, Record<'shadow' | 'base' | 'light', Rgb>>;

/** World pixel to logical map coordinates; the inverse of the projection. */
export function worldLogical(wx: number, wy: number): { x: number; y: number } {
  const dx = (wx - ORIGIN) / 64;
  const dy = wy / 32;
  return { x: (dx + dy) / 2, y: (dy - dx) / 2 };
}

/** How far outside the board a logical point is, in tiles; 0 or less on it. */
export function boardDepth(x: number, y: number): number {
  const { width, height } = BA_DAN_APRON_MAP;
  return Math.max(-x, x - width, -y, y - height);
}

/** The texel's centre in world pixels, for a world pixel inside it. */
export function texelCentre(wx: number, wy: number): { x: number; y: number } {
  return {
    x: (Math.floor(wx / GRAIN) + 0.5) * GRAIN,
    y: (Math.floor(wy / GRAIN) + 0.5) * GRAIN,
  };
}

/** Bilinear value noise over the tile hash: smooth only between lattice points, then thresholded. */
function valueNoise(x: number, y: number, salt: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const a = tileNoise(x0, y0, salt);
  const b = tileNoise(x0 + 1, y0, salt);
  const c = tileNoise(x0, y0 + 1, salt);
  const d = tileNoise(x0 + 1, y0 + 1, salt);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/** 4x4 ordered-dither threshold in (0, 1). */
export function bayer(tx: number, ty: number): number {
  const m = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  return ((m[(ty & 3) * 4 + (tx & 3)] ?? 0) + 0.5) / 16;
}

/**
 * Which of three tones a texel takes: clusters about a quarter-tile across,
 * laid on the ground plane so they foreshorten with it, with a little
 * per-texel break-up so no cluster edge runs straight.
 */
function band(x: number, y: number, tx: number, ty: number): 0 | 1 | 2 {
  const v =
    valueNoise(x * 3.1, y * 3.1, 41) * 0.6 +
    valueNoise(x * 7.3, y * 7.3, 43) * 0.3 +
    tileNoise(tx, ty, 47) * 0.1;
  return v < 0.4 ? 0 : v < 0.62 ? 1 : 2;
}

/**
 * A tuft: blades splaying from a deep root, four texels tall. Three chances per
 * logical cell, placed by the tile hash. Returns the tone for this texel, or
 * null when no tuft covers it.
 */
function tuft(tx: number, ty: number): Rgb | null {
  // Texel rows of a tuft, from its root upward: [dx, tone] pairs.
  const glyph: readonly (readonly [number, keyof typeof GARDEN_TONES][])[] = [
    [
      [-1, 'deep'],
      [0, 'deep'],
      [1, 'deep'],
    ],
    [
      [-1, 'shadow'],
      [0, 'deep'],
      [1, 'shadow'],
    ],
    [
      [-2, 'shadow'],
      [0, 'base'],
      [2, 'shadow'],
    ],
    [
      [-2, 'light'],
      [0, 'light'],
      [3, 'base'],
    ],
  ];
  for (let row = 0; row < glyph.length; row++) {
    const rootY = ty + row;
    for (const [dx, tone] of glyph[row] ?? []) {
      const rootX = tx - dx;
      const centre = { x: (rootX + 0.5) * GRAIN, y: (rootY + 0.5) * GRAIN };
      const { x, y } = worldLogical(centre.x, centre.y);
      const cell = { x: Math.floor(x), y: Math.floor(y) };
      for (let k = 0; k < 3; k++) {
        // The tuft's root texel, hashed per cell; only one root matches.
        const u = tileNoise(cell.x, cell.y, 60 + k * 2);
        const v = tileNoise(cell.x, cell.y, 61 + k * 2);
        const root = texelCentre(
          ORIGIN + (cell.x + u - (cell.y + v)) * 64,
          (cell.x + u + cell.y + v) * 32,
        );
        if (Math.floor(root.x / GRAIN) === rootX && Math.floor(root.y / GRAIN) === rootY)
          return GARDEN_TONES[tone];
      }
    }
  }
  return null;
}

/** The grass at a world texel. */
export function grassTexel(tx: number, ty: number): Rgb {
  const tufted = tuft(tx, ty);
  if (tufted) return tufted;
  const { x, y } = worldLogical((tx + 0.5) * GRAIN, (ty + 0.5) * GRAIN);
  const tone = band(x, y, tx, ty);
  return tone === 0 ? GARDEN_TONES.shadow : tone === 1 ? GARDEN_TONES.base : GARDEN_TONES.light;
}

/** A material (road or paving) texel, clustered like the grass. */
export function materialTexel(material: keyof typeof MATERIAL_TONES, tx: number, ty: number): Rgb {
  const { x, y } = worldLogical((tx + 0.5) * GRAIN, (ty + 0.5) * GRAIN);
  const tones = MATERIAL_TONES[material];
  const tone = band(x, y, tx, ty);
  return tone === 0 ? tones.shadow : tone === 1 ? tones.base : tones.light;
}

/**
 * One opaque plate of the garden base: every texel whose centre is on the
 * board is grass; everything else is clear, for the apron to continue.
 */
export function packGardenPlate(plate: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}): Image {
  if (plate.x % GRAIN || plate.y % GRAIN) throw new Error('A plate must start on the texel lattice.');
  const image = newImage(plate.width, plate.height);
  for (let ty = plate.y / GRAIN; ty < (plate.y + plate.height) / GRAIN; ty++) {
    for (let tx = plate.x / GRAIN; tx < (plate.x + plate.width) / GRAIN; tx++) {
      const at = worldLogical((tx + 0.5) * GRAIN, (ty + 0.5) * GRAIN);
      if (boardDepth(at.x, at.y) > 0) continue;
      const colour = grassTexel(tx, ty);
      for (let dy = 0; dy < GRAIN; dy++)
        for (let dx = 0; dx < GRAIN; dx++)
          setPixel(image, tx * GRAIN - plate.x + dx, ty * GRAIN - plate.y + dy, [...colour, 255]);
    }
  }
  return image;
}

export function gardenPlatePath(index: number): string {
  return `${DIRECTORY}/garden-${index}.webp`;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/art/ba-dan-garden.ts')) {
  mkdirSync(DIRECTORY, { recursive: true });
  for (const [index, plate] of BA_DAN_GARDEN_PLATES.entries()) {
    writeFileSync(gardenPlatePath(index), await encodeWebpLossless(packGardenPlate(plate)));
    console.log(gardenPlatePath(index));
  }
}
