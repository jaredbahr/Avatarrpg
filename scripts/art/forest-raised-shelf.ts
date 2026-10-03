/**
 * Pack the forest's eastern shelf into the exact elevated cell envelope.
 *
 *   node --import tsx scripts/art/forest-raised-shelf.ts
 *
 * The shelf used to be a generated PNG registered into the projected cell
 * groups, which is why it arrived carrying the same desert ochre the forest
 * atlas gave the road: once W2 re-keyed the route and its verges to the
 * village's hand, the shelf was one of three pieces left speaking the old
 * language. It is now painted from `forest-village-material.ts` like the rest
 * of the board.
 *
 * What it depicts is a low shelf standing a step above the road: a trodden
 * **packed-earth** top on a **cut stone block face**. The plate is clipped to
 * the rules' own cells, so the step is drawn inside them the way this camera
 * sees a raised block: the top is the footprint lifted by `SHELF_RISE` world
 * pixels, and wherever the ground under a pixel's top would already be off the
 * shelf, that pixel is the face instead. The face therefore stands straight up
 * from the shelf's down-screen (+x/+y) edges.
 *
 * Three things make it read raised rather than as the road widening:
 *
 * - the top reads the courtyard lawn's rhythm through its own salt (`trodden`),
 *   not the paving's flagstones the road beside it carries;
 * - ink runs along the lip, where the top breaks over the face, as well as
 *   round the silhouette and along the face's foot;
 * - the face is in the cut-stone row's shadow tones, never its pale ones: the
 *   left-facing wall in `#a2957c` with `#8a7d66` tool-marked joints, the
 *   right-facing wall, turned further from the light, in `#8a7d66` with ink
 *   joints.
 *
 * The lit (up-screen) edges of the top carry the thin pale rim.
 *
 * **M3's bank.** The Forest Road's NE bank grew from six cells to thirteen
 * tier-1 `^` cells and the tier-2 boulder perch at (19,2), and until this plate
 * followed them the relief painter drew the extra cells as bare pale slabs. The
 * plate is now a heightfield: every pixel casts its view ray into the bank and
 * shows the first column tall enough to meet it, so the perch's face stands on
 * the bank's top and the bank's on the ground, each a course pair of the same
 * shaded blocks. The perch's own top is the cut-stone row's pale pair — bare
 * rock above trodden earth — and the (19,4) road exit stays clear.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { FOREST_GROUND_ROWS, FOREST_ROAD } from '../../src/content/maps/combat';
import {
  FOREST_PERCH_CELLS,
  FOREST_RAISED_SHELF,
  FOREST_RAISED_SHELF_CELLS,
} from '../../src/content/scenes/forestRoad';
import type { Vec2 } from '../../src/core/types';
import { tileNoise } from '../../src/render/painters/shapes';
import { newImage, parseHex, setPixel } from './lib/image';
import type { Image } from './lib/image';
import { refuseToOverwriteGenerated } from './lib/shipped-pin';
import { encodeWebp } from './lib/webp';
import {
  FOREST_GROUND_QUALITY,
  FOREST_PIECE_TONES,
  loadForestMaterial,
} from './forest-village-material';
import type { ForestMaterial, Rgb } from './forest-village-material';

const TILE_DIAGONAL = Math.hypot(64, 32);
/** The bible's 2 px ink, drawn wholly inside: nothing else draws its other half. */
const INK = 2 / TILE_DIAGONAL;
const RIM_WIDTH = 3 / TILE_DIAGONAL;
/**
 * How far the top stands above the ground, in world pixels: the vertical
 * height the old 0.26-cell face band gave the ledge, kept so the shelf's
 * apparent height does not change with the re-key.
 */
export const SHELF_RISE = 16;
/** Ink across the lip and along the foot, in world pixels. */
const LIP_INK = 2;
/** One course of blocks is half the face; a block runs about half a cell along it. */
const COURSE = SHELF_RISE / 2;
const BLOCK = 32;

export const FOREST_RAISED_SHELF_OUTPUT = 'public/art/maps/forest-scene/raised-shelf.webp';

/** Logical cell coordinates of a world pixel. */
function logical(worldX: number, worldY: number): { x: number; y: number } {
  const diagonal = (worldX - 768) / 64;
  const sum = worldY / 32;
  return { x: (diagonal + sum) / 2, y: (sum - diagonal) / 2 };
}

