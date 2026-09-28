/**
 * Close the water barrel's top with a wooden lid.
 *
 *   node --import tsx scripts/art/barrel-lid.ts
 *
 * `barrel.png` came out of generation as an open barrel brim-full of bright
 * cyan water. On the quarry's pale ground that disc read as a water hazard on
 * the board, the one thing a barrel is not until it breaks — and the bible
 * keeps the pale cyan `#7ec8e3` family off anything that is not a live water
 * surface. The lid is the barrel's own wood: every tone below is a stave
 * colour already in the art, so nothing new enters the palette. Two flat
 * tones, the shadow tone along the back of the brim where the staves shade it,
 * and plank seams in the staves' own dark joint.
 *
 * It rewrites only the water pixels, so it is idempotent: run on the shipped
 * lidded barrel it changes nothing, which is what its test holds.
 */
import { readPng, writePng } from './lib/image';
import type { Image } from './lib/image';

export const BARREL_PATH = 'public/art/props/barrel.png';

/** Stave tones sampled from the barrel's own sides. */
export const LID_TONES = {
  base: [191, 119, 52],
  shadow: [115, 64, 28],
  seam: [76, 40, 19],
} as const;

/** Plank seams run front to back across the lid, this far apart in frame pixels. */
const PLANK_PX = 18;
/** How deep the brim's shade reaches onto the back of the lid. */
const SHADE_PX = 5;

/** The water: clearly blue-green over red, which no wood, iron or ink tone is. */
export function isWater(r: number, g: number, b: number): boolean {
  return b > r + 25 && g > r + 15;
}

export function closeLid(source: Image): Image {
  const { width, height } = source;
  const image: Image = { width, height, data: Uint8Array.from(source.data) };
  const water = (x: number, y: number): boolean => {
    const i = (y * width + x) * 4;
    const d = source.data;
    return (d[i + 3] ?? 0) > 0 && isWater(d[i] ?? 0, d[i + 1] ?? 0, d[i + 2] ?? 0);
  };
  let left = width,
    right = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (water(x, y)) {
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
  if (right < 0) return image;
  const centre = (left + right) / 2;
  const cool = (x: number, y: number): boolean => {
    const i = (y * width + x) * 4;
    const d = source.data;
    return (d[i + 3] ?? 0) > 0 && (d[i + 2] ?? 0) > (d[i] ?? 0) + 4;
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (!water(x, y)) {
        // The water's own dark slate fringe inside the brim, warmed to the
        // wood's joint so the lid does not keep a cold ring.
        const touches = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx = 0, dy = 0]) => water(x + dx, y + dy));
        if (touches && cool(x, y)) {
          const i = (y * width + x) * 4;
          [image.data[i], image.data[i + 1], image.data[i + 2]] = LID_TONES.seam;
        }
        continue;
      }
      // The first water pixels down each column sit under the back of the brim.
      let above = 0;
      while (above < SHADE_PX && y - above - 1 >= 0 && water(x, y - above - 1)) above++;
      const seam = Math.abs(Math.round(x - centre)) % PLANK_PX === PLANK_PX / 2;
      const tone = above < SHADE_PX ? LID_TONES.shadow : seam ? LID_TONES.seam : LID_TONES.base;
      const i = (y * width + x) * 4;
      image.data[i] = tone[0];
      image.data[i + 1] = tone[1];
      image.data[i + 2] = tone[2];
    }
  return image;
}

if (process.argv[1]?.endsWith('barrel-lid.ts')) {
  writePng(BARREL_PATH, closeLid(readPng(BARREL_PATH)));
  console.log(`closed the lid on ${BARREL_PATH}`);
}
