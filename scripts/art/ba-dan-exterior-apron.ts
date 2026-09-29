/**
 * Paint the ground outside the Ba Dan board.
 *
 * The village's authored pieces cover the playable diamond; outside it the page
 * showed through, so the rim read as the edge of a board rather than the edge of
 * a village. This plate carries the terrain that borders the rim outward: the
 * outer garden's pixel-grain meadow (`ba-dan-garden.ts`), and where the
 * outermost logical cell is road or paving, the painted flagstone running on
 * off the map with grass creeping into it. Past a solid half-tile the whole
 * plate dissolves into the page in soft stepped bands.
 *
 * Nothing here touches a playable pixel — every sample inside the board stays
 * transparent, which `ba-dan-exterior-apron.test.ts` asserts.
 *
 * npx tsx scripts/art/ba-dan-exterior-apron.ts
 */
import {
  BA_DAN_APRON_BANDS,
  BA_DAN_APRON_MAP,
  BA_DAN_EXTERIOR_APRON,
} from '../../src/content/scenes/baDan';
import {
  contactWear,
  flagstoneTexel,
  GRAIN,
  grassTexel,
  rimBorder,
  texelTouchesBoard,
  transitionCluster,
  worldLogical,
} from './ba-dan-garden';
import { writeApronPlates } from './lib/apron-plates';
import { newImage, setPixel } from './lib/image';
import type { Image } from './lib/image';

/** The bands are written here, one file per entry in `BA_DAN_APRON_BANDS`. */
export const DIRECTORY = 'public/art/maps/ba-dan-scene';
export const STEM = 'exterior-apron';
export const QUALITY = 90;
/** Terrain is fully faded out by this far outside the rim, in logical tiles. */
export const APRON_FADE = 2.2;
/**
 * A road exit's flagstone is whole at the rim and loses this share of its
 * texels to grass by `APRON_FADE`, in clusters: a road running on into the
 * country, not one that stops.
 */
export const EXIT_WEAR = 0.7;
/** The projection's origin in local pixels, matching the scene's own pieces. */
const ORIGIN = 1024;

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

/** The apron stays solid this far out, then steps softly to nothing by `APRON_FADE`. */
export const APRON_SOLID = 0.45;

/**
 * Flat alpha steps: continuous painted bands with no halftone holes. Ten small
 * steps rather than five large ones, so no one step reads as a stripe.
 */
export const APRON_ALPHA_STEPS = [255, 230, 204, 178, 152, 126, 100, 74, 48, 24] as const;

/** How far the step edges wander, in tiles, so they never run as ruled diagonals. */
export const APRON_STEP_WANDER = 0.18;

/**
 * The alpha at a depth past the rim. Given the logical point, the step edges
 * wander on the broad clustered mask; it has no per-texel term, so each edge
 * stays a smooth contour rather than a screen. The solid band stays solid, and
 * the wander settles to the true depth at the outer edge, which ends on the
 * faintest step.
 */
export function apronAlpha(depth: number, x?: number, y?: number): number {
  if (depth <= APRON_SOLID) return APRON_ALPHA_STEPS[0];
  const wander =
    x === undefined || y === undefined
      ? 0
      : (transitionCluster(x * 0.5, y * 0.5, 91) - 0.5) *
        2 *
        APRON_STEP_WANDER *
        clamp((APRON_FADE - depth) / (2 * APRON_STEP_WANDER), 0, 1);
  const progress = clamp((depth + wander - APRON_SOLID) / (APRON_FADE - APRON_SOLID), 0, 1);
  const index = Math.min(
    APRON_ALPHA_STEPS.length - 1,
    Math.floor(progress * APRON_ALPHA_STEPS.length),
  );
  return APRON_ALPHA_STEPS[index] ?? 0;
}

/**
 * The garden field (`ba-dan-garden.ts`) continued past the rim. Where the
 * outer cell is road or paving, the painted flagstone runs on and gives up
 * `EXIT_WEAR` of itself to grass in broad clusters; the whole plate then
 * dissolves into the page in ten wandering alpha bands. It meets the garden
 * base texel for texel at the rim because both read the same world lattice
 * and split the rim texels by `texelTouchesBoard`.
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
      // the garden base paints that texel, so skip it here and the apron never
      // overpaints the board. At the outer edge, likewise, a texel with any
      // pixel past the fade stays clear, so no pixel lands beyond it.
      if (texelTouchesBoard(tx, ty)) continue;
      const pastFade = [0.5, GRAIN - 0.5].some((dx) =>
        [0.5, GRAIN - 0.5].some((dy) => {
          const point = worldLogical(tx * GRAIN + dx, ty * GRAIN + dy);
          return apronDepth(point.x, point.y) >= APRON_FADE;
        }),
      );
      if (pastFade) continue;
      const { terrain } = rimBorder(x, y, true);
      const carried =
        terrain !== 'grass' &&
        transitionCluster(x, y, 83) < 1 - EXIT_WEAR * clamp(depth / APRON_FADE, 0, 1);
      // A rim tree's roots and litter run on past the rim with the grass.
      const colour = carried ? flagstoneTexel(tx, ty) : (contactWear(tx, ty) ?? grassTexel(tx, ty));
      const alpha = apronAlpha(depth, x, y);
      for (let dy = 0; dy < GRAIN; dy++)
        for (let dx = 0; dx < GRAIN; dx++)
          setPixel(image, tx * GRAIN - ox + dx, ty * GRAIN - oy + dy, [...colour, alpha]);
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
