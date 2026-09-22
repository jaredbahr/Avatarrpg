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
 * of the board, in the two keys the DL-2 §3 table gives what this piece
 * actually depicts — a low ledge of **packed earth** standing on a **cut stone
 * block face**, the face showing only where the ledge's down-screen side is
 * exposed, with the bible's `#1b1410` ink around the silhouette and a thin pale
 * rim inside its lit edge.
 *
 * The cell envelope, the (19,4) road exit and the projected bounds are
 * unchanged, and no map row, key or scene id moves with this.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import {
  FOREST_RAISED_SHELF,
  FOREST_RAISED_SHELF_CELLS,
} from '../../src/content/scenes/forestRoad';
import { newImage, setPixel } from './lib/image';
import type { Image } from './lib/image';
import { encodeWebp } from './lib/webp';
import { FOREST_GROUND_QUALITY, loadForestMaterial } from './forest-village-material';
import type { ForestMaterial, ToneName } from './forest-village-material';

const TILE_DIAGONAL = Math.hypot(64, 32);
const INK_HALF = 1 / TILE_DIAGONAL;
const RIM_WIDTH = 3 / TILE_DIAGONAL;
/**
 * How much of a cell's down-screen corner shows the block face. This is the
 * figure the generated shelf was registered at, kept so the ledge's apparent
 * height does not change with the re-key.
 */
export const SHELF_FACE = 0.26;

export const FOREST_RAISED_SHELF_OUTPUT = 'public/art/maps/forest-scene/raised-shelf.webp';

export function packRaisedShelf(material: ForestMaterial): Image {
  const raised = new Set(FOREST_RAISED_SHELF_CELLS.map(({ x, y }) => `${x},${y}`));
  const cellAt = (x: number, y: number): boolean => raised.has(`${x},${y}`);
  const image = newImage(FOREST_RAISED_SHELF.width, FOREST_RAISED_SHELF.height);
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++) {
      const worldX = FOREST_RAISED_SHELF.x + px + 0.5;
      const worldY = FOREST_RAISED_SHELF.y + py + 0.5;
      const diagonal = (worldX - 768) / 64;
      const sum = worldY / 32;
      const x = (diagonal + sum) / 2;
      const y = (sum - diagonal) / 2;
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
      // The block face is the down-screen exposure: where the ledge ends on its
      // +x or +y side there is a cut wall under the walkable top, and that wall
      // is the only place cut stone shows.
      const face =
        (!cellAt(ix + 1, iy) && fx > 1 - SHELF_FACE) ||
        (!cellAt(ix, iy + 1) && fy > 1 - SHELF_FACE);
      const tone: ToneName = face ? 'stone' : 'road';
      const rgb =
        edge < INK_HALF
          ? material.ink
          : lit && edge < INK_HALF + RIM_WIDTH
            ? material.rimOf(tone)
            : material.colour(tone, x, y);
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
    note: 'Painted from the village material in the DL-2 §3 packed-earth and cut-stone keys, clipped to the authored elevation mask. Collision, elevation and the road exit remain map-owned; no water or grid is painted.',
  };
  mkdirSync('art/raw/forest', { recursive: true });
  writeFileSync(
    'art/raw/forest/raised-shelf-registration.json',
    JSON.stringify(registration, null, 2),
  );
  console.log(registration);
}

if (process.argv[1]?.endsWith('forest-raised-shelf.ts')) await main();
