/**
 * Packer for the village's tree atlas (`village-trees.webp`): the four native tree masters, unscaled,
 * and the clumps `ba-dan-trees.ts` composites from them. The scene may ask for 40 distinct images; the
 * four masters used to be four of them, and two new atlases (this and `true-dressing.webp`) take
 * their place. Singles (the court trees, the exterior canopies, every tree a figure can walk behind)
 * are drawn from their master's rectangle here, mirrored by the scene's own `flip`.
 * The page is the smallest one the sprites fit (`packTight`, a MaxRects pack), at most 2048 a side.
 *
 * Usage: node --import tsx scripts/art/ba-dan-trees-pack.ts [--check | --layout]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { composeAtlas, packTight } from './lib/atlas';
import type { Item, Placed } from './lib/atlas';
import { readImage } from './lib/image';
import { encodeUprightWebp } from './lib/webp';
import { TREE_MASTERS, closeGaps, composeClumps } from './ba-dan-trees';

export const TREES_OUTPUT = 'public/art/maps/ba-dan-scene/village-trees.webp';

export function treeAtlasItems(): Item[] {
  const items: Item[] = TREE_MASTERS.map(([name]) => ({
    name,
    image: closeGaps(readImage(`art/source/ba-dan-restyle/fine/${name}-village-tree.png`)),
  }));
  composeClumps().forEach((c, i) => items.push({ name: `clump-${i}`, image: c.image }));
  return items;
}

/** The page the items are laid on: the smallest (by area) the sprites fit, none past 2048 a side. */
export function treeAtlasLayout(items: readonly Item[] = treeAtlasItems()) {
  return packTight(items);
}

export async function packTreeAtlas(): Promise<{
  bytes: Uint8Array;
  placed: Placed[];
  width: number;
  height: number;
}> {
  const items = treeAtlasItems();
  const { placed, width, height } = treeAtlasLayout(items);
  const image = composeAtlas(items, placed, width, height);
  return { bytes: await encodeUprightWebp(image), placed, width, height };
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('scripts/art/ba-dan-trees-pack.ts')) {
  const { bytes, placed, width, height } = await packTreeAtlas();
  if (process.argv.includes('--layout')) {
    console.log(
      width,
      height,
      JSON.stringify(placed.map((p) => [p.name, p.x, p.y, p.width, p.height])),
    );
  } else if (process.argv.includes('--check')) {
    const same = Buffer.from(readFileSync(TREES_OUTPUT)).equals(Buffer.from(bytes));
    console.log(`village-trees: ${same ? 'matches' : 'DIFFERS'}`);
    if (!same) process.exit(1);
  } else {
    writeFileSync(TREES_OUTPUT, bytes);
    console.log(JSON.stringify({ file: 'village-trees.webp', bytes: bytes.length, width, height }));
  }
}