/**
 * How many shelf rises a cell stands above the ground: the bank's tier-1 `^`
 * cells one, the tier-2 boulder perch (`A`, (19,2)) two, everything else none.
 */
export function shelfTiers(cells: readonly Vec2[], perches: readonly Vec2[]) {
  const tiers = new Map<string, number>();
  for (const { x, y } of cells) tiers.set(`${x},${y}`, 1);
  for (const { x, y } of perches) tiers.set(`${x},${y}`, 2);
  return (x: number, y: number): number => tiers.get(`${x},${y}`) ?? 0;
}

/**
 * Distance from a point inside cell `(ix, iy)` to the nearest edge that drops
 * to a lower tier, and whether that edge is up-screen, which is the lit side in
 * this projection and therefore the one that carries the rim.
 */
function lowerEdge(
  tierOf: (x: number, y: number) => number,
  ix: number,
  iy: number,
  fx: number,
  fy: number,
): [number, boolean] {
  const own = tierOf(ix, iy);
  let edge = Infinity;
  let lit = false;
  for (const [ox, oy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const) {
    if (tierOf(ix + ox, iy + oy) >= own) continue;
    const edgeDistance = ox < 0 ? fx : ox > 0 ? 1 - fx : oy < 0 ? fy : 1 - fy;
    if (edgeDistance < edge) {
      edge = edgeDistance;
      lit = ox < 0 || oy < 0;
    }
  }
  return [edge, lit];
}

/** Flat cells the perch may stand over: blocked ones, and ground past the rim. */
function overhangs(x: number, y: number): boolean {
  const key = FOREST_GROUND_ROWS[y]?.[x];
  if (key === undefined) return true;
  return FOREST_ROAD.legend[key]?.blocked === true;
}

export function packRaisedShelf(material: ForestMaterial): Image {
  const tierOf = shelfTiers(FOREST_RAISED_SHELF_CELLS, FOREST_PERCH_CELLS);
  const liftAt = (worldX: number, worldY: number): number => {
    const { x, y } = logical(worldX, worldY);
    return tierOf(Math.floor(x), Math.floor(y)) * SHELF_RISE;
  };
  const stone = FOREST_PIECE_TONES.stone;
  const walls = {
    /** The wall facing down-screen left, nearer the light. */
    left: { field: parseHex(stone.shadow), joint: parseHex(stone.joint) },
    /** The wall facing down-screen right, turned away from it. */
    right: { field: parseHex(stone.joint), joint: material.ink },
  };
  const perchTop = { field: parseHex(stone.base), rim: parseHex(stone.rim) };
  const maxLift = 2 * SHELF_RISE;
  const image = newImage(FOREST_RAISED_SHELF.width, FOREST_RAISED_SHELF.height);
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++) {
      const worldX = FOREST_RAISED_SHELF.x + px + 0.5;
      const worldY = FOREST_RAISED_SHELF.y + py + 0.5;
      const { x, y } = logical(worldX, worldY);
      const ix = Math.floor(x),
        iy = Math.floor(y);
      const own = tierOf(ix, iy);
      // The bank stays clipped to the raised cells' own footprints, exactly as
      // the six-cell shelf was, so no lifted top ever paints a walkable flat
      // cell. The perch alone may stand over what lies behind it — the bank,
      // the pines it is wedged against and the ground past the rim — because a
      // boulder cut off at its own footprint reads as a slab.
      if (own === 0 && !overhangs(ix, iy)) continue;
      const fx = x - ix,
        fy = y - iy;

      // Distance to the nearest edge this cell does not continue across at its
      // own height, and whether that edge is the up-screen one, which is the lit
      // side in this projection and therefore the one that carries the rim.
      const [edge, lit] = lowerEdge(tierOf, ix, iy, fx, fy);

      // Cast the pixel's view ray into the bank. A ray passes altitude `d` over
      // the ground point `d` world pixels down-screen of the pixel, and the
      // higher points are the nearer ones, so the first column tall enough to
      // reach its altitude is what the camera sees: its top if the ray meets it
      // exactly there, the face standing on its down-screen edge if lower.
      let hit = -1;
      let lift = 0;
      for (let d = maxLift; d >= 0; d--) {
        lift = liftAt(worldX, worldY + d);
        if (lift > 0 && lift >= d) {
          hit = d;
          break;
        }
      }
      // Off the bank, only the perch is drawn; the rest stays for the ground.
      if (hit < 0 || (own === 0 && lift <= SHELF_RISE)) continue;
      const perch = lift > SHELF_RISE;
      let rgb: Rgb;
      // The bank's clipped silhouette is inked at its own footprint, as the
      // six-cell shelf was; the perch carries its own outline where it stands.
      const clipInk = !perch && own === 1 && edge < INK;
      if (clipInk) {
        rgb = material.ink;
      } else if (lift > hit) {
        // Which wall this is: the one whose edge the ray leaves the column by,
        // and the ground (or lower tier) the face stands on across that edge.
        let exitAt = hit + 1;
        while (exitAt <= maxLift + 1 && liftAt(worldX, worldY + exitAt) === lift) exitAt++;
        const foot = logical(worldX, worldY + exitAt - 1);
        const exit = logical(worldX, worldY + exitAt);
        const wall =
          Math.floor(exit.x) > Math.floor(foot.x) && Math.floor(exit.y) === Math.floor(foot.y)
            ? walls.right
            : walls.left;
        const base = liftAt(worldX, worldY + exitAt);
        const height = hit - base;
        const course = Math.floor(height / COURSE);
        // Blocks break joint course to course, and each runs its own length.
        const run = Math.floor(worldX) + course * (BLOCK / 2);
        const block = Math.floor(run / BLOCK);
        const jointAt = block * BLOCK + 4 + Math.floor(tileNoise(block, course, 5) * (BLOCK - 8));
        if (hit > lift - LIP_INK || height < LIP_INK) rgb = material.ink;
        else if (height % COURSE === 0 || run === jointAt) rgb = wall.joint;
        else rgb = wall.field;
      } else {
        // The top, sampled where it stands rather than where its pixel lands,
        // so the lawn's rhythm rides up with the lift instead of sliding.
        const top = logical(worldX, worldY + lift);
        if (perch) {
          // The perch is the bank's bare rock: the cut-stone row's own pale
          // pair, which the bank's shaded faces never use, outlined where its
          // lifted top really ends rather than at its footprint.
          const tx = Math.floor(top.x),
            ty = Math.floor(top.y);
          const [topEdge, topLit] = lowerEdge(tierOf, tx, ty, top.x - tx, top.y - ty);
          rgb =
            topEdge < INK
              ? material.ink
              : topLit && topEdge < INK + RIM_WIDTH
                ? perchTop.rim
                : perchTop.field;
        } else
          rgb =
            lit && edge < INK + RIM_WIDTH && own === 1
              ? material.rimOf('trodden')
              : material.colour('trodden', top.x, top.y);
      }
      setPixel(image, px, py, [rgb[0], rgb[1], rgb[2], 255]);
    }
  return image;
}

