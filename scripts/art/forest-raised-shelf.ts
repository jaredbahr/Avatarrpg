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
 * The lit (up-screen) edges of the top carry the thin pale rim. The cell
 * envelope, the (19,4) road exit and the projected bounds are unchanged, and
 * no map row, key or scene id moves with this.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import {
  FOREST_RAISED_SHELF,
  FOREST_RAISED_SHELF_CELLS,
} from '../../src/content/scenes/forestRoad';
import { tileNoise } from '../../src/render/painters/shapes';
import { newImage, parseHex, setPixel } from './lib/image';
import type { Image } from './lib/image';
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

export function packRaisedShelf(material: ForestMaterial): Image {
  const raised = new Set(FOREST_RAISED_SHELF_CELLS.map(({ x, y }) => `${x},${y}`));
  const cellAt = (x: number, y: number): boolean => raised.has(`${x},${y}`);
  const onShelf = (worldX: number, worldY: number): boolean => {
    const { x, y } = logical(worldX, worldY);
    return cellAt(Math.floor(x), Math.floor(y));
  };
  const stone = FOREST_PIECE_TONES.stone;
  const walls = {
    /** The wall facing down-screen left, nearer the light. */
    left: { field: parseHex(stone.shadow), joint: parseHex(stone.joint) },
    /** The wall facing down-screen right, turned away from it. */
    right: { field: parseHex(stone.joint), joint: material.ink },
  };
  const image = newImage(FOREST_RAISED_SHELF.width, FOREST_RAISED_SHELF.height);
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++) {
      const worldX = FOREST_RAISED_SHELF.x + px + 0.5;
      const worldY = FOREST_RAISED_SHELF.y + py + 0.5;
      const { x, y } = logical(worldX, worldY);
      const ix = Math.floor(x),
        iy = Math.floor(y);
      if (!cellAt(ix, iy)) continue;
      const fx = x - ix,
        fy = y - iy;

      // Distance to the nearest edge this shelf does not continue across, and
      // whether that edge is the up-screen one, which is the lit side in this
      // projection and therefore the one that carries the rim.
      let edge = Infinity;
      let lit = false;
      for (const [ox, oy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        if (cellAt(ix + ox, iy + oy)) continue;
        const edgeDistance = ox < 0 ? fx : ox > 0 ? 1 - fx : oy < 0 ? fy : 1 - fy;
        if (edgeDistance < edge) {
          edge = edgeDistance;
          lit = ox < 0 || oy < 0;
        }
      }

      // How far straight down the footprint runs from here. Within the rise,
      // the ground under this pixel's top is already off the shelf, so what
      // the camera sees is the face; beyond it, the lifted top.
      let drop = 1;
      while (drop <= SHELF_RISE && onShelf(worldX, worldY + drop)) drop++;
      let rgb: Rgb;
      if (edge < INK) {
        rgb = material.ink;
      } else if (drop <= SHELF_RISE) {
        // Which wall this is: the one whose edge the drop leaves the shelf by.
        const foot = logical(worldX, worldY + drop - 1);
        const exit = logical(worldX, worldY + drop);
        const wall =
          Math.floor(exit.x) > Math.floor(foot.x) && Math.floor(exit.y) === Math.floor(foot.y)
            ? walls.right
            : walls.left;
        const height = drop - 1;
        const course = Math.floor(height / COURSE);
        // Blocks break joint course to course, and each runs its own length.
        const run = Math.floor(worldX) + course * (BLOCK / 2);
        const block = Math.floor(run / BLOCK);
        const jointAt = block * BLOCK + 4 + Math.floor(tileNoise(block, course, 5) * (BLOCK - 8));
        if (drop > SHELF_RISE - LIP_INK || height < LIP_INK) rgb = material.ink;
        else if (height % COURSE === 0 || run === jointAt) rgb = wall.joint;
        else rgb = wall.field;
      } else {
        // The top, sampled where it stands rather than where its pixel lands,
        // so the lawn's rhythm rides up with the lift instead of sliding.
        const top = logical(worldX, worldY + SHELF_RISE);
        rgb =
          lit && edge < INK + RIM_WIDTH
            ? material.rimOf('trodden')
            : material.colour('trodden', top.x, top.y);
      }
      setPixel(image, px, py, [rgb[0], rgb[1], rgb[2], 255]);
    }
  return image;
}

export async function main(): Promise<void> {
  const image = packRaisedShelf(await loadForestMaterial());
  mkdirSync('public/art/maps/forest-scene', { recursive: true });
  const bytes = await encodeWebp(image, FOREST_GROUND_QUALITY, true);
  writeFileSync(FOREST_RAISED_SHELF_OUTPUT, bytes);
  const registration = {
    map: FOREST_ROAD.id,
    cells: FOREST_RAISED_SHELF_CELLS,
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
    note: 'Painted from the village material in the DL-2 §3 packed-earth and cut-stone keys: a lifted top over a vertical block face, clipped to the authored elevation mask. Collision, elevation and the road exit remain map-owned; no water or grid is painted.',
  };
  mkdirSync('art/raw/forest', { recursive: true });
  writeFileSync(
    'art/raw/forest/raised-shelf-registration.json',
    JSON.stringify(registration, null, 2),
  );
  console.log(registration);
}

if (process.argv[1]?.endsWith('forest-raised-shelf.ts')) await main();
