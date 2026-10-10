/**
 * Pack the split Ba Dan painting into the files the game loads.
 *
 *   node --import tsx scripts/art/ba-dan-regions/pack.ts [workDir] [--check]
 *
 * `workDir` (default `.review/regions`) is where `regions.py split` wrote `split/`: the ground plates
 * and one trimmed PNG per upright. This writes, under `public/art/maps/ba-dan-scene/`, `ground-NN.webp`
 * (one lossy WebP per plate, opaque) and `uprights-N.webp` (the uprights, shelf-packed into as few
 * 2048-pixel pages as it takes, lossy with an exact alpha plane), and `src/content/scenes/baDan.art.ts`,
 * the table of where each plate and sprite sits (in painting pixels) and in which file. `--check` packs again and
 * compares every byte with what is on disk. `regen.sh` runs the whole chain from the accepted regions.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { format, resolveConfig } from 'prettier';
import { composeAtlas, maxRectsPack, packTight } from '../lib/atlas';
import type { Item, Placed } from '../lib/atlas';
import { readPng } from '../lib/image';
import { UPRIGHT_WEBP_OPTIONS, encodeUprightWebp, encodeWebp } from '../lib/webp';

export const OUTPUT_DIR = 'public/art/maps/ba-dan-scene';
export const TABLE = 'src/content/scenes/baDan.art.ts';
/**
 * The ground's WebP quality: the lowest of 60, 70, 75, 80, 85, 90 whose 2x crops of a wall, a paved path
 * and a canopy show no softening against the lossless painting (80 softens wood grain and small flowers
 * a little; 85 does not). Uprights are encoded by `encodeUprightWebp`, q90 or the first above it that
 * meets the fine-grain contract.
 */
export const GROUND_QUALITY = 85;
export const PAGE_SIDE = 2048;
export const GUTTER = 2;

interface SplitReport {
  painting: { width: number; height: number; scale: number; worldX: number; worldY: number };
  sprites: { id: string; file: string; x: number; y: number; width: number; height: number }[];
  plates: { index: number; file: string; x: number; y: number; width: number; height: number }[];
}

/** Sprites onto 2048-pixel pages, biggest first, each into the first page it fits; every page then cut to size. */
export function pagePlan(
  items: readonly Item[],
): { placed: Placed[]; width: number; height: number }[] {
  const area = (i: Item): number => i.image.width * i.image.height;
  const byHeight = (a: Item, b: Item): number =>
    b.image.height - a.image.height ||
    b.image.width - a.image.width ||
    a.name.localeCompare(b.name);
  const rest = [...items].sort((a, b) => area(b) - area(a) || a.name.localeCompare(b.name));
  const pages: { placed: Placed[]; width: number; height: number }[] = [];
  while (rest.length > 0) {
    const chosen: Item[] = [];
    for (const item of [...rest]) {
      const trial = [...chosen, item].sort(byHeight);
      if (maxRectsPack(trial, PAGE_SIDE, PAGE_SIDE, GUTTER)) {
        chosen.push(item);
        rest.splice(rest.indexOf(item), 1);
      }
    }
    if (chosen.length === 0)
      throw new Error(`${rest[0]?.name} does not fit a ${PAGE_SIDE} px page`);
    pages.push(packTight(chosen, PAGE_SIDE, GUTTER));
  }
  return pages;
}

export interface Packed {
  files: Map<string, Uint8Array>;
  table: string;
}

