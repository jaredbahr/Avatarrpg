/**
 * Pack the forest road's two rubble diamonds.
 *
 *   node --import tsx scripts/art/forest-rubble.ts
 *
 * `rubble.webp` had no packer at all: it was committed straight out of the
 * generation pass that dressed the forest road (`bd70d2d`), and it kept that
 * pass's cold grey slabs over desert ochre grit. Once W2 re-keyed the route and
 * its verges to the village's hand, the two diamonds this plate is drawn into —
 * cells (7,3) and (8,9) — were the coldest thing on the board.
 *
 * The plate is now painted from `forest-village-material.ts` in the DL-2 §3
 * **quarry spoil / rubble** key: `#a89880` over `#857762` with a `#c2b49c` chip
 * highlight, the bible's `#1b1410` ink around the silhouette and the chip
 * highlight as the thin pale rim inside its lit edge. The village paving's own
 * flagstone rhythm supplies the broken-slab structure, so the spoil is the same
 * stone the village is paved with, broken — which is what a quarry road's spoil
 * heap is.
 *
 * The plate keeps its shipped 384x128 size and its diamond silhouette, so the
 * two `FOREST_RUBBLE_CELLS` placements in `forestRoad.ts` are untouched and the
 * scene's resolved-URL count against `SCENE_IMAGE_CAP` does not move.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { FOREST_RUBBLE_CELLS } from '../../src/content/scenes/forestRoad';
import { tileNoise } from '../../src/render/painters/shapes';
import { newImage, setPixel } from './lib/image';
import type { Image } from './lib/image';
import { encodeWebp } from './lib/webp';
import { FOREST_GROUND_QUALITY, loadForestMaterial } from './forest-village-material';
import type { ForestMaterial } from './forest-village-material';

/** The shipped plate, and the scene box it is drawn into, from `forestRoad.ts`. */
export const FOREST_RUBBLE_PLATE = { width: 384, height: 128 } as const;
export const FOREST_RUBBLE_BOX = { width: 128, height: 128 / 3 } as const;
/**
 * How ragged the heap's outline is, as a fraction of the diamond's half-width.
 * A spoil heap has no drawn edge; what it has is a scatter of chip that thins
 * out, so the silhouette wanders and the outermost band is broken up.
 */
export const RUBBLE_RAGGED = 0.1;
/** How many chips of village paving fit across one cell of spoil. */
export const RUBBLE_GRAIN = 3;
/** Ink and rim, in plate pixels: 2 px and 3 px of a 64 px tile, at this scale. */
const SCALE = FOREST_RUBBLE_PLATE.width / FOREST_RUBBLE_BOX.width;
const INK_PX = 2 * SCALE;
const RIM_PX = 3 * SCALE;

export const FOREST_RUBBLE_OUTPUT = 'public/art/maps/forest-scene/rubble.webp';

/**
 * The heap's edge at a point, as a signed distance in plate pixels: positive
 * inside. The diamond is the plate's own, so the piece registers exactly where
 * it registers today; the raggedness is seeded value noise around its rim.
 */
export function rubbleEdge(px: number, py: number): number {
  const u = (px + 0.5) / (FOREST_RUBBLE_PLATE.width / 2) - 1;
  const v = (py + 0.5) / (FOREST_RUBBLE_PLATE.height / 2) - 1;
  const radial = Math.abs(u) + Math.abs(v);
  const angle = Math.atan2(v, u);
  const ragged =
    RUBBLE_RAGGED * (0.6 * Math.sin(angle * 7.3 + 1.7) + 0.4 * Math.sin(angle * 13.1 + 4.3) + 0.2);
  // Back into plate pixels along the shorter axis, so the ink reads the same
  // width on both of the diamond's slopes.
  return (1 + ragged - radial) * (FOREST_RUBBLE_PLATE.height / 2);
}

export function packRubble(material: ForestMaterial): Image {
  const image = newImage(FOREST_RUBBLE_PLATE.width, FOREST_RUBBLE_PLATE.height);
  // The first rubble cell's own world box, so the spoil's grain is sampled in
  // exactly the logical space the road beside it is sampled in and the two
  // materials are the same size on screen.
  const cell = FOREST_RUBBLE_CELLS[0] ?? { x: 0, y: 0 };
  const box = {
    x: 768 + (cell.x - cell.y) * 64 - 64,
    y: (cell.x + cell.y + 1) * 32 - FOREST_RUBBLE_BOX.height,
  };
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++) {
      const edge = rubbleEdge(px, py);
      if (edge <= 0) continue;
      const worldX = box.x + (px + 0.5) / SCALE;
      const worldY = box.y + (py + 0.5) / SCALE;
      const dx = (worldX - 768) / 64,
        dy = worldY / 32;
      // Spoil is broken paving, so it is sampled at three times the road's
      // logical frequency: the village's flagstones arrive as chips rather than
      // as whole slabs, which is the difference between a heap and a floor.
      const x = ((dx + dy) / 2) * RUBBLE_GRAIN,
        y = ((dy - dx) / 2) * RUBBLE_GRAIN;
      // The outermost chip thins out rather than ending on a line: a hashed
      // share of the last pixel of the rim is dropped, so the heap scatters.
      if (edge < 1 && tileNoise(px, py, 37) > edge) continue;
      // The lit side of this projection is up-screen, which on a diamond is the
      // top two slopes; the pale chip highlight is the rim there and nowhere.
      const lit = py < FOREST_RUBBLE_PLATE.height / 2;
      const rgb =
        edge < INK_PX
          ? material.ink
          : lit && edge < INK_PX + RIM_PX
            ? material.rimOf('spoil')
            : material.colour('spoil', x, y);
      setPixel(image, px, py, [rgb[0], rgb[1], rgb[2], 255]);
    }
  return image;
}

export async function main(): Promise<void> {
  const image = packRubble(await loadForestMaterial());
  mkdirSync('public/art/maps/forest-scene', { recursive: true });
  const bytes = await encodeWebp(image, FOREST_GROUND_QUALITY, true);
  writeFileSync(FOREST_RUBBLE_OUTPUT, bytes);
  console.log({ width: image.width, height: image.height, bytes: bytes.length });
}

if (process.argv[1]?.endsWith('forest-rubble.ts')) await main();