export async function main(): Promise<void> {
  refuseToOverwriteGenerated('forest-raised-shelf');
  const image = packRaisedShelf(await loadForestMaterial());
  mkdirSync('public/art/maps/forest-scene', { recursive: true });
  const bytes = await encodeWebp(image, FOREST_GROUND_QUALITY, true);
  writeFileSync(FOREST_RAISED_SHELF_OUTPUT, bytes);
  const registration = {
    map: FOREST_ROAD.id,
    cells: FOREST_RAISED_SHELF_CELLS,
    perches: FOREST_PERCH_CELLS,
    exitGap: { x: 19, y: 4 },
    projectedBounds: FOREST_RAISED_SHELF,
    source: 'scripts/art/forest-village-material.ts',
    output: {
      path: FOREST_RAISED_SHELF_OUTPUT,
      width: image.width,
      height: image.height,
      bytes: bytes.length,
      quality: FOREST_GROUND_QUALITY,
    },
    note: 'Painted from the village material in the DL-2 §3 packed-earth and cut-stone keys: a heightfield of lifted tops over vertical block faces (tier 1 bank, tier 2 perch), clipped to the authored elevation mask. Collision, elevation and the road exit remain map-owned; no water or grid is painted.',
  };
  mkdirSync('art/raw/forest', { recursive: true });
  writeFileSync(
    'art/raw/forest/raised-shelf-registration.json',
    JSON.stringify(registration, null, 2),
  );
  console.log(registration);
}

if (process.argv[1]?.endsWith('forest-raised-shelf.ts')) await main();