export async function pack(work: string): Promise<Packed> {
  const report = JSON.parse(readFileSync(`${work}/split/split-report.json`, 'utf8')) as SplitReport;
  const files = new Map<string, Uint8Array>();
  const ground: number[][] = [];
  for (const plate of report.plates) {
    const image = readPng(`${work}/split/${plate.file}`);
    if (image.width !== plate.width || image.height !== plate.height)
      throw new Error(
        `${plate.file} is ${image.width}x${image.height}, the report says ${plate.width}x${plate.height}`,
      );
    const name = `ground-${String(plate.index).padStart(2, '0')}.webp`;
    files.set(name, await encodeWebp(image, GROUND_QUALITY, false, UPRIGHT_WEBP_OPTIONS));
    ground.push([plate.index, plate.x, plate.y, plate.width, plate.height]);
  }
  const items: Item[] = report.sprites.map((s) => ({
    name: s.id,
    image: readPng(`${work}/split/${s.file}`),
  }));
  const bySprite = new Map(report.sprites.map((s) => [s.id, s]));
  const rows: string[] = [];
  const pages = pagePlan(items);
  for (const [index, page] of pages.entries()) {
    const atlas = composeAtlas(
      items.filter((i) => page.placed.some((p) => p.name === i.name)),
      page.placed,
      page.width,
      page.height,
      GUTTER,
    );
    files.set(`uprights-${index}.webp`, await encodeUprightWebp(atlas));
    for (const p of page.placed) {
      const s = bySprite.get(p.name)!;
      if (p.width !== s.width || p.height !== s.height)
        throw new Error(`${p.name} changed size when packed`);
      rows.push(
        `  ${JSON.stringify(p.name)}: [${index}, ${p.x}, ${p.y}, ${s.x}, ${s.y}, ${s.width}, ${s.height}],`,
      );
    }
  }
  rows.sort();
  const source = `/**
 * Where Ba Dan's painting is: GENERATED by \`scripts/art/ba-dan-regions/pack.ts\` (\`regen.sh\`), do not edit.
 * Every position is in painting pixels, 1.5 to the world pixel, from the pan box's corner.
 */
export const BA_DAN_PAINTING = {
  scale: ${report.painting.scale},
  origin: { x: ${report.painting.worldX}, y: ${report.painting.worldY} },
  size: { width: ${report.painting.width}, height: ${report.painting.height} },
} as const;

/** The ground plates as [index, x, y, width, height]; \`ground-NN.webp\` holds plate NN. */
export const BA_DAN_GROUND_PLATES: readonly (readonly [number, number, number, number, number])[] = ${JSON.stringify(ground)};

/** How many \`uprights-N.webp\` pages there are. */
export const BA_DAN_UPRIGHT_PAGES = ${pages.length};

/**
 * Each upright, by scenery id: [page, x and y of its sprite on the page, then x, y, width and height of
 * the sprite in painting pixels].
 */
export const BA_DAN_UPRIGHTS: Readonly<Record<string, readonly [number, number, number, number, number, number, number]>> = {
${rows.join('\n')}
};
`;
  const config = (await resolveConfig(TABLE)) ?? {};
  return { files, table: await format(source, { ...config, filepath: TABLE }) };
}

const same = (a: Uint8Array | undefined, b: Uint8Array | undefined): boolean =>
  !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]);

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const work = args.find((a) => !a.startsWith('--')) ?? '.review/regions';
  const { files, table } = await pack(work);
  if (check) {
    const bad: string[] = [];
    for (const [name, bytes] of files)
      if (
        !existsSync(`${OUTPUT_DIR}/${name}`) ||
        !same(new Uint8Array(readFileSync(`${OUTPUT_DIR}/${name}`)), bytes)
      )
        bad.push(name);
    if (!existsSync(TABLE) || readFileSync(TABLE, 'utf8') !== table) bad.push(TABLE);
    for (const name of existing()) if (!files.has(name)) bad.push(`${name} (stale)`);
    if (bad.length > 0) {
      console.error(`ba-dan-regions pack differs: ${bad.join(', ')}`);
      process.exit(1);
    }
    console.log(`ba-dan-regions pack matches: ${files.size} files and ${TABLE}`);
    return;
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const name of existing()) if (!files.has(name)) unlinkSync(`${OUTPUT_DIR}/${name}`);
  let total = 0;
  for (const [name, bytes] of files) {
    writeFileSync(`${OUTPUT_DIR}/${name}`, bytes);
    total += bytes.length;
    console.log(`${name} ${bytes.length}`);
  }
  writeFileSync(TABLE, table);
  console.log(`${files.size} files, ${total} bytes; ${TABLE}`);
}

/** The files this script owns that are on disk now. */
function existing(): string[] {
  return existsSync(OUTPUT_DIR)
    ? readdirSync(OUTPUT_DIR).filter((f) => /^(ground-\d+|uprights-\d+)\.webp$/.test(f))
    : [];
}

if (process.argv[1]?.endsWith('pack.ts')) await main();
