/**
 * Pack the Forest Road's southern creek: its two pools' bed, wet line and damp
 * margin.
 *
 *   node --import tsx scripts/art/forest-creek.ts
 *
 * M3 turned the south strip into deep water (`W`) between alders, and nothing
 * painted it: a partial scene draws only its registered plates over the grid,
 * and the runtime draws no film over deep water, so the creek showed as the
 * procedural fill's flat blue diamonds. Each pool is packed by the pond's own
 * `packShoreline`, with the same bite, bed and ink, from the same village
 * material — the creek and the pond are one water, not two that happen to
 * share tones.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { FOREST_APRON_MAP, FOREST_CREEK_POOLS } from '../../src/content/scenes/forestRoad';
import type { ForestCreekPool } from '../../src/content/scenes/forestRoad';
import { setPixel } from './lib/image';
import { encodeWebp } from './lib/webp';
import { FOREST_GROUND_QUALITY, loadForestMaterial } from './forest-village-material';
import type { ForestMaterial } from './forest-village-material';
import { packShoreline, shorePosition } from './forest-shoreline';

export const creekOutput = (name: string): string =>
  `public/art/maps/forest-scene/creek-${name}.webp`;

/**
 * The creek runs on south past the rim, so a pool has no bank there: it is
 * packed as though its row-11 cells continued two rows off the board, and
 * everything past the rim is then cleared for the apron, which continues the
 * water itself. Banked at the rim, the apron's mirror of the pool read as a
 * second channel beside it.
 */
export const CREEK_RUNS_ON = 2;

export function packCreekPool(material: ForestMaterial, pool: ForestCreekPool) {
  const rim = FOREST_APRON_MAP.height;
  const runOn = pool.cells
    .filter(({ y }) => y === rim - 1)
    .flatMap(({ x }) => Array.from({ length: CREEK_RUNS_ON }, (_, i) => ({ x, y: rim + i })));
  const packed = packShoreline(material, {
    patch: pool.patch,
    cells: [...pool.cells, ...runOn],
    organic: true,
    // The creek runs through grass: the verge grows over its bank in clumps.
    overgrowth: (x, y) => material.colour('verge', x, y),
  });
  const { image } = packed;
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++) {
      const { y } = shorePosition(px, py, 2, { patch: pool.patch, cells: pool.cells });
      if (y >= rim) setPixel(image, px, py, [0, 0, 0, 0]);
    }
  return packed;
}

export async function main(): Promise<void> {
  const material = await loadForestMaterial();
  mkdirSync('public/art/maps/forest-scene', { recursive: true });
  for (const pool of FOREST_CREEK_POOLS) {
    const result = packCreekPool(material, pool);
    const bytes = await encodeWebp(result.image, FOREST_GROUND_QUALITY, true);
    writeFileSync(creekOutput(pool.name), bytes);
    console.log({
      pool: pool.name,
      width: result.image.width,
      height: result.image.height,
      bytes: bytes.length,
      bedPixels: result.bedPixels,
      bitePixels: result.bitePixels,
    });
  }
}

if (process.argv[1]?.endsWith('forest-creek.ts')) await main();
