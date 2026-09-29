/**
 * Paint the ground outside the Ba Dan board.
 *
 * The village's authored pieces cover the playable diamond; outside it the page
 * showed through, so the rim read as the edge of a board rather than the edge of
 * a village. This plate carries the terrain that borders the rim outward: the
 * outer garden's pixel-grain meadow (`ba-dan-garden.ts`), continued for about a
 * tile where the outermost logical cell is road or paving, then dissolved into
 * the page on an ordered dither over the next tile and a half.
 *
 * Nothing here touches a playable pixel — every sample inside the board stays
 * transparent, which `ba-dan-exterior-apron.test.ts` asserts.
 *
 * npx tsx scripts/art/ba-dan-exterior-apron.ts
 */
import { BA_DAN_VILLAGE } from '../../src/content/maps/village';
import {
  BA_DAN_APRON_BANDS,
  BA_DAN_APRON_MAP,
  BA_DAN_EXTERIOR_APRON,
} from '../../src/content/scenes/baDan';
import { bayer, GRAIN, grassTexel, materialTexel, worldLogical } from './ba-dan-garden';
import { writeApronPlates } from './lib/apron-plates';
import { newImage, setPixel } from './lib/image';
import type { Image } from './lib/image';

/** The bands are written here, one file per entry in `BA_DAN_APRON_BANDS`. */
export const DIRECTORY = 'public/art/maps/ba-dan-scene';
export const STEM = 'exterior-apron';
export const QUALITY = 90;
/** Terrain is fully faded out by this far outside the rim, in logical tiles. */
export const APRON_FADE = 2.2;
/** The outer cell's road or paving is carried this far before meadow takes over. */
export const MATERIAL_REACH = 1.15;
/** The projection's origin in local pixels, matching the scene's own pieces. */
const ORIGIN = 1024;

type Terrain = 'grass' | 'road' | 'stone';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Local image pixels to logical map coordinates; the inverse of the projection. */
export function apronLogical(px: number, py: number): { x: number; y: number } {
  const dx = (BA_DAN_EXTERIOR_APRON.x + px + 0.5 - ORIGIN) / 64;
  const dy = (BA_DAN_EXTERIOR_APRON.y + py + 0.5) / 32;
  return { x: (dx + dy) / 2, y: (dy - dx) / 2 };
}

/** The plate's pixel for a logical map point; the forward projection. */
export function apronPixel(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.round(ORIGIN + (x - y) * 64 - BA_DAN_EXTERIOR_APRON.x - 0.5),
    y: Math.round((x + y) * 32 - BA_DAN_EXTERIOR_APRON.y - 0.5),
  };
}

/** How far outside the board this point is, in logical tiles; 0 on the board. */
export function apronDepth(x: number, y: number): number {
  const { width, height } = BA_DAN_APRON_MAP;
  return Math.max(-x, x - width, -y, y - height);
}

/** The terrain of the board cell this exterior point borders, and its depth. */
export function apronBorders(x: number, y: number): { terrain: Terrain; depth: number } {
  const { width, height, rows } = BA_DAN_VILLAGE;
  const column = clamp(Math.floor(x), 0, width - 1);
  const row = clamp(Math.floor(y), 0, height - 1);
  const sides = [
    { depth: -x, cell: rows[row]?.[0] },
    { depth: x - width, cell: rows[row]?.[width - 1] },
    { depth: -y, cell: rows[0]?.[column] },
    { depth: y - height, cell: rows[height - 1]?.[column] },
  ];
  const nearest = sides.reduce((best, side) => (side.depth > best.depth ? side : best));
  const key = nearest.cell ?? ',';
  const terrain: Terrain =
    key === '=' ? 'road' : key === '.' || key === 'l' || key === 'B' ? 'stone' : 'grass';
  return { terrain, depth: nearest.depth };
}

/** The dither stays solid this far out, then thins to nothing by `APRON_FADE`. */
export const APRON_SOLID = 0.45;

/**
 * The garden field (`ba-dan-garden.ts`) continued past the rim. Where the
 * outer cell is road or paving, that material carries on for
 * `MATERIAL_REACH` and hands over to grass through the ordered dither; the
 * whole plate then dissolves into the page the same way. Every texel is
 * either fully painted or clear, and it agrees with the garden base texel for
 * texel at the rim because both read the same world lattice.
 */
export function packApron(): Image {
  const image = newImage(BA_DAN_EXTERIOR_APRON.width, BA_DAN_EXTERIOR_APRON.height);
  const { x: ox, y: oy } = BA_DAN_EXTERIOR_APRON;
  if (ox % GRAIN || oy % GRAIN) throw new Error('The apron must start on the texel lattice.');
  for (let ty = oy / GRAIN; ty < (oy + image.height) / GRAIN; ty++) {
    for (let tx = ox / GRAIN; tx < (ox + image.width) / GRAIN; tx++) {
      const { x, y } = worldLogical((tx + 0.5) * GRAIN, (ty + 0.5) * GRAIN);
      const depth = apronDepth(x, y);
      if (depth <= 0 || depth >= APRON_FADE) continue;
      // A texel covers four screen pixels. At the diamond rim its centre can
      // lie outside while one of those pixel centres lies on playable ground;
      // skip the whole texel so the apron never overpaints the board and the
      // two-pixel grain does not fracture into one-pixel teeth.
      const crossesBoard = [0.5, GRAIN - 0.5].some((dx) =>
        [0.5, GRAIN - 0.5].some((dy) =>
          ((point) => apronDepth(point.x, point.y) <= 0)(
            worldLogical(tx * GRAIN + dx, ty * GRAIN + dy),
          ),
        ),
      );
      if (crossesBoard) continue;
      const threshold = bayer(tx, ty);
      const cover = 1 - clamp((depth - APRON_SOLID) / (APRON_FADE - APRON_SOLID), 0, 1);
      if (threshold >= cover) continue;
      const { terrain } = apronBorders(x, y);
      const carried = terrain !== 'grass' && threshold < 1 - depth / MATERIAL_REACH;
      const colour = carried ? materialTexel(terrain, tx, ty) : grassTexel(tx, ty);
      for (let dy = 0; dy < GRAIN; dy++)
        for (let dx = 0; dx < GRAIN; dx++)
          setPixel(image, tx * GRAIN - ox + dx, ty * GRAIN - oy + dy, [...colour, 255]);
    }
  }
  return image;
}

if (process.argv[1]?.endsWith('ba-dan-exterior-apron.ts')) {
  await writeApronPlates({
    ring: packApron(),
    bands: BA_DAN_APRON_BANDS,
    directory: DIRECTORY,
    stem: STEM,
    quality: QUALITY,
  });
}
